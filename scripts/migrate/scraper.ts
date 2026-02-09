#!/usr/bin/env node
/**
 * Product Migration Script using Playwright
 * Scrapes product data from packbn.com and generates:
 * 1. Markdown spec files in public/data/vi/specs/{category}/
 * 2. English translation in public/data/en/specs/{category}/
 * 3. Product images in public/images/products/
 * 4. Updates public/data/vi/products.json and public/data/en/products.json
 */

import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { 
  translateProductName, 
  translateDescription, 
  translateSpecs, 
  translateTags,
  translateMarkdownContent,
  generateEnglishSlug,
  translateExcerpt,
  translateCategoryName
} from './translator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../..');
const PRODUCTS_JSON_VI = path.join(ROOT_DIR, 'public/data/vi/products.json');
const PRODUCTS_JSON_EN = path.join(ROOT_DIR, 'public/data/en/products.json');
const SPECS_DIR_VI = path.join(ROOT_DIR, 'public/data/vi/specs');
const SPECS_DIR_EN = path.join(ROOT_DIR, 'public/data/en/specs');
const IMAGES_DIR = path.join(ROOT_DIR, 'public/images/products');

// Types
interface ScrapedProduct {
  slug: string;
  slugEn: string;
  name: string;
  nameEn: string;
  category: string;
  categoryId: string;
  type: string;
  capacity: string;
  excerpt: string;
  excerptEn: string;
  description: string;
  descriptionEn: string;
  image: string;
  gallery: string[];
  specs: Array<{ label: string; value: string }>;
  specsEn: Array<{ label: string; value: string }>;
  features: string[];
  featuresEn: string[];
  applications: string[];
  applicationsEn: string[];
  packaging: string;
  certifications: string[];
  customPrint: boolean;
  moqPrint: number;
  badge: string;
  minOrder: number;
  price: string;
  specsId: string;
  tags: string[];
  tagsEn: string[];
}

// Category mapping from URL/name to category ID
const CATEGORY_MAP: Record<string, string> = {
  'coc': 'cups',
  'cup': 'cups',
  'quai-xach-ly': 'accessories',
  'ly': 'cups',
  'to': 'bowls',
  'bowl': 'bowls',
  'bat': 'bowls',
  'hop': 'containers',
  'box': 'containers',
  'container': 'containers',
  'dia': 'containers',
  'plate': 'containers',
  'ong-hut': 'straws',
  'straw': 'straws',
  'thia': 'wooden',
  'nia': 'wooden',
  'dao': 'wooden',
  'que': 'wooden',
  'wooden': 'wooden',
  'go': 'wooden',
  'quai': 'accessories',
  'phu-kien': 'accessories',
  'accessory': 'accessories',
};

// Helper functions
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function detectCategory(slug: string, name: string): string {
  const text = (slug + ' ' + name).toLowerCase();
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(key)) return value;
  }
  return 'cups'; // default
}

function extractCapacity(name: string): string {
  // Try to extract capacity like "9oz", "260ml", "12oz ~ 400ml"
  const match = name.match(/(\d+oz|\d+ml)(?:\s*~\s*(\d+ml))?/i);
  if (match) {
    if (match[2]) return `${match[1]} ~ ${match[2]}`;
    return match[1];
  }
  return '';
}

function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

