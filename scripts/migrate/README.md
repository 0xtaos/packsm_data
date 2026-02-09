# Blog Migration Scripts

Scripts để migrate blogs từ site WordPress cũ (packbn.com) sang site mới.

## Scripts

### `blogs.ts` - Migrate Blog Posts

Script này sẽ:
1. Lấy danh sách tất cả URL bài viết từ https://packbn.com/tin-tuc/
2. Với mỗi bài viết:
   - Trích xuất title, content, date, author, excerpt
   - Chuyển nội dung HTML sang Markdown
   - Download tất cả ảnh vào `public/news/images/`
   - Chỉnh sửa link ảnh trong markdown để trỏ đến local
   - Lưu file markdown vào `public/news/`

#### Cách chạy

```bash
npm run migrate:blogs
```

Hoặc chạy trực tiếp:

```bash
npx tsx scripts/migrate/blogs.ts
```

#### Output

- Markdown files: `public/news/{slug}.md`
- Images: `public/news/images/{slug}-image-{n}.jpg`

#### Format Markdown

Mỗi file markdown có frontmatter:

```yaml
---
title: "Tiêu đề bài viết"
slug: "slug-bai-viet"
date: "Ngày đăng"
author: "Tác giả"
excerpt: "Tóm tắt"
featuredImage: "/news/images/slug-featured.jpg"
---
```

## Helper Module

File `src/data/blogs.ts` cung cấp các hàm để làm việc với blog posts trong React app:

```typescript
import { loadBlogPost, loadAllBlogMeta, BLOG_SLUGS } from '@/data/blogs';

// Load một bài viết
const post = await loadBlogPost('dao-nia-go-lua-chon-hoan-hao-cho-da-ngoai-va-van-phong');

// Load tất cả metadata (không có content)
const allPosts = await loadAllBlogMeta();
```

## Cấu trúc thư mục

```
public/
└── news/
    ├── dao-nia-go-lua-chon-hoan-hao-cho-da-ngoai-va-van-phong.md
    ├── ly-do-khien-coc-giay-dep-ngay-cang-pho-bien.md
    └── ...
    └── images/
        ├── dao-nia-go-lua-chon-hoan-hao-cho-da-ngoai-va-van-phong-image-1.jpg
        ├── dao-nia-go-lua-chon-hoan-hao-cho-da-ngoai-va-van-phong-featured.jpg
        └── ...
```

## Generate Blog Index

Sau khi migrate blogs hoặc khi thêm/sửa file markdown thủ công, cần generate lại index.json:

```bash
npm run generate:blog-index
```

Script này sẽ:
- Quét tất cả file `.md` trong `public/news/`
- Parse frontmatter để lấy metadata (category, title, date, author, excerpt, image)
- Sắp xếp theo date giảm dần (ngày mới nhất đầu danh sách)
- Tạo file `public/news/index.json` với cấu trúc:
  ```json
  {
    "meta": {
      "generatedAt": "2026-02-09T...",
      "totalPosts": 18
    },
    "posts": [
      {
        "category": "Sản phẩm",
        "slug": "...",
        "title": "...",
        "image": "/news/images/...",
        "excerpt": "...",
        "date": "2024-01-15",
        "author": "PackSM Team",
        "readTime": "5 min read"
      }
    ]
  }
  ```

## Workflow hoàn chỉnh

1. **Migrate blogs từ site cũ:**
   ```bash
   npm run migrate:blogs
   ```

2. **Generate index:**
   ```bash
   npm run generate:blog-index
   ```

3. **Kiểm tra kết quả:**
   - Markdown files: `public/news/*.md`
   - Images: `public/news/images/`
   - Index: `public/news/index.json`

## Chạy lại migration

Nếu cần chạy lại migration (ví dụ: site cũ có thêm bài mới):

1. Xóa các file cũ (nếu muốn):
   ```bash
   rm -rf public/news/*.md public/news/images/*
   ```

2. Chạy lại script:
   ```bash
   npm run migrate:blogs && npm run generate:blog-index
   ```

Script sẽ tự động bỏ qua các ảnh đã tồn tại và chỉ tải ảnh mới.
