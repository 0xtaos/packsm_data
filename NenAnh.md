# Image Compressor Scripts

Các script để nén ảnh PNG, JPG cho web - giúp giảm kích thước file mà vẫn giữ chất lượng tốt.

## 📁 Files

| File | Mô tả | Yêu cầu |
|------|-------|---------|
| `image-compress.sh` | Shell script dùng ImageMagick/pngquant/jpegoptim | ImageMagick (đã có sẵn) hoặc pngquant/jpegoptim |
| `image-compress.js` | Node.js script dùng Sharp | `npm install sharp glob` |

---

## 🚀 Quick Start

### Cách 1: Dùng Shell Script (không cần cài thêm gì nếu có ImageMagick)

```bash
# Nén 1 file
./scripts/image-compress.sh image.png

# Nén cả thư mục
./scripts/image-compress.sh -r ./images/

# Nén + resize + tạo WebP
./scripts/image-compress.sh -w 1920 --webp ./gallery/
```

### Cách 2: Dùng Node.js Script (khuyến nghị - chất lượng tốt hơn)

```bash
# Cài đặt dependencies (chỉ cần 1 lần)
npm install sharp glob

# Nén 1 file
node scripts/image-compress.js image.png

# Nén cả thư mục + tạo WebP
node scripts/image-compress.js -r --webp ./images/

# Nén với chất lượng cao nhất
node scripts/image-compress.js -q 95 --webp ./photos/
```

---

## 📋 Options

| Option | Mô tả |
|--------|-------|
| `-h, --help` | Hiển thị help |
| `-q, --quality NUM` | Chất lượng JPG (1-100, default: 85) |
| `-p, --png-quality NUM` | Chất lượng PNG (1-100, default: 80) |
| `-o, --output DIR` | Thư mục output (mặc định: ghi đè) |
| `-b, --backup` | Tạo backup file gốc (`.backup`) |
| `-r, --recursive` | Xử lý đệ quy thư mục con |
| `-w, --max-width PIXEL` | Resize nếu width > PIXEL |
| `--max-height PIXEL` | Resize nếu height > PIXEL |
| `--webp` | Tạo thêm file WebP |
| `--webp-quality NUM` | Chất lượng WebP (1-100, default: 80) |
| `--overwrite` | Ghi đè file nếu đã tồn tại |

---

## 💡 Ví dụ thực tế

### 1. Nén ảnh cho blog/web thông thường

```bash
# JPG quality 85, PNG quality 80 - phù hợp cho hầu hết website
./scripts/image-compress.sh -r -o ./compressed/ ./my-images/
```

### 2. Nén ảnh gallery chất lượng cao

```bash
# Quality cao hơn (90-95), giữ nguyên kích thước
./scripts/image-compress.sh -q 90 -p 90 -r -o ./gallery-optimized/ ./gallery/
```

### 3. Nén + resize cho mobile

```bash
# Giới hạn max-width 1200px, phù hợp cho mobile
./scripts/image-compress.sh -w 1200 -r ./uploads/
```

### 4. Tạo WebP cho tất cả ảnh (tối ưu nhất cho web)

```bash
# Tạo cả file gốc (nén) + file WebP
./scripts/image-compress.sh -r --webp ./images/

# Kết quả: có cả .jpg/.png (nén) và .webp (nhỏ hơn nhiều)
```

### 5. Workflow tối ưu cho production

```bash
# Bước 1: Resize + nén ảnh gốc
./scripts/image-compress.sh -w 1920 -q 85 -p 80 -r -o ./dist/images/ ./src/images/

# Bước 2: Tạo thêm WebP
./scripts/image-compress.sh -w 1920 --webp -r ./dist/images/

# Bước 3: Copy vào public (hoặc upload CDN)
cp -r ./dist/images/* ./public/images/
```

---

## 🔧 Cài đặt công cụ nâng cao (tùy chọn)

### Ubuntu/Debian
```bash
# Công cụ nén PNG/JPG chuyên dụng (tốt hơn ImageMagick)
sudo apt-get install pngquant jpegoptim webp
```

### macOS
```bash
brew install pngquant jpegoptim webp
```

### Windows (WSL)
```bash
# Trong WSL terminal
sudo apt-get install pngquant jpegoptim webp imagemagick
```

---

## 📊 So sánh công cụ

| Tool | PNG Compression | JPG Compression | Speed | Notes |
|------|-----------------|-----------------|-------|-------|
| **Sharp (Node.js)** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⚡⚡⚡⚡⚡ | Khuyến nghị - tốt nhất |
| **pngquant** | ⭐⭐⭐⭐⭐ | - | ⚡⚡⚡⚡ | Lossy, file nhỏ nhất |
| **jpegoptim** | - | ⭐⭐⭐⭐⭐ | ⚡⚡⚡⚡ | Lossless + lossy |
| **ImageMagick** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⚡⚡⚡ | Có sẵn trên hầu hết hệ thống |

---

## 🎯 Khuyến nghị chất lượng

| Use case | JPG Quality | PNG Quality | WebP Quality |
|----------|-------------|-------------|--------------|
| Thumbnails | 70-75 | 60-70 | 70 |
| Blog/Content | 80-85 | 75-80 | 80 |
| Gallery/Portfolio | 90-95 | 85-90 | 85-90 |
| E-commerce products | 85-90 | 80-85 | 85 |
| Hero banners | 90-95 | 85-90 | 85-90 |

---

## 🐛 Troubleshooting

### Lỗi: "Cannot find module 'sharp'"
```bash
npm install sharp glob
```

### Lỗi: "convert: command not found" (shell script)
```bash
# Ubuntu/Debian
sudo apt-get install imagemagick

# macOS
brew install imagemagick
```

### Permission denied
```bash
chmod +x scripts/image-compress.sh
chmod +x scripts/image-compress.js
```

---

## 📚 Tài liệu tham khảo

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [pngquant](https://pngquant.org/)
- [jpegoptim](https://github.com/tjko/jpegoptim)
- [WebP](https://developers.google.com/speed/webp)
