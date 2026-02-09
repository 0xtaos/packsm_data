#!/usr/bin/env node

/**
 * Image Compressor for Web - Node.js version using Sharp
 * Yêu cầu: npm install sharp glob
 * 
 * Cách dùng:
 *   node image-compress.js [options] <input>
 * 
 * Ví dụ:
 *   node image-compress.js ./photo.jpg
 *   node image-compress.js -r ./images/
 *   node image-compress.js -w 1920 --webp ./gallery/
 */

const fs = require('fs');
const path = require('path');

// Kiểm tra sharp đã được cài đặt chưa
try {
    var sharp = require('sharp');
} catch (e) {
    console.error('❌ Lỗi: Chưa cài đặt thư viện sharp');
    console.error('   Vui lòng chạy: npm install sharp glob');
    process.exit(1);
}

try {
    var { glob } = require('glob');
} catch (e) {
    console.error('❌ Lỗi: Chưa cài đặt thư viện glob');
    console.error('   Vui lòng chạy: npm install sharp glob');
    process.exit(1);
}

// Màu sắc cho output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

// Default settings
const config = {
    qualityJpg: 85,
    qualityPng: 80,
    qualityWebp: 80,
    outputDir: '',
    backup: false,
    overwrite: false,
    recursive: false,
    maxWidth: null,
    maxHeight: null,
    convertWebp: false
};

// =============================================================================
// Helper functions
// =============================================================================

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
}

function calculateReduction(original, compressed) {
    if (original === 0) return 0;
    return ((1 - compressed / original) * 100).toFixed(1);
}

function log(type, message) {
    const prefix = {
        info: `${colors.blue}[INFO]${colors.reset}`,
        success: `${colors.green}[OK]${colors.reset}`,
        warn: `${colors.yellow}[WARN]${colors.reset}`,
        error: `${colors.red}[ERROR]${colors.reset}`
    };
    console.log(`${prefix[type]} ${message}`);
}

function showHelp() {
    console.log(`
${colors.cyan}Image Compressor for Web - Node.js Version${colors.reset}

USAGE:
    node image-compress.js [OPTIONS] <file_or_directory>

OPTIONS:
    -h, --help              Hiển thị help này
    -q, --quality NUM       Chất lượng JPG (1-100, default: 85)
    -p, --png-quality NUM   Chất lượng PNG (1-100, default: 80)
    -o, --output DIR        Thư mục output
    -b, --backup            Tạo backup file gốc (.backup)
    -r, --recursive         Xử lý đệ quy thư mục con
    -w, --max-width PIXEL   Resize nếu width > PIXEL
    --max-height PIXEL      Resize nếu height > PIXEL
    --webp                  Tạo thêm file WebP
    --webp-quality NUM      Chất lượng WebP (1-100, default: 80)
    --overwrite             Ghi đè file output nếu đã tồn tại

EXAMPLES:
    # Nén 1 file
    node image-compress.js image.png

    # Nén với chất lượng cao
    node image-compress.js -q 95 photo.jpg

    # Nén cả thư mục + tạo WebP
    node image-compress.js -r --webp ./images/

    # Nén + resize cho web
    node image-compress.js -w 1920 --webp ./gallery/

${colors.yellow}Cài đặt thư viện cần thiết:${colors.reset}
    npm install sharp glob
`);
}

function parseArgs(args) {
    const result = { ...config, input: null };
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
            case '-h':
            case '--help':
                showHelp();
                process.exit(0);
                break;
            case '-q':
            case '--quality':
                result.qualityJpg = parseInt(args[++i], 10);
                break;
            case '-p':
            case '--png-quality':
                result.qualityPng = parseInt(args[++i], 10);
                break;
            case '-o':
            case '--output':
                result.outputDir = args[++i];
                break;
            case '-b':
            case '--backup':
                result.backup = true;
                break;
            case '-r':
            case '--recursive':
                result.recursive = true;
                break;
            case '-w':
            case '--max-width':
                result.maxWidth = parseInt(args[++i], 10);
                break;
            case '--max-height':
                result.maxHeight = parseInt(args[++i], 10);
                break;
            case '--webp':
                result.convertWebp = true;
                break;
            case '--webp-quality':
                result.qualityWebp = parseInt(args[++i], 10);
                break;
            case '--overwrite':
                result.overwrite = true;
                break;
            default:
                if (!arg.startsWith('-') && !result.input) {
                    result.input = arg;
                }
                break;
        }
    }
    
    return result;
}

// =============================================================================
// Compression functions
// =============================================================================

