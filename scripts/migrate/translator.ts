#!/usr/bin/env node
/**
 * Vietnamese to English Translator for Product Migration
 * Uses pattern-based translation with common product terms
 */

// Common product translation dictionary
const PRODUCT_TERMS: Record<string, string> = {
  // Products
  'Cốc giấy': 'Paper Cup',
  'Cốc 2 lớp': 'Double Wall Cup',
  'Tô giấy': 'Paper Bowl',
  'Tô trắng': 'White Paper Bowl',
  'Hộp giấy': 'Paper Box',
  'Đĩa giấy': 'Paper Plate',
  'Ống hút giấy': 'Paper Straw',
  'Thìa gỗ': 'Wooden Spoon',
  'Nĩa gỗ': 'Wooden Fork',
  'Dao gỗ': 'Wooden Knife',
  'Quai xách': 'Cup Carrier',
  'Quai xách ly': 'Cup Carrier',
  
  // Materials
  'giấy Kraft': 'Kraft Paper',
  'giấy trắng': 'White Paper',
  'giấy nâu': 'Brown Paper',
  '2 lớp': 'Double Wall',
  '2PE': 'Double PE',
  '1PE': 'Single PE',
  'không in': 'Plain',
  'có họa tiết': 'Pattern Printed',
  'in hoạ tiết': 'Pattern Printed',
  'in logo': 'Custom Printed',
  
  // Sizes
  'nhỏ': 'Small',
  'vừa': 'Medium',
  'lớn': 'Large',
  'cỡ lớn': 'Large Size',
  'cực lớn': 'Extra Large',
  'tiêu chuẩn': 'Standard',
  
  // Features
  'cách nhiệt': 'Insulated',
  'chống thấm': 'Leak-proof',
  'thân thiện môi trường': 'Eco-friendly',
  'phân hủy sinh học': 'Biodegradable',
  'tự nhiên': 'Natural',
  'an toàn thực phẩm': 'Food-safe',
  
  // Usage
  'cà phê': 'Coffee',
  'trà sữa': 'Bubble Tea',
  'phở': 'Pho',
  'bún': 'Noodles',
  'súp': 'Soup',
  'kem': 'Ice Cream',
  'sinh tố': 'Smoothie',
  'nước ép': 'Juice',
  'lẩu': 'Hot Pot',
  'cháo': 'Porridge',
  'salad': 'Salad',
  
  // Packaging
  'cái/xấp': 'pcs/sleeve',
  'cái/thùng': 'pcs/carton',
  'xấp': 'sleeve',
  'thùng': 'carton',
  
  // Other
  'Liên hệ': 'Contact us',
  'Mô tả sản phẩm': 'Product Description',
  'Đặc điểm kỹ thuật': 'Technical Specifications',
  'Thông số': 'Specifications',
  'Chi tiết': 'Details',
  'Dung tích': 'Capacity',
  'Chất liệu': 'Material',
  'Kích thước': 'Dimensions',
  'Trọng lượng': 'Weight',
  'Đường kính': 'Diameter',
  'Chiều cao': 'Height',
  'Đáy': 'Bottom',
  'Miệng': 'Top',
  'Sử dụng cho': 'Applications',
  'Lưu ý': 'Notes',
  'Bảo quản': 'Storage',
  'Lợi ích': 'Benefits',
  'Chứng nhận': 'Certifications',
  'Phi': 'Ø:',
  'que khuấy': 'Stirring stick',
  'Thìa gỗ': 'Wooden Spoon'
};

