#!/usr/bin/env node
/**
 * Blog Migration Script using Playwright
 * Scrapes blog posts from packbn.com/tin-tuc/ and generates:
 * 1. Markdown files in public/news/
 * 2. Downloaded images in public/news/images/
 */

import { chromium, type Page, type Browser } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../..');
const NEWS_DIR = path.join(ROOT_DIR, 'public/news');
const IMAGES_DIR = path.join(ROOT_DIR, 'public/news/images');

// Types
interface BlogPost {
  url: string;
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  content: string;
  images: ImageInfo[];
  featuredImage: string | null;
}

interface ImageInfo {
  originalUrl: string;
  filename: string;
  localPath: string;
}

// Helper functions
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractSlugFromUrl(url: string): string {
  const match = url.match(/packbn\.com\/([^\/]+)\/$/);
  return match ? match[1] : '';
}

async function downloadImage(imageUrl: string, outputPath: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn(`  ⚠️ Failed to download image: ${imageUrl}`);
      return false;
    }
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    console.warn(`  ⚠️ Error downloading image: ${imageUrl}`, error);
    return false;
  }
}

// Extract all blog post URLs from the listing page
async function extractBlogUrls(page: Page, listingUrl: string): Promise<string[]> {
  console.log(`🔍 Extracting blog URLs from: ${listingUrl}`);
  
  await page.goto(listingUrl, { waitUntil: 'networkidle' });
  
  // Wait for posts to load
  await page.waitForSelector('article.elementor-post', { timeout: 10000 });
  
  const urls = await page.evaluate(() => {
    const links: string[] = [];
    const articles = document.querySelectorAll('article.elementor-post');
    
    articles.forEach(article => {
      const link = article.querySelector('a.elementor-post__thumbnail__link');
      if (link) {
        const href = link.getAttribute('href');
        if (href && !href.includes('/page/') && !href.includes('/tin-tuc/')) {
          links.push(href);
        }
      }
    });
    
    return links;
  });
  
  // Remove duplicates
  const uniqueUrls = [...new Set(urls)];
  console.log(`  ✅ Found ${uniqueUrls.length} blog posts`);
  
  return uniqueUrls;
}

// Extract blog post content
async function extractBlogPost(page: Page, url: string): Promise<BlogPost | null> {
  console.log(`📄 Extracting: ${url}`);
  
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Wait for content to load
    await page.waitForSelector('.elementor-widget-theme-post-content, .entry-content', { timeout: 10000 });
    
    const postData = await page.evaluate(() => {
      // Extract title
      const titleEl = document.querySelector('h1.elementor-heading-title, h1.entry-title');
      const title = titleEl ? titleEl.textContent?.trim() || '' : '';
      
      // Extract date from multiple possible selectors
      const dateSelectors = [
        '.elementor-post__meta-data .elementor-post-date',
        '.entry-date',
        'time.entry-date',
        '.posted-on time',
        '.post-date',
        'meta[property="article:published_time"]'
      ];
      let date = '';
      for (const selector of dateSelectors) {
        const dateEl = document.querySelector(selector);
        if (dateEl) {
          if (selector.includes('meta')) {
            date = dateEl.getAttribute('content') || '';
          } else {
            date = dateEl.textContent?.trim() || dateEl.getAttribute('datetime') || '';
          }
          if (date) break;
        }
      }
      
      // Extract author
      const authorEl = document.querySelector('.elementor-post__meta-data .elementor-post-author, .author');
      const author = authorEl ? authorEl.textContent?.trim() || '' : '';
      
      // Extract excerpt
      const excerptEl = document.querySelector('.elementor-post__excerpt p');
      const excerpt = excerptEl ? excerptEl.textContent?.trim() || '' : '';
      
      // Extract content
      const contentEl = document.querySelector('.elementor-widget-theme-post-content .elementor-widget-container, .entry-content');
      let content = '';
      if (contentEl) {
        // Clone to avoid modifying original
        const clone = contentEl.cloneNode(true) as HTMLElement;
        
        // Remove unwanted elements
        const unwanted = clone.querySelectorAll('.sharedaddy, .jp-relatedposts, script, style, iframe, .elementor-post__thumbnail__link, .wp-block-embed');
        unwanted.forEach(el => el.remove());
        
        content = clone.innerHTML;
      }
      
      // Extract featured image
      const featuredImgEl = document.querySelector('.elementor-post__thumbnail img, .featured-image img');
      const featuredImage = featuredImgEl ? featuredImgEl.getAttribute('src') : null;
      
      // Extract all images
      const images: string[] = [];
      const imgElements = contentEl?.querySelectorAll('img') || [];
      imgElements.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.includes('static.xx.fbcdn.net') && !src.includes('emoji')) {
          images.push(src);
        }
      });
      
      return { title, date, author, excerpt, content, images, featuredImage };
    });
    
    const slug = extractSlugFromUrl(url);
    
    return {
      url,
      slug,
      title: postData.title,
      date: postData.date,
      author: postData.author,
      excerpt: postData.excerpt,
      content: postData.content,
      images: postData.images.map((img, index) => {
        const urlObj = new URL(img, url);
        const originalUrl = urlObj.href;
        const ext = path.extname(urlObj.pathname) || '.jpg';
        const filename = `${slug}-image-${index + 1}${ext}`;
        return {
          originalUrl,
          filename,
          localPath: `/news/images/${filename}`
        };
      }),
      featuredImage: postData.featuredImage
    };
    
  } catch (error) {
    console.error(`  ❌ Error extracting ${url}:`, error);
    return null;
  }
}