async function compressImage(inputPath, outputPath, options) {
    const ext = path.extname(inputPath).toLowerCase();
    const originalSize = fs.statSync(inputPath).size;
    
    log('info', `Đang nén: ${path.basename(inputPath)} (${formatSize(originalSize)})`);
    
    let pipeline = sharp(inputPath);
    
    // Lấy metadata để kiểm tra kích thước
    const metadata = await pipeline.metadata();
    
    // Resize nếu cần
    if (options.maxWidth || options.maxHeight) {
        pipeline = pipeline.resize({
            width: options.maxWidth || undefined,
            height: options.maxHeight || undefined,
            fit: 'inside',
            withoutEnlargement: true
        });
    }
    
    // Áp dụng format và compression
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            pipeline = pipeline.jpeg({
                quality: options.qualityJpg,
                progressive: true,
                mozjpeg: true
            });
            break;
        case '.png':
            pipeline = pipeline.png({
                quality: options.qualityPng,
                compressionLevel: 9,
                progressive: true
            });
            break;
    }
    
    // Đảm bảo thư mục output tồn tại
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Lưu file
    await pipeline.toFile(outputPath);
    
    const newSize = fs.statSync(outputPath).size;
    const reduction = calculateReduction(originalSize, newSize);
    
    log('success', `✓ ${path.basename(inputPath)}: ${formatSize(originalSize)} → ${formatSize(newSize)} (-${reduction}%)`);
    
    // Tạo WebP nếu được yêu cầu
    if (options.convertWebp) {
        const webpPath = outputPath.replace(/\.(jpg|jpeg|png)$/i, '.webp');
        await createWebp(inputPath, webpPath, options);
    }
}

async function createWebp(inputPath, outputPath, options) {
    log('info', `  → Tạo WebP: ${path.basename(outputPath)}`);
    
    let pipeline = sharp(inputPath);
    
    // Resize nếu cần
    if (options.maxWidth || options.maxHeight) {
        pipeline = pipeline.resize({
            width: options.maxWidth || undefined,
            height: options.maxHeight || undefined,
            fit: 'inside',
            withoutEnlargement: true
        });
    }
    
    await pipeline
        .webp({ quality: options.qualityWebp, effort: 6 })
        .toFile(outputPath);
    
    const webpSize = fs.statSync(outputPath).size;
    const originalSize = fs.statSync(inputPath).size;
    const reduction = calculateReduction(originalSize, webpSize);
    log('success', `  ✓ WebP: ${formatSize(originalSize)} → ${formatSize(webpSize)} (-${reduction}%)`);
}

async function processFile(filePath, options) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
        log('warn', `Bỏ qua định dạng không hỗ trợ: ${path.basename(filePath)}`);
        return;
    }
    
    // Xác định output path
    let outputPath;
    if (options.outputDir) {
        const filename = path.basename(filePath);
        outputPath = path.join(options.outputDir, filename);
    } else {
        outputPath = filePath;
        if (options.backup && fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, `${filePath}.backup`);
        }
    }
    
    // Kiểm tra file đã tồn tại
    if (!options.overwrite && options.outputDir && fs.existsSync(outputPath)) {
        log('warn', `Bỏ qua (đã tồn tại): ${path.basename(filePath)}`);
        return;
    }
    
    try {
        await compressImage(filePath, outputPath, options);
    } catch (err) {
        log('error', `Lỗi khi nén ${path.basename(filePath)}: ${err.message}`);
    }
}

async function processDirectory(dirPath, options) {
    const pattern = options.recursive 
        ? `${dirPath}/**/*.{jpg,jpeg,png}` 
        : `${dirPath}/*.{jpg,jpeg,png}`;
    
    const files = await glob(pattern, { nocase: true });
    
    log('info', `Tìm thấy ${files.length} file ảnh`);
    
    for (const file of files) {
        await processFile(file, options);
    }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        showHelp();
        process.exit(1);
    }
    
    const options = parseArgs(args);
    
    if (!options.input) {
        log('error', 'Thiếu đường dẫn file hoặc thư mục!');
        showHelp();
        process.exit(1);
    }
    
    if (!fs.existsSync(options.input)) {
        log('error', `File hoặc thư mục không tồn tại: ${options.input}`);
        process.exit(1);
    }
    
    // Tạo output directory nếu cần
    if (options.outputDir && !fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
    }
    
    // Hiển thị thông tin
    console.log('\n========================================');
    console.log('  Image Compressor for Web (Node.js)');
    console.log('========================================');
    console.log(`Input:        ${options.input}`);
    console.log(`JPG Quality:  ${options.qualityJpg}`);
    console.log(`PNG Quality:  ${options.qualityPng}`);
    if (options.outputDir) console.log(`Output:       ${options.outputDir}`);
    if (options.maxWidth) console.log(`Max Width:    ${options.maxWidth}px`);
    if (options.maxHeight) console.log(`Max Height:   ${options.maxHeight}px`);
    if (options.convertWebp) console.log(`WebP Quality: ${options.qualityWebp}`);
    console.log('----------------------------------------');
    
    // Xử lý
    const stats = fs.statSync(options.input);
    if (stats.isDirectory()) {
        await processDirectory(options.input, options);
    } else {
        await processFile(options.input, options);
    }
    
    console.log('----------------------------------------');
    log('success', 'Hoàn thành!');
}

main().catch(err => {
    log('error', err.message);
    process.exit(1);
});