// Enrich product description with industry knowledge
function enrichDescription(
  baseDescription: string, 
  category: string, 
  name: string,
  capacity: string,
  type: string
): { vi: string; en: string; features: string[]; featuresEn: string[]; applications: string[]; applicationsEn: string[] } {
  
  const result = {
    vi: baseDescription,
    en: translateProductName(baseDescription),
    features: [] as string[],
    featuresEn: [] as string[],
    applications: [] as string[],
    applicationsEn: [] as string[],
  };
  
  // Extract size info
  const ozMatch = capacity.match(/(\d+)oz/i);
  const mlMatch = capacity.match(/(\d+)ml/i);
  const ozSize = ozMatch ? parseInt(ozMatch[1]) : 0;
  const mlSize = mlMatch ? parseInt(mlMatch[1]) : 0;
  
  const isDoubleWall = name.toLowerCase().includes('2 lớp') || name.toLowerCase().includes('double');
  const isKraft = name.toLowerCase().includes('kraft');
  const isWhite = name.toLowerCase().includes('trắng') || name.toLowerCase().includes('white');
  
  // Category-specific enrichment
  if (category === 'cups') {
    // Paper Cups
    result.features.push(
      'Chất liệu giấy cao cấp nhập khẩu, an toàn thực phẩm',
      'Lớp PE coating chống thấm, không rò rỉ',
      'Chứng nhận FDA, LFGB, BPA-Free',
      'Có thể in logo theo yêu cầu từ 5,000 - 10,000 cái'
    );
    result.featuresEn.push(
      'Premium imported paper material, food-safe',
      'PE coating layer, leak-proof',
      'FDA, LFGB, BPA-Free certified',
      'Custom logo printing available from 5,000 - 10,000 pcs'
    );
    
    if (isDoubleWall) {
      result.features.push(
        'Cấu trúc 2 lớp cách nhiệt vượt trội, cầm nóng không bỏ tay',
        'Không cần bọc tay khi sử dụng thức uống nóng',
        'Duy trì nhiệt độ thức uống lâu hơn 15-20% so với cốc 1 lớp'
      );
      result.featuresEn.push(
        'Double wall structure for excellent insulation, no sleeve needed',
        'No cup sleeve required for hot beverages',
        'Maintains beverage temperature 15-20% longer than single wall cups'
      );
    }
    
    if (isKraft) {
      result.features.push(
        'Giấy Kraft tự nhiên không tẩy trắng, thân thiện môi trường',
        'Phân hủy sinh học hoàn toàn trong 3-6 tháng',
        'Màu nâu tự nhiên sang trọng, phù hợp phong cách eco-friendly'
      );
      result.featuresEn.push(
        'Natural unbleached Kraft paper, eco-friendly',
        'Fully biodegradable in 3-6 months',
        'Natural brown color, perfect for eco-friendly branding'
      );
    }
    
    // Applications based on size
    if (ozSize <= 5 || mlSize <= 150) {
      result.applications.push('Espresso', 'Cà phê đen', 'Thuốc uống mẫu thử', 'Kem nhỏ');
      result.applicationsEn.push('Espresso', 'Black Coffee', 'Tasting Samples', 'Small Ice Cream');
    } else if (ozSize <= 9 || mlSize <= 270) {
      result.applications.push('Cà phê nóng', 'Trà nóng', 'Cappuccino', 'Americano');
      result.applicationsEn.push('Hot Coffee', 'Hot Tea', 'Cappuccino', 'Americano');
    } else if (ozSize <= 12 || mlSize <= 400) {
      result.applications.push('Cà phê', 'Trà sữa', 'Nước ép', 'Cacao nóng');
      result.applicationsEn.push('Coffee', 'Bubble Tea', 'Juice', 'Hot Chocolate');
    } else if (ozSize <= 16 || mlSize <= 500) {
      result.applications.push('Trà sữa size M', 'Sinh tố', 'Cà phê đá xay', 'Matcha');
      result.applicationsEn.push('Bubble Tea M', 'Smoothies', 'Frappe', 'Matcha');
    } else {
      result.applications.push('Trà sữa size L', 'Sinh tố family', 'Đồ uống cỡ lớn');
      result.applicationsEn.push('Bubble Tea L', 'Family Smoothies', 'Large Beverages');
    }
    
  } else if (category === 'bowls') {
    // Paper Bowls
    result.features.push(
      'Thiết kế chắc chắn, chịu nhiệt đến 100°C',
      'Chống thấm dầu mỡ, không biến dạng khi đựng thức ăn nóng',
      'Có nắp đậy vừa khít, không tràn trong vận chuyển',
      'An toàn thực phẩm, chứng nhận FDA'
    );
    result.featuresEn.push(
      'Sturdy design, heat resistant up to 100°C',
      'Oil and grease proof, no deformation with hot food',
      'Tight-fitting lids prevent spills during transport',
      'Food-safe, FDA certified'
    );
    
    if (isKraft) {
      result.features.push(
        'Chất liệu Kraft tự nhiên, phong cách thân thiện môi trường',
        'Phù hợp cho các thương hiệu xanh và bền vững'
      );
      result.featuresEn.push(
        'Natural Kraft material, eco-friendly style',
        'Perfect for green and sustainable brands'
      );
    }
    
    if (ozSize <= 9 || mlSize <= 270) {
      result.applications.push('Kem', 'Sữa chua', 'Cháo trẻ em', 'Tráng miệng');
      result.applicationsEn.push('Ice Cream', 'Yogurt', 'Children Porridge', 'Dessert');
    } else if (ozSize <= 16 || mlSize <= 480) {
      result.applications.push('Phở', 'Bún', 'Miến', 'Bánh canh');
      result.applicationsEn.push('Pho', 'Noodles', 'Vermicelli', 'Banh Canh');
    } else if (ozSize <= 26 || mlSize <= 750) {
      result.applications.push('Phở đặc biệt', 'Lẩu individual', 'Mì cay', 'Bún bò');
      result.applicationsEn.push('Special Pho', 'Individual Hot Pot', 'Spicy Noodles', 'Bun Bo');
    } else {
      result.applications.push('Lẩu 1 người', 'Salad gia đình', 'Phở gia đình', 'Sharing portions');
      result.applicationsEn.push('Single Hot Pot', 'Family Salad', 'Family Pho', 'Sharing Portions');
    }
    
  } else if (category === 'straws') {
    // Paper Straws
    result.features.push(
      'Cấu trúc 3 lớp giấy cao cấp, không mềm trong nước 24h+',
      'Không mùi vị lạ, không ảnh hưởng hương vị đồ uống',
      'Phân hủy sinh học 100%, thay thế hoàn hảo cho ống hút nhựa',
      'Có loại bọc màng vệ sinh từng cái'
    );
    result.featuresEn.push(
      '3-layer premium paper structure, won\'t get soggy for 24h+',
      'No aftertaste, won\'t affect beverage flavor',
      '100% biodegradable, perfect plastic straw replacement',
      'Individually wrapped options available'
    );
    
    const diameterMatch = name.match(/phi\s*(\d+)/i) || name.match(/(\d+)mm/i);
    const diameter = diameterMatch ? parseInt(diameterMatch[1]) : 6;
    
    if (diameter <= 6) {
      result.applications.push('Cà phê', 'Trà', 'Nước suối', 'Thức uống thông thường');
      result.applicationsEn.push('Coffee', 'Tea', 'Water', 'Regular Beverages');
    } else if (diameter <= 8) {
      result.applications.push('Trà sữa', 'Sinh tố', 'Nước ép', 'Thức uống có bột');
      result.applicationsEn.push('Bubble Tea', 'Smoothies', 'Juice', 'Powdered Drinks');
    } else {
      result.applications.push('Trà sữa trân châu', 'Sinh tố đặc', 'Chè', 'Thạch');
      result.applicationsEn.push('Bubble Tea with Pearls', 'Thick Smoothies', 'Che', 'Jelly Drinks');
    }
    
  } else if (category === 'containers') {
    // Food Containers
    result.features.push(
      'Giấy Kraft cứng cáp, chịu lực tốt',
      'Nắp gài chắc chắn, không lo đổ tràn',
      'Chịu nhiệt tốt, có thể dùng trong lò vi sóng',
      'Phù hợp cho dịch vụ take-away và delivery'
    );
    result.featuresEn.push(
      'Sturdy Kraft paper, good load bearing',
      'Secure locking tabs prevent spills',
      'Heat resistant, microwave safe',
      'Perfect for take-away and delivery services'
    );
    
    result.applications.push('Cơm hộp', 'Thức ăn nhanh', 'Salad', 'Đồ nướng');
    result.applicationsEn.push('Rice Boxes', 'Fast Food', 'Salad', 'Grilled Food');
    
  } else if (category === 'wooden') {
    // Wooden Products
    result.features.push(
      'Gỗ bạch dương tự nhiên 100%, không hóa chất',
      'Bề mặt mịn màng, mài nhẵn kỹ lưỡng',
      'Phân hủy hoàn toàn trong 6 tháng',
      'Nâng tầm trải nghiệm ẩm thực với phong cách sang trọng'
    );
    result.featuresEn.push(
      '100% natural birch wood, chemical-free',
      'Smooth surface, carefully polished',
      'Fully biodegradable in 6 months',
      'Elevates dining experience with elegant style'
    );
    
    result.applications.push('Nhà hàng', 'Khách sạn', 'Sự kiện', 'Tiệc cưới', 'Picnic');
    result.applicationsEn.push('Restaurants', 'Hotels', 'Events', 'Weddings', 'Picnic');
    
  } else if (category === 'accessories') {
    // Accessories
    result.features.push(
      'Làm thủ công từ lá cây tự nhiên',
      'Chịu lực tốt, có thể xách 2-4 ly',
      '100% phân hủy sinh học',
      'Tạo điểm nhấn cho thương hiệu xanh'
    );
    result.featuresEn.push(
      'Handcrafted from natural plant leaves',
      'Strong load capacity, carries 2-4 cups',
      '100% biodegradable',
      'Creates highlight for green brands'
    );
    
    result.applications.push('Xách ly take-away', 'Sự kiện', 'Quà tặng', 'Trưng bày');
    result.applicationsEn.push('Take-away Cup Carrier', 'Events', 'Gifts', 'Display');
  }
  
  // Enrich the main description
  if (!result.vi || result.vi.length < 50) {
    const enrichedPartsVi: string[] = [];
    const enrichedPartsEn: string[] = [];
    
    // Add intro
    enrichedPartsVi.push(`${name} là sản phẩm ${category === 'cups' ? 'cốc giấy' : category === 'bowls' ? 'tô giấy' : category === 'straws' ? 'ống hút giấy' : category === 'containers' ? 'hộp giấy' : category === 'wooden' ? 'sản phẩm gỗ' : 'phụ kiện'} cao cấp của PACKBN.`);
    enrichedPartsEn.push(`${translateProductName(name)} is a premium ${category === 'cups' ? 'paper cup' : category === 'bowls' ? 'paper bowl' : category === 'straws' ? 'paper straw' : category === 'containers' ? 'paper container' : category === 'wooden' ? 'wooden product' : 'accessory'} from PACKBN.`);
    
    if (capacity) {
      enrichedPartsVi.push(`Dung tích ${capacity} phù hợp cho nhiều loại thực phẩm và đồ uống.`);
      enrichedPartsEn.push(`Capacity of ${capacity} suitable for various foods and beverages.`);
    }
    
    if (isDoubleWall) {
      enrichedPartsVi.push('Thiết kế 2 lớp đặc biệt giúp cách nhiệt tốt, bảo vệ tay người dùng khi cầm thức uống nóng.');
      enrichedPartsEn.push('Special double-wall design provides excellent insulation, protecting hands when holding hot beverages.');
    }
    
    if (isKraft) {
      enrichedPartsVi.push('Chất liệu Kraft tự nhiên thân thiện với môi trường, phù hợp cho các doanh nghiệp hướng đến phát triển bền vững.');
      enrichedPartsEn.push('Natural Kraft material is eco-friendly, suitable for businesses aiming for sustainable development.');
    }
    
    result.vi = enrichedPartsVi.join('\n\n');
    result.en = enrichedPartsEn.join('\n\n');
  } else {
    // Add enrichment to existing description
    const additionalVi: string[] = [];
    const additionalEn: string[] = [];
    
    if (isDoubleWall && !result.vi.includes('2 lớp')) {
      additionalVi.push('Sản phẩm được thiết kế với cấu trúc 2 lớp đặc biệt, giúp cách nhiệt tối ưu và mang lại trải nghiệm sử dụng thoải mái.');
      additionalEn.push('The product features a special double-wall structure for optimal insulation and comfortable user experience.');
    }
    
    if (isKraft && !result.vi.includes('Kraft')) {
      additionalVi.push('Chất liệu Kraft tự nhiên không tẩy trắng, thân thiện với môi trường và an toàn cho sức khỏe.');
      additionalEn.push('Made from natural unbleached Kraft material, eco-friendly and health-safe.');
    }
    
    if (additionalVi.length > 0) {
      result.vi += '\n\n' + additionalVi.join('\n\n');
      result.en += '\n\n' + additionalEn.join('\n\n');
    }
  }
  
  return result;
}

