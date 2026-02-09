// scripts/publish-assets.ts
import fs from "fs";
import path from "path";
import crypto from "crypto";
import "dotenv/config"; // Load env vars
import matter from "gray-matter";
import sharp from "sharp";
import { imageSize } from "image-size";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ROOT = process.argv[2] || "contents-draft";
const ASSET_PREFIX = "/assets/";

const INDEX_DIR = "contents/index";
const MANIFEST_FILE = path.join(INDEX_DIR, "assets-manifest.json");

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET || !process.env.R2_PUBLIC_BASE) {
  console.error("❌ Missing R2 environment variables. Please check your .env file or CI secrets.");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.R2_BUCKET;
const PUBLIC = process.env.R2_PUBLIC_BASE;

console.log(`Using S3 Bucket: ${BUCKET}, Public Base: ${PUBLIC}`);

const manifest = fs.existsSync(MANIFEST_FILE)
  ? JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"))
  : {};

function sha1(buf: Buffer) {
  return crypto.createHash("sha1").update(buf).digest("hex");
}

async function upload(key: string, body: Buffer, type: string) {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: type
    })
  );
  return `${PUBLIC}/${key}`;
}

async function processImage(abs: string) {
  const buffer = fs.readFileSync(abs);
  const hash = sha1(buffer);

  if (manifest[hash]) return manifest[hash];

  const { width, height } = imageSize(buffer);

  const webp = await sharp(buffer).webp({ quality: 80 }).toBuffer();
  // const avif = await sharp(buffer).avif({ quality: 50 }).toBuffer();
  const blurBuf = await sharp(buffer).resize(20).blur().toBuffer();

  const base = `posts/${hash}`;

  console.log(`Uploading asset: ${abs} as ${base}`);

  const originalUrl = await upload(`${base}.jpg`, buffer, "image/jpeg");
  const webpUrl = await upload(`${base}.webp`, webp, "image/webp");
//   const avifUrl = await upload(`${base}.avif`, avif, "image/avif");

  const meta = {
    src: originalUrl,
    webp: webpUrl,
    // avif: avifUrl,
    blur: `data:image/jpeg;base64,${blurBuf.toString("base64")}`,
    width,
    height
  };

  manifest[hash] = meta;
  return meta;
}

function isAsset(src: string) {
  return src.startsWith(ASSET_PREFIX);
}

async function replaceAsync(str: string, regex: RegExp, asyncFn: (match: string, ...args: any[]) => Promise<string>) {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift()!);
}

function resolveAssetPath(src: string) {
  // If src starts with /assets/, it maps to the root assets directory
  if (src.startsWith("/assets/")) {
    const imageFile = path.join(process.cwd(), src.substring(1));
    console.log(`resolveAssetPath Mapping ${src} to ${imageFile}`);
    return imageFile;
  }
  return path.join(ROOT, src);
}

async function rewriteMarkdown(file: string) {
  console.log(`rewriteMarkdown Processing: ${file}`);
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = matter(raw);
  let changed = false;

  // thumbnail
  if (parsed.data.thumbnail?.src && isAsset(parsed.data.thumbnail.src)) {
    const abs = resolveAssetPath(parsed.data.thumbnail.src);
    if (fs.existsSync(abs)) {
        const meta = await processImage(abs);
        parsed.data.thumbnail = meta;
        changed = true;
    } else {
        console.warn(`⚠️ Asset not found: ${abs}`);
    }
  }

  // body images
  parsed.content = await replaceAsync(
    parsed.content,
    /!\[.*?\]\((\/assets\/[^)]+\.(?:jpg|jpeg|png|webp|avif|gif|svg))\)/gi,
    async (match, p1) => {
      const abs = resolveAssetPath(p1);
      if (fs.existsSync(abs)) {
          const meta = await processImage(abs);
          changed = true;
          return `![](${meta.src})`;
      } else {
          console.warn(`⚠️ Asset not found: ${abs}`);
          return match;
      }
    }
  );

  if (changed) {
    fs.writeFileSync(file, matter.stringify(parsed.content, parsed.data));
    console.log(`✨ Assets published for: ${file}`);
  }
}

async function walk(dir: string) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) await walk(full);
    else if (f.endsWith(".mdx")) await rewriteMarkdown(full);
  }
}

console.log('Publishing assets...');
await walk(ROOT);
fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