// Translate a Vietnamese product name to English
export function translateProductName(viName: string): string {
  let enName = viName;
  
  // Replace Vietnamese terms with English
  for (const [vi, en] of Object.entries(PRODUCT_TERMS)) {
    const regex = new RegExp(vi, 'gi');
    enName = enName.replace(regex, en);
  }
  
  // Extract capacity (e.g., "3oz ~ 90ml")
  const capacityMatch = enName.match(/(\d+oz\s*~?\s*\d+ml|\d+oz|\d+ml)/i);
  const capacity = capacityMatch ? capacityMatch[0] : '';
  
  // Clean up the name
  enName = enName
    .replace(/[~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return enName;
}

// Translate description
export function translateDescription(viDesc: string): string {
  let enDesc = viDesc;
  
  for (const [vi, en] of Object.entries(PRODUCT_TERMS)) {
    const regex = new RegExp(`\\b${vi}\\b`, 'gi');
    enDesc = enDesc.replace(regex, en);
  }
  
  // Additional context-aware translations
  const contextTranslations: Record<string, string> = {
    'là sản phẩm': 'is a product',
    'phù hợp cho': 'suitable for',
    'được thiết kế': 'designed',
    'với công nghệ': 'with technology',
    'chất lượng cao': 'high quality',
    'giá rẻ': 'affordable',
    'giá tốt': 'good price',
    'bán chạy': 'best seller',
    'phổ biến': 'popular',
  };
  
  for (const [vi, en] of Object.entries(contextTranslations)) {
    const regex = new RegExp(vi, 'gi');
    enDesc = enDesc.replace(regex, en);
  }
  
  return enDesc;
}

// Translate specifications
export function translateSpecs(specs: Array<{ label: string; value: string }>): Array<{ label: string; value: string }> {
  return specs.map(spec => ({
    label: PRODUCT_TERMS[spec.label] || spec.label,
    value: translateProductName(spec.value),
  }));
}

// Generate English slug from Vietnamese slug
export function generateEnglishSlug(viSlug: string, enName: string): string {
  // If the slug is already English-looking, return it
  if (!/[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(viSlug)) {
    return viSlug;
  }
  
  // Generate from English name
  return enName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
}

// Generate tags in English
export function translateTags(viTags: string[]): string[] {
  return viTags.map(tag => {
    // Direct translation
    if (PRODUCT_TERMS[tag]) return PRODUCT_TERMS[tag];
    
    // Partial translation
    let enTag = tag;
    for (const [vi, en] of Object.entries(PRODUCT_TERMS)) {
      const regex = new RegExp(`\\b${vi}\\b`, 'gi');
      enTag = enTag.replace(regex, en);
    }
    return enTag;
  });
}

// Translate category name
export function translateCategoryName(viName: string): string {
  const categoryMap: Record<string, string> = {
    'Ly & Cốc Giấy': 'Paper Cups',
    'Tô & Bát Giấy': 'Paper Bowls',
    'Ống Hút Giấy': 'Paper Straws',
    'Hộp Đựng Thực Phẩm': 'Food Containers',
    'Sản Phẩm Gỗ': 'Wooden Products',
    'Phụ Kiện': 'Accessories',
  };
  return categoryMap[viName] || viName;
}

// Translate full markdown content from VI to EN
export function translateMarkdownContent(viContent: string): string {
  let enContent = viContent;
  
  // Translate headers
  const headerMap: Record<string, string> = {
    '# Mô tả sản phẩm': '# Product Description',
    '## Mô tả sản phẩm': '## Product Description',
    '## Đặc điểm kỹ thuật': '## Technical Specifications',
    '## Thông số kỹ thuật': '## Technical Specifications',
    '## Sử dụng cho': '## Applications',
    '## Lợi ích': '## Benefits',
    '## Bảo quản': '## Storage',
    '## Lưu ý': '## Notes',
    '## Lưu ý sử dụng': '## Usage Notes',
  };
  
  for (const [vi, en] of Object.entries(headerMap)) {
    enContent = enContent.replace(new RegExp(vi, 'g'), en);
  }
  
  // Translate table headers
  enContent = enContent.replace(/\| Thông số \| Chi tiết \|/g, '| Specification | Details |');
  
  // Translate product terms
  for (const [vi, en] of Object.entries(PRODUCT_TERMS)) {
    const regex = new RegExp(`\\b${vi}\\b`, 'gi');
    enContent = enContent.replace(regex, en);
  }
  
  // Translate common phrases
  const phrases: Record<string, string> = {
    'Bảo quản nơi khô ráo': 'Store in a dry place',
    'tránh ánh nắng trực tiếp': 'avoid direct sunlight',
    'Nhiệt độ bảo quản': 'Storage temperature',
    'Hạn sử dụng': 'Shelf life',
    'kể từ ngày sản xuất': 'from manufacturing date',
    'Không sử dụng trong lò vi sóng': 'Do not use in microwave',
    'Thân thiện môi trường': 'Eco-friendly',
    'có thể in logo': 'custom printing available',
  };
  
  for (const [vi, en] of Object.entries(phrases)) {
    const regex = new RegExp(vi, 'gi');
    enContent = enContent.replace(regex, en);
  }
  
  return enContent;
}

// Generate English excerpt from Vietnamese
export function translateExcerpt(viExcerpt: string): string {
  return translateProductName(viExcerpt);
}