function generateSpecsId(category: string, name: string): string {
  // Convert "Cốc 2 lớp Kraft 12oz ~ 400ml" -> "cups/12ozKraftPaperCup400ml"
  const cleanName = name
    .replace(/Cốc|Tô|Hộp|Đĩa|Ống hút|Thìa|Nĩa|Dao|Quai/gi, '')
    .replace(/giấy|2 lớp|giấy Kraft/gi, '')
    .replace(/[~\s]+/g, ' ')
    .trim();
  
  // Extract size
  const sizeMatch = cleanName.match(/(\d+)oz/i);
  const size = sizeMatch ? sizeMatch[1] + 'oz' : '';
  
  // Determine type
  let type = 'Paper';
  if (name.toLowerCase().includes('kraft')) type = 'Kraft';
  if (name.toLowerCase().includes('2 lớp') || name.toLowerCase().includes('double')) type = 'DoubleWall';
  
  // Extract volume
  const volMatch = cleanName.match(/(\d+)ml/);
  const volume = volMatch ? volMatch[1] + 'ml' : '';
  
  // Product type
  let productType = 'Cup';
  if (category === 'bowls') productType = 'Bowl';
  if (category === 'containers') productType = category.includes('dia') || category.includes('plate') ? 'Plate' : 'Box';
  if (category === 'straws') productType = 'Straw';
  if (category === 'wooden') {
    if (name.toLowerCase().includes('thia') || name.toLowerCase().includes('spoon')) productType = 'Spoon';
    else if (name.toLowerCase().includes('nia') || name.toLowerCase().includes('fork')) productType = 'Fork';
    else if (name.toLowerCase().includes('dao') || name.toLowerCase().includes('knife')) productType = 'Knife';
    else productType = 'Cutlery';
  }
  if (category === 'accessories') productType = 'Handle';
  
  const specsName = size ? `${size}${type}${productType}${volume}` : `${type}${productType}`;
  return `${category}/${toPascalCase(specsName)}`;
}

