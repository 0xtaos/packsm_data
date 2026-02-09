#!/usr/bin/env node
/**
 * Generate blog index.json from markdown files
 * Scans news/*.md files and creates an index sorted by date (descending)
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../');
const NEWS_DIR = path.join(ROOT_DIR, '/news');
const INDEX_FILE = path.join(NEWS_DIR, 'index.json');

// Blog post metadata interface
interface BlogPostMeta {
  category: string;
  slug: string;
  title: string;
  image: string;
  excerpt: string;
  date: string;
  author: string;
  readTime?: string;
}

// Index file structure
interface BlogIndex {
  meta: {
    generatedAt: string;
    totalPosts: number;
  };
  posts: BlogPostMeta[];
}

// Extract excerpt from markdown content (first 200 chars)
function extractExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown syntax
  const plainText = content
    .replace(/#+\s/g, '') // Remove headings
    .replace(/\*\*/g, '') // Remove bold
    .replace(/\*/g, '') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/\n+/g, ' ') // Replace newlines with space
    .trim();
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  // Cut at word boundary
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return truncated.substring(0, lastSpace) + '...';
}

// Calculate read time (average 200 words per minute)
function calculateReadTime(content: string): string {
  const wordCount = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200);
  return `${minutes} min read`;
}

// Parse date string to Date object (handle various formats)
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try parsing as ISO date
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Try Vietnamese date format (DD/MM/YYYY or DD-MM-YYYY)
  const vnMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (vnMatch) {
    const [, day, month, year] = vnMatch;
    date = new Date(`${year}-${month}-${day}`);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  return null;
}

// Format date to YYYY-MM-DD
function formatDate(date: Date | null): string {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
}

// Generate category from title using keywords
function generateCategory(title: string): string {
  const titleLower = title.toLowerCase();
  
  // Category mapping based on keywords
  if (titleLower.includes('cốc giấy') || titleLower.includes('ly giấy') || titleLower.includes('tô giấy')) {
    return 'Sản phẩm';
  }
  if (titleLower.includes('ống hút')) {
    return 'Sản phẩm';
  }
  if (titleLower.includes('quai xách')) {
    return 'Phụ kiện';
  }
  if (titleLower.includes('dao') || titleLower.includes('nĩa') || titleLower.includes('thìa')) {
    return 'Sản phẩm gỗ';
  }
  if (titleLower.includes('môi trường') || titleLower.includes('rác thải') || titleLower.includes('bảo vệ')) {
    return 'Môi trường';
  }
  if (titleLower.includes('kích thước') || titleLower.includes('tiêu chuẩn') || titleLower.includes('đặc điểm')) {
    return 'Hướng dẫn';
  }
  
  return 'Tin tức';
}

// Main function to generate index
async function generateIndex(): Promise<void> {
  console.log('🚀 Generating blog index...\n');
  
  // Check if news directory exists
  if (!fs.existsSync(NEWS_DIR)) {
    console.error(`❌ News directory not found: ${NEWS_DIR}`);
    process.exit(1);
  }
  
  // Get all markdown files
  const files = fs.readdirSync(NEWS_DIR)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(NEWS_DIR, file));
  
  console.log(`📄 Found ${files.length} markdown files`);
  
  const posts: BlogPostMeta[] = [];
  
  for (const filePath of files) {
    const filename = path.basename(filePath);
    const slug = filename.replace('.md', '');
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { data, content: markdownContent } = matter(content);
      
      // Extract fields from frontmatter
      const title = data.title || '';
      const dateStr = data.date || '';
      const author = data.author || 'PackBN Team';
      const featuredImage = data.featuredImage || '';
      
      // Parse date
      const parsedDate = parseDate(dateStr);
      const formattedDate = formatDate(parsedDate);
      
      // Generate excerpt (use frontmatter excerpt or extract from content)
      const excerpt = data.excerpt || extractExcerpt(markdownContent);
      
      // Generate category
      const category = data.category || generateCategory(title);
      
      // Calculate read time
      const readTime = calculateReadTime(markdownContent);
      
      posts.push({
        category,
        slug,
        title,
        image: featuredImage,
        excerpt,
        date: formattedDate,
        author,
        readTime
      });
      
      console.log(`  ✓ ${slug}`);
      
    } catch (error) {
      console.error(`  ❌ Error processing ${filename}:`, error);
    }
  }
  
  // Sort by date (descending - newest first)
  // Posts with no date will be at the end
  posts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
  
  // Create index object
  const index: BlogIndex = {
    meta: {
      generatedAt: new Date().toISOString(),
      totalPosts: posts.length
    },
    posts
  };
  
  // Write index file
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ Index generated successfully!');
  console.log(`   Total posts: ${posts.length}`);
  console.log(`   Output file: ${INDEX_FILE}`);
  console.log(`   Generated at: ${index.meta.generatedAt}`);
  
  // Show first 5 posts
  if (posts.length > 0) {
    console.log('\n📋 Latest 5 posts:');
    posts.slice(0, 5).forEach((post, i) => {
      console.log(`   ${i + 1}. [${post.date || 'No date'}] ${post.title}`);
    });
  }
}

// Run
generateIndex().catch(error => {
  console.error('❌ Failed to generate index:', error);
  process.exit(1);
});
