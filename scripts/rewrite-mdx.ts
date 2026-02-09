// scripts/rewrite-md.ts
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const DRAFT_DIR = "contents-draft";
const PROD_DIR = "contents";

function movePublishedDrafts(dir: string) {
  if (!fs.existsSync(dir)) return;

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      movePublishedDrafts(fullPath);
    } else if (entry.endsWith(".mdx")) {
      const raw = fs.readFileSync(fullPath, "utf-8");
      const { data } = matter(raw);

      if (data.status === "published") {
        if (!data.category || !data.slug) {
            console.error(`❌ Missing category or slug in ${fullPath}. Skipping.`);
            continue;
        }

        const destDir = path.join(PROD_DIR, data.category);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const destPath = path.join(destDir, `${data.slug}.mdx`);
        
        // Copy content
        fs.writeFileSync(destPath, raw);
        
        // Delete draft
        fs.unlinkSync(fullPath);
        console.log(`🚀 Moved to production (and deleted draft): ${destPath}`);
      }
    }
  }
}

console.log("Checking for published drafts...");
movePublishedDrafts(DRAFT_DIR);