async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download: ${url}`);
    
    const buffer = await response.arrayBuffer();
    const filepath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(buffer));
    
    return `/images/products/${filename}`;
  } catch (error) {
    console.error(`Error downloading image ${url}:`, error);
    return null;
  }
}

async function scrapeProduct(page: Page, url: string): Promise<ScrapedProduct | null> {
  try {
    console.log(`🔍 Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Extract slug from URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1] || '';
    
    if (!slug) {
      console.error('❌ Could not extract slug from URL');
      return null;
    }
    
    // Scrape product data
    const productData = await page.evaluate(() => {
      const data: any = {};
      
      // Product name - try different selectors
      const nameEl = document.querySelector('h1.product-title, h1.entry-title, .product-name h1, h1');
      data.name = nameEl?.textContent?.trim() || '';
      
      // Description - Try specific selector first, then fallback
      const descEl = document.querySelector('#tab-description > p, #tab-description, .product-description, .woocommerce-product-details__short-description, .entry-content p, .product-short-description');
      data.description = descEl?.textContent?.trim() || '';
      
      // Also try to get all paragraphs from description tab
      const descParagraphs = document.querySelectorAll('#tab-description p');
      if (descParagraphs.length > 0) {
        data.description = Array.from(descParagraphs).map(p => p.textContent?.trim()).filter(Boolean).join('\n\n');
      }
      
      // Price
      const priceEl = document.querySelector('.price .amount, .woocommerce-Price-amount');
      data.price = priceEl?.textContent?.trim() || 'Liên hệ';
      
      // Main image
      const imgEl = document.querySelector('.woocommerce-product-gallery__image img, .product-image img, .wp-post-image');
      data.imageUrl = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
      
      // Gallery images - Try multiple selectors for WooCommerce galleries
      const gallerySelectors = [
        '.woocommerce-product-gallery__wrapper .woocommerce-product-gallery__image img',
        '.flex-control-nav li img',
        '.woocommerce-product-gallery img',
        '.wp-post-image',
        '.product-gallery img',
        '.woocommerce-product-gallery__image img',
        'ol.flex-control-nav li img',
        '.slick-slide img',
      ];
      
      const galleryUrls = new Set<string>();
      for (const selector of gallerySelectors) {
        const imgs = document.querySelectorAll(selector);
        imgs.forEach(img => {
          const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-large_image');
          if (src && !src.includes('placeholder')) {
            // Get full size image by removing resize parameters
            const fullSizeSrc = src.replace(/-\d+x\d+\./, '.').replace(/\?resize=.*/, '');
            galleryUrls.add(fullSizeSrc);
          }
        });
      }
      data.galleryUrls = Array.from(galleryUrls);
      
      // Product specs from table or attributes
      const specRows = document.querySelectorAll('.woocommerce-product-attributes tr, .product-attributes tr, table tr');
      data.specs = [];
      specRows.forEach(row => {
        const label = row.querySelector('th, .label')?.textContent?.trim();
        const value = row.querySelector('td, .value')?.textContent?.trim();
        if (label && value) {
          data.specs.push({ label, value });
        }
      });
      
      // Additional info from product meta
      const metaItems = document.querySelectorAll('.product_meta .sku_wrapper, .product_meta .posted_in');
      data.meta = {};
      metaItems.forEach(item => {
        const text = item.textContent?.trim();
        if (text?.includes('SKU')) data.meta.sku = text.replace('SKU:', '').trim();
        if (text?.includes('Category')) data.meta.category = text.replace('Category:', '').trim();
      });
      
      // Extract features from description or bullet points
      const featureEls = document.querySelectorAll('.product-description ul li, .product-features li');
      data.features = Array.from(featureEls).map(el => el.textContent?.trim()).filter(Boolean);
      
      return data;
    });
    
    // Detect category
    const categoryId = detectCategory(slug, productData.name);
    
    // Extract capacity from name
    const capacity = extractCapacity(productData.name);
    
    // Determine type based on product name
    let type = '1PE';
    if (productData.name.toLowerCase().includes('kraft')) type = 'Kraft';
    if (productData.name.toLowerCase().includes('2 lớp') || productData.name.toLowerCase().includes('double')) type = '2PE';
    if (productData.name.toLowerCase().includes('custom') || productData.name.toLowerCase().includes('in logo')) type = 'Custom';
    
    // Generate specs ID
    const specsId = generateSpecsId(categoryId, productData.name);
    
    // Generate tags
    const tags = [categoryId, type];
    if (productData.name.toLowerCase().includes('kraft')) tags.push('kraft');
    if (capacity) tags.push(capacity.toLowerCase().replace(/\s/g, ''));
    
    // Enrich description with industry knowledge
    const enriched = enrichDescription(
      productData.description,
      categoryId,
      productData.name,
      capacity,
      type
    );
    
    // Translate to English
    const nameEn = translateProductName(productData.name);
    const slugEn = generateEnglishSlug(slug, nameEn);
    
    // Use enriched descriptions
    const finalDescription = enriched.vi;
    const finalDescriptionEn = enriched.en;
    
    const excerpt = finalDescription.substring(0, 150) + (finalDescription.length > 150 ? '...' : '');
    const excerptEn = finalDescriptionEn.substring(0, 150) + (finalDescriptionEn.length > 150 ? '...' : '');
    
    const specsEn = translateSpecs(productData.specs);
    const tagsEn = translateTags(tags);
    
    // Merge features from enrichment with scraped features
    const allFeatures = [...new Set([...enriched.features, ...productData.features])];
    const allFeaturesEn = [...new Set([...enriched.featuresEn, ...productData.features.map((f: string) => translateProductName(f))])];
    
    return {
      slug,
      slugEn,
      name: productData.name,
      nameEn,
      category: categoryId,
      categoryId,
      type,
      capacity,
      excerpt,
      excerptEn,
      description: finalDescription,
      descriptionEn: finalDescriptionEn,
      image: productData.imageUrl,
      gallery: productData.galleryUrls,
      specs: productData.specs,
      specsEn,
      features: allFeatures,
      featuresEn: allFeaturesEn,
      applications: enriched.applications,
      applicationsEn: enriched.applicationsEn,
      packaging: 'Liên hệ',
      certifications: ['FDA', 'LFGB', 'BPA-Free'],
      customPrint: productData.name.toLowerCase().includes('in logo') || productData.name.toLowerCase().includes('custom'),
      moqPrint: 5000,
      badge: 'New',
      minOrder: categoryId === 'straws' ? 10000 : categoryId === 'wooden' ? 5000 : 1000,
      price: productData.price,
      specsId,
      tags,
      tagsEn,
    };
  } catch (error) {
    console.error(`❌ Error scraping ${url}:`, error);
    return null;
  }
}

