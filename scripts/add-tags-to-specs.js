#!/usr/bin/env node

/**
 * Script to add tags from products.json to gray matter (frontmatter) of corresponding spec markdown files
 * 
 * Usage: node scripts/add-tags-to-specs.js
 * 
 * This script:
 * 1. Reads products from public/data/vi/products.json and public/data/en/products.json
 * 2. For each product, extracts the specsId and tags
 * 3. Finds the corresponding .md file in public/data/{lang}/specs/{specsId}.md
 * 4. Adds/updates the tags field in the gray matter frontmatter
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

/**
 * Read and parse JSON file
 */
function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Process products for a specific language
 */
function processLanguage(lang) {
  console.log(`\n=== Processing language: ${lang} ===`);
  
  const productsFile = path.join(DATA_DIR, lang, 'products.json');
  const specsDir = path.join(DATA_DIR, lang, 'specs');
  
  // Check if products.json exists
  if (!fs.existsSync(productsFile)) {
    console.error(`Products file not found: ${productsFile}`);
    return;
  }
  
  // Read products
  const data = readJsonFile(productsFile);
  const products = data.products || [];
  
  console.log(`Found ${products.length} products`);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const product of products) {
    const { specsId, tags, name } = product;
    
    if (!specsId) {
      console.warn(`  Warning: Product "${name}" has no specsId, skipping`);
      errorCount++;
      continue;
    }
    
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      console.warn(`  Warning: Product "${name}" has no tags, skipping`);
      errorCount++;
      continue;
    }
    
    // Build spec file path (.md)
    const specFilePath = path.join(specsDir, `${specsId}.md`);
    
    // Check if spec file exists
    if (!fs.existsSync(specFilePath)) {
      console.warn(`  Warning: Spec file not found: ${specsId}.md`);
      skippedCount++;
      continue;
    }
    
    try {
      // Read the markdown file
      const fileContent = fs.readFileSync(specFilePath, 'utf-8');
      
      // Parse gray matter
      const parsed = matter(fileContent);
      
      // Check if tags already exist and are the same
      const existingTags = parsed.data.tags || [];
      const tagsEqual = JSON.stringify(existingTags.sort()) === JSON.stringify(tags.sort());
      
      if (tagsEqual) {
        console.log(`  Skipped (no change): ${specsId}.md`);
        skippedCount++;
        continue;
      }
      
      // Add/update tags in frontmatter
      parsed.data.tags = tags;
      
      // Stringify back to markdown with gray matter
      const updatedContent = matter.stringify(parsed.content, parsed.data);
      
      // Write back to file
      fs.writeFileSync(specFilePath, updatedContent, 'utf-8');
      
      console.log(`  Updated: ${specsId}.md`);
      updatedCount++;
    } catch (err) {
      console.error(`  Error processing ${specsId}.md: ${err.message}`);
      errorCount++;
    }
  }
  
  console.log(`\nSummary for ${lang}:`);
  console.log(`  Updated: ${updatedCount} files`);
  console.log(`  Skipped: ${skippedCount} files (no change or missing)`);
  console.log(`  Errors:  ${errorCount} issues`);
}

/**
 * Main function
 */
function main() {
  console.log('Adding tags to spec files (gray matter)...');
  console.log('==========================================');
  
  // Process Vietnamese
  processLanguage('vi');
  
  // Process English
  processLanguage('en');
  
  console.log('\nDone!');
}

// Run the script
main();