// Convert HTML content to Markdown
function htmlToMarkdown(html: string, post: BlogPost): string {
  let markdown = html;
  
  // Replace image tags with markdown
  markdown = markdown.replace(/<figure[^>]*>.*?<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>.*?<figcaption[^>]*>([^<]*)<\/figcaption>.*?<\/figure>/gis, (match, src, alt, caption) => {
    const imageInfo = post.images.find(img => img.originalUrl === src || src.includes(img.filename.split('-image-')[0]));
    if (imageInfo) {
      const altText = alt || caption || 'Image';
      const captionText = caption ? `\n*${caption}*` : '';
      return `![${altText}](${imageInfo.localPath})${captionText}`;
    }
    return '';
  });
  
  // Replace simple img tags
  markdown = markdown.replace(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/gi, (match, src, alt) => {
    const imageInfo = post.images.find(img => img.originalUrl === src);
    if (imageInfo) {
      return `![${alt || 'Image'}](${imageInfo.localPath})`;
    }
    return '';
  });
  
  // Replace headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');
  
  // Replace paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  
  // Replace strong/b
  markdown = markdown.replace(/<(strong|b)[^>]*>(.*?)<\/(strong|b)>/gi, '**$2**');
  
  // Replace em/i
  markdown = markdown.replace(/<(em|i)[^>]*>(.*?)<\/(em|i)>/gi, '*$2*');
  
  // Replace links
  markdown = markdown.replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Replace lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').trim();
      return `- ${text}`;
    }).join('\n') + '\n\n';
  });
  
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gi) || [];
    let counter = 1;
    return items.map((item: string) => {
      const text = item.replace(/<li[^>]*>(.*?)<\/li>/i, '$1').trim();
      return `${counter++}. ${text}`;
    }).join('\n') + '\n\n';
  });
  
  // Replace line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  
  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#8211;/g, '–');
  markdown = markdown.replace(/&#8212;/g, '—');
  markdown = markdown.replace(/&#8216;/g, "'");
  markdown = markdown.replace(/&#8217;/g, "'");
  markdown = markdown.replace(/&#8220;/g, '"');
  markdown = markdown.replace(/&#8221;/g, '"');
  markdown = markdown.replace(/&#8230;/g, '...');
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();
  
  return markdown;
}

// Generate markdown file content
function generateMarkdown(post: BlogPost): string {
  const frontmatter = [
    '---',
    `title: "${post.title.replace(/"/g, '\\"')}"`,
    `slug: "${post.slug}"`,
    `date: "${post.date}"`,
    post.author ? `author: "${post.author}"` : '',
    post.excerpt ? `excerpt: "${post.excerpt.replace(/"/g, '\\"').substring(0, 200)}"` : '',
    post.featuredImage ? `featuredImage: "/news/images/${post.slug}-featured.jpg"` : '',
    '---',
    ''
  ].filter(Boolean).join('\n');
  
  const markdownContent = htmlToMarkdown(post.content, post);
  
  return frontmatter + '\n' + markdownContent + '\n';
}

// Main migration function
async function migrateBlogs(): Promise<void> {
  console.log('🚀 Starting blog migration...\n');
  
  // Ensure directories exist
  ensureDir(NEWS_DIR);
  ensureDir(IMAGES_DIR);
  
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage();
    
    // Get all blog URLs from all pages
    const allUrls: string[] = [];
    let pageNum = 1;
    let hasMorePages = true;
    
    while (hasMorePages && pageNum <= 5) { // Limit to 5 pages for safety
      const listingUrl = pageNum === 1 
        ? 'https://packbn.com/tin-tuc/' 
        : `https://packbn.com/tin-tuc/page/${pageNum}/`;
      
      try {
        const urls = await extractBlogUrls(page, listingUrl);
        if (urls.length === 0) {
          hasMorePages = false;
        } else {
          allUrls.push(...urls);
          pageNum++;
        }
      } catch (error) {
        console.log(`  ⚠️ No more pages found at page ${pageNum}`);
        hasMorePages = false;
      }
    }
    
    // Remove duplicates
    const uniqueUrls = [...new Set(allUrls)];
    console.log(`\n📊 Total unique blog posts to migrate: ${uniqueUrls.length}\n`);
    
    // Process each blog post
    const results = {
      success: 0,
      failed: 0,
      imagesDownloaded: 0
    };
    
    for (let i = 0; i < uniqueUrls.length; i++) {
      const url = uniqueUrls[i];
      console.log(`\n[${i + 1}/${uniqueUrls.length}] Processing: ${url}`);
      
      const post = await extractBlogPost(page, url);
      
      if (!post) {
        results.failed++;
        continue;
      }
      
      // Download images
      console.log(`  📥 Downloading ${post.images.length} images...`);
      for (const image of post.images) {
        const imagePath = path.join(IMAGES_DIR, image.filename);
        if (!fs.existsSync(imagePath)) {
          const success = await downloadImage(image.originalUrl, imagePath);
          if (success) {
            results.imagesDownloaded++;
            console.log(`    ✓ ${image.filename}`);
          }
        } else {
          console.log(`    ⏭️ ${image.filename} (exists)`);
        }
      }
      
      // Download featured image if exists
      if (post.featuredImage) {
        const featuredExt = path.extname(new URL(post.featuredImage).pathname) || '.jpg';
        const featuredFilename = `${post.slug}-featured${featuredExt}`;
        const featuredPath = path.join(IMAGES_DIR, featuredFilename);
        if (!fs.existsSync(featuredPath)) {
          const success = await downloadImage(post.featuredImage, featuredPath);
          if (success) {
            results.imagesDownloaded++;
            console.log(`    ✓ Featured: ${featuredFilename}`);
          }
        }
      }
      
      // Generate and save markdown
      const markdown = generateMarkdown(post);
      const markdownPath = path.join(NEWS_DIR, `${post.slug}.md`);
      fs.writeFileSync(markdownPath, markdown, 'utf-8');
      console.log(`  ✍️ Saved: ${post.slug}.md`);
      
      results.success++;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed!');
    console.log(`   Posts migrated: ${results.success}`);
    console.log(`   Posts failed: ${results.failed}`);
    console.log(`   Images downloaded: ${results.imagesDownloaded}`);
    console.log(`   Output directory: ${NEWS_DIR}`);
    console.log(`   Images directory: ${IMAGES_DIR}`);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
  } finally {
    await browser.close();
  }
}

// Run migration
migrateBlogs().catch(console.error);
