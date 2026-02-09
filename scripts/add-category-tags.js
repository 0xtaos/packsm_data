#!/usr/bin/env node

/**
 * Script to dynamically generate union of all tags for each category
 * 
 * Usage: node scripts/add-category-tags.js
 * 
 * This script:
 * 1. Reads products from public/data/vi/products.json and public/data/en/products.json
 * 2. For each category, scans all products belonging to that category
 * 3. Creates a union of all unique tags from those products
 * 4. Adds a "tags" field to the category object with the union result
 * 5. Writes the updated products.json files back
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
 * Write JSON file with proper formatting
 */
function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * Generate union of tags for each category
 */
function processCategories(products, categories) {
  // Create a map of category id -> Set of tags
  const categoryTagsMap = new Map();
  
  // Initialize empty sets for each category
  for (const category of categories) {
    categoryTagsMap.set(category.id, new Set());
  }
  
  // Collect tags from all products
  for (const product of products) {
    const { category, tags } = product;
    
    if (!category || !tags || !Array.isArray(tags)) {
      continue;
    }
    
    const categoryTagSet = categoryTagsMap.get(category);
    if (categoryTagSet) {
      for (const tag of tags) {
        categoryTagSet.add(tag);
      }
    }
  }
  
  // Convert sets to sorted arrays and add to categories
  for (const category of categories) {
    const tagSet = categoryTagsMap.get(category.id);
    if (tagSet && tagSet.size > 0) {
      // Convert to array and sort alphabetically
      category.tags = Array.from(tagSet).sort();
    } else {
      category.tags = [];
    }
  }
  
  return categories;
}

/**
 * Process products for a specific language
 */
function processLanguage(lang) {
  console.log(`\n=== Processing language: ${lang} ===`);
  
  const productsFile = path.join(DATA_DIR, lang, 'products.json');
  
  // Check if products.json exists
  if (!fs.existsSync(productsFile)) {
    console.error(`Products file not found: ${productsFile}`);
    return;
  }
  
  // Read products data
  const data = readJsonFile(productsFile);
  const products = data.products || [];
  const categories = data.categories || [];
  
  console.log(`Found ${products.length} products and ${categories.length} categories`);
  
  // Process categories to add tags
  const updatedCategories = processCategories(products, categories);
  
  // Print summary
  console.log('\nCategory tags summary:');
  for (const category of updatedCategories) {
    console.log(`  ${category.id}: ${category.tags.length} unique tags`);
    if (category.tags.length > 0) {
      console.log(`    [${category.tags.join(', ')}]`);
    }
  }
  
  // Write updated data back
  data.categories = updatedCategories;
  writeJsonFile(productsFile, data);
  
  console.log(`\nUpdated ${productsFile}`);
}

/**
 * Main function
 */
function main() {
  console.log('Adding union of product tags to categories...');
  console.log('==============================================');
  
  // Process Vietnamese
  processLanguage('vi');
  
  // Process English
  processLanguage('en');
  
  console.log('\nDone!');
}

// Run the script
main();