function generateMarkdownSpec(
  product: ScrapedProduct, 
  isEnglish: boolean = false,
  relatedProducts: string[] = [],
  complementaryProducts: string[] = []
): string {
  const name = isEnglish ? product.nameEn : product.name;
  const specs = isEnglish ? product.specsEn : product.specs;
  const description = isEnglish ? product.descriptionEn : product.description;
  const features = isEnglish ? product.featuresEn : product.features;
  const applications = isEnglish ? product.applicationsEn : product.applications;
  
  // Build gallery array - use all downloaded images
  const galleryYaml = product.gallery.length > 0 
    ? product.gallery.map(img => `"${img}"`).join(', ')
    : `"/images/products/${product.slug}.jpg"`;
  
  // Build specifications array
  const specsYaml = specs.length > 0 
    ? specs.map(s => `  - label: "${s.label}"\n    value: "${s.value}"`).join('\n')
    : `  - label: "${isEnglish ? 'Capacity' : 'Dung tích'}"\n    value: "${product.capacity}"\n  - label: "${isEnglish ? 'MOQ' : 'MOQ'}"\n    value: "${product.minOrder} ${isEnglish ? 'pcs' : 'cái'}"`;
  
  // Applications for frontmatter
  const applicationsYaml = applications.length > 0 
    ? applications.join('", "') 
    : (isEnglish ? 'General use' : 'Đa dụng');
  
  // Format related and complementary products for YAML
  const relatedYaml = relatedProducts.length > 0 
    ? `["${relatedProducts.join('", "')}"]` 
    : '[]';
  const complementaryYaml = complementaryProducts.length > 0 
    ? `["${complementaryProducts.join('", "')}"]` 
    : '[]';
  
  // Content sections
  const sections = isEnglish ? {
    description: 'Product Description',
    specs: 'Technical Specifications',
    usage: 'Applications',
    notes: 'Usage Notes',
    specLabel: 'Specification',
    detailsLabel: 'Details',
  } : {
    description: 'Mô tả sản phẩm',
    specs: 'Đặc điểm kỹ thuật',
    usage: 'Sử dụng cho',
    notes: 'Lưu ý sử dụng',
    specLabel: 'Thông số',
    detailsLabel: 'Chi tiết',
  };
  
  return `---
name: "${name}"
category: "${product.category}"
packaging: "${product.packaging}"
customPrint: ${product.customPrint}
moqPrint: ${product.moqPrint}
badge: "${product.badge}"
certifications: ["${product.certifications.join('", "')}"]
gallery: [${galleryYaml}]
applications: ["${applicationsYaml}"]
specifications:
${specsYaml}
relatedProducts: ${relatedYaml}
complementaryProducts: ${complementaryYaml}
---

# ${name}

## ${sections.description}

${description || (isEnglish ? `${name} - Premium quality product from PACKBN.` : `${product.name} - Sản phẩm chất lượng cao từ PACKBN.` )}

## ${sections.specs}

| ${sections.specLabel} | ${sections.detailsLabel} |
|----------|----------|
${specs.map(s => `| ${s.label} | ${s.value} |`).join('\n') || `| ${isEnglish ? 'Capacity' : 'Dung tích'} | ${product.capacity} |\n| MOQ | ${product.minOrder} ${isEnglish ? 'pcs' : 'cái'} |`}

## ${sections.usage}

${applications.map((app: string) => `- ${app}`).join('\n') || (isEnglish ? '- Hot and cold beverages\n- Take-away and delivery\n- Events and catering' : '- Thức uống nóng/đá\n- Take-away và delivery\n- Sự kiện và tiệc')}

## ${isEnglish ? 'Key Features' : 'Đặc điểm nổi bật'}

${features.map((f: string) => `- ${f}`).join('\n') || (isEnglish ? '- Premium quality\n- Eco-friendly\n- Food-safe' : '- Chất lượng cao\n- Thân thiện môi trường\n- An toàn thực phẩm')}

## ${sections.notes}

${isEnglish 
  ? '- Do not use in microwave\n- Store in a dry place\n- Temperature range: -20°C to 85°C'
  : '- Không sử dụng trong lò vi sóng\n- Bảo quản nơi khô ráo\n- Nhiệt độ sử dụng: -20°C đến 85°C'
}
`;
}

// Find related products based on category and capacity
function findRelatedProducts(
  currentProduct: ScrapedProduct, 
  allProducts: any[], 
  maxResults: number = 3
): string[] {
  // Filter products in same category, exclude current product
  const sameCategory = allProducts.filter(p => 
    p.category === currentProduct.category && 
    p.slug !== currentProduct.slug
  );
  
  // Extract numeric capacity for comparison
  const getCapacityNum = (cap: string) => {
    const match = cap.match(/(\d+)/);
    return match ? parseInt(match[1]) : 0;
  };
  
  const currentCapacity = getCapacityNum(currentProduct.capacity);
  
  // Sort by capacity similarity
  const sorted = sameCategory.sort((a, b) => {
    const capA = getCapacityNum(a.capacity);
    const capB = getCapacityNum(b.capacity);
    const diffA = Math.abs(capA - currentCapacity);
    const diffB = Math.abs(capB - currentCapacity);
    return diffA - diffB;
  });
  
  // Return slugs of top related products
  return sorted.slice(0, maxResults).map(p => p.slug);
}

// Find complementary products (from different categories)
function findComplementaryProducts(
  currentProduct: ScrapedProduct,
  allProducts: any[],
  maxResults: number = 2
): string[] {
  // Define complementary category mappings
  const complementaryMap: Record<string, string[]> = {
    'cups': ['straws', 'wooden', 'accessories'],
    'bowls': ['wooden', 'containers'],
    'straws': ['cups', 'accessories'],
    'containers': ['wooden'],
    'wooden': ['bowls', 'containers', 'cups'],
    'accessories': ['cups', 'straws'],
  };
  
  const targetCategories = complementaryMap[currentProduct.category] || [];
  
  const complementary = allProducts.filter(p => 
    targetCategories.includes(p.category)
  );
  
  // Return random selection or first few
  return complementary.slice(0, maxResults).map(p => p.slug);
}

async function migrateProduct(url: string, extraTag?: string): Promise<void> {
  // Ensure directories exist
  ensureDir(SPECS_DIR_VI);
  ensureDir(SPECS_DIR_EN);
  ensureDir(IMAGES_DIR);
  
  // Load existing products data first
  const productsDataVi = JSON.parse(fs.readFileSync(PRODUCTS_JSON_VI, 'utf-8'));
  const productsDataEn = JSON.parse(fs.readFileSync(PRODUCTS_JSON_EN, 'utf-8'));
  
  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    // Scrape product data
    const product = await scrapeProduct(page, url);
    if (!product) {
      console.error('❌ Failed to scrape product');
      return;
    }
    
    // Update specsId to use slug as filename
    const specsIdWithSlug = `${product.category}/${product.slug}`;
    const specsIdWithSlugEn = `${product.category}/${product.slugEn}`;
    
    console.log('\n📦 Product scraped:');
    console.log(`   Name (VI): ${product.name}`);
    console.log(`   Name (EN): ${product.nameEn}`);
    console.log(`   Category: ${product.category}`);
    console.log(`   SpecsId (VI): ${specsIdWithSlug}`);
    console.log(`   SpecsId (EN): ${specsIdWithSlugEn}`);
    console.log(`   Slug (VI): ${product.slug}`);
    console.log(`   Slug (EN): ${product.slugEn}`);
    
    // Find related and complementary products
    const relatedProducts = findRelatedProducts(product, productsDataVi.products);
    const complementaryProducts = findComplementaryProducts(product, productsDataVi.products);
    
    console.log(`   Related products: ${relatedProducts.join(', ') || 'None'}`);
    console.log(`   Complementary products: ${complementaryProducts.join(', ') || 'None'}`);
    
    // Download all gallery images
    const downloadedGallery: string[] = [];
    if (product.gallery && product.gallery.length > 0) {
      console.log(`   📸 Found ${product.gallery.length} gallery images`);
      
      for (let i = 0; i < product.gallery.length; i++) {
        const imgUrl = product.gallery[i];
        try {
          const imageExt = path.extname(new URL(imgUrl).pathname) || '.jpg';
          if (imageExt === ".svg") continue; // Skip SVG images
          const imageFilename = i === 0 
            ? `${product.slug}${imageExt}`  // Main image
            : `${product.slug}-${i}${imageExt}`;  // Gallery images
          const imagePath = await downloadImage(imgUrl, imageFilename);
          if (imagePath) {
            downloadedGallery.push(imagePath);
            if (i === 0) {
              product.image = imagePath;  // Set main image
            }
            console.log(`   ✅ Image ${i + 1}/${product.gallery.length}: ${imagePath}`);
          }
        } catch (error) {
          console.error(`   ❌ Failed to download image ${i + 1}: ${imgUrl}`);
        }
      }
    } else if (product.image) {
      // Fallback: download main image only
      const imageExt = path.extname(new URL(product.image).pathname) || '.jpg';
      if (imageExt !== ".svg") {
        const imageFilename = `${product.slug}${imageExt}`;
        const imagePath = await downloadImage(product.image, imageFilename);
        if (imagePath) {
          downloadedGallery.push(imagePath);
          product.image = imagePath;
        console.log(`   ✅ Main image: ${imagePath}`);
        }
      }
    }
    
    // Update product gallery with downloaded paths
    product.gallery = downloadedGallery;
    
    // Create category directories if needed
    const categoryDirVi = path.join(SPECS_DIR_VI, product.category);
    const categoryDirEn = path.join(SPECS_DIR_EN, product.category);
    ensureDir(categoryDirVi);
    ensureDir(categoryDirEn);
    
    // Find English slugs for related products
    const relatedProductsEn = relatedProducts.map(slug => {
      const relatedProduct = productsDataVi.products.find((p: any) => p.slug === slug);
      return relatedProduct?.nameEn ? generateEnglishSlug(slug, translateProductName(relatedProduct.name)) : slug;
    });
    
    const complementaryProductsEn = complementaryProducts.map(slug => {
      const relatedProduct = productsDataVi.products.find((p: any) => p.slug === slug);
      return relatedProduct?.nameEn ? generateEnglishSlug(slug, translateProductName(relatedProduct.name)) : slug;
    });
    
    // Use slug as filename for easier tracking
    const specFilenameVi = `${product.slug}.md`;
    const specFilenameEn = `${product.slugEn}.md`;
    
    // Vietnamese spec file
    const specPathVi = path.join(categoryDirVi, specFilenameVi);
    const markdownVi = generateMarkdownSpec(product, false, relatedProducts, complementaryProducts);
    fs.writeFileSync(specPathVi, markdownVi, 'utf-8');
    console.log(`   ✅ VI Spec created: ${specPathVi}`);
    
    // English spec file
    const specPathEn = path.join(categoryDirEn, specFilenameEn);
    const markdownEn = generateMarkdownSpec(product, true, relatedProductsEn, complementaryProductsEn);
    fs.writeFileSync(specPathEn, markdownEn, 'utf-8');
    console.log(`   ✅ EN Spec created: ${specPathEn}`);
    
    // Update Vietnamese products.json
    const existingIndexVi = productsDataVi.products.findIndex((p: any) => p.slug === product.slug);
    
    // Add extra tag if provided
    const viTags = extraTag ? [...product.tags, ...extraTag.split(',').map(tag => tag.trim())] : product.tags;
    
    const productEntryVi = {
      slug: product.slug,
      name: product.name,
      nameEn: product.nameEn,
      category: product.category,
      type: product.type,
      capacity: product.capacity,
      excerpt: product.excerpt,
      image: product.image,
      specsId: specsIdWithSlug,
      featured: false,
      tags: viTags,
      price: product.price,
      minOrder: product.minOrder,
      relatedProducts,
      complementaryProducts,
    };
    
    if (existingIndexVi >= 0) {
      productsDataVi.products[existingIndexVi] = { ...productsDataVi.products[existingIndexVi], ...productEntryVi };
    } else {
      productsDataVi.products.push(productEntryVi);
    }
    
    productsDataVi.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(PRODUCTS_JSON_VI, JSON.stringify(productsDataVi, null, 2), 'utf-8');
    console.log(`   ✅ VI products.json updated`);
    
    // Update English products.json
    const existingIndexEn = productsDataEn.products.findIndex((p: any) => p.slug === product.slugEn);
    
    // Add translated extra tag if provided
    const enTags = extraTag ? [...product.tagsEn, ...extraTag.split(',').map(tag => translateProductName(tag.trim()))] : product.tagsEn;
    
    const productEntryEn = {
      slug: product.slugEn,
      name: product.nameEn,
      nameVi: product.name,
      category: product.category,
      type: product.type,
      capacity: product.capacity,
      excerpt: product.excerptEn,
      image: product.image,
      specsId: specsIdWithSlugEn,
      featured: false,
      tags: enTags,
      price: translateProductName(product.price),
      minOrder: product.minOrder,
      relatedProducts: relatedProductsEn,
      complementaryProducts: complementaryProductsEn,
    };
    
    if (existingIndexEn >= 0) {
      productsDataEn.products[existingIndexEn] = { ...productsDataEn.products[existingIndexEn], ...productEntryEn };
    } else {
      productsDataEn.products.push(productEntryEn);
    }
    
    productsDataEn.lastUpdated = new Date().toISOString().split('T')[0];
    fs.writeFileSync(PRODUCTS_JSON_EN, JSON.stringify(productsDataEn, null, 2), 'utf-8');
    console.log(`   ✅ EN products.json updated`);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('\n📁 Files created/updated:');
    console.log(`   - ${specPathVi}`);
    console.log(`   - ${specPathEn}`);
    console.log(`   - ${PRODUCTS_JSON_VI}`);
    console.log(`   - ${PRODUCTS_JSON_EN}`);
    
  } finally {
    await browser.close();
  }
}

// Main
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error('Usage: npx tsx scripts/migrate/scraper.ts <product-url> [--tag <tag-name>]');
    console.error('Example: npx tsx scripts/migrate/scraper.ts https://packbn.com/product/coc-2-lop-kraft-9oz-260ml/');
    console.error('Example: npx tsx scripts/migrate/scraper.ts https://packbn.com/product/to-giay-kraft-nau-32oz-1000ml --tag "bát phở"');
    process.exit(1);
  }
  
  // Parse --tag argument
  let extraTag: string | undefined;
  const tagIndex = process.argv.indexOf('--tag');
  if (tagIndex !== -1 && process.argv[tagIndex + 1]) {
    extraTag = process.argv[tagIndex + 1];
  }
  
  if (extraTag) {
    console.log(`🏷️  Extra tag provided: "${extraTag}"`);
  }
  
  await migrateProduct(url, extraTag);
}

main().catch(console.error);
