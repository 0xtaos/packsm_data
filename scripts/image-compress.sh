#!/bin/bash

# =============================================================================
# Image Compressor Script for Web Optimization
# Hỗ trợ: PNG, JPG, JPEG
# =============================================================================

set -e

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default settings
QUALITY_JPG=85
QUALITY_PNG=80
OUTPUT_DIR=""
BACKUP=false
OVERWRITE=false
RECURSIVE=false
MAX_WIDTH=""
MAX_HEIGHT=""
CONVERT_WEBP=false
WEBP_QUALITY=80

# =============================================================================
# Functions
# =============================================================================

show_help() {
    cat << EOF
Image Compressor for Web - Nén ảnh cho web

USAGE:
    $0 [OPTIONS] <file_or_directory>

OPTIONS:
    -h, --help              Hiển thị help này
    -q, --quality NUM       Chất lượng JPG (1-100, default: 85)
    -p, --png-quality NUM   Chất lượng PNG (1-100, default: 80)
    -o, --output DIR        Thư mục output (mặc định: ghi đè file gốc)
    -b, --backup            Tạo backup file gốc (.backup)
    -r, --recursive         Xử lý đệ quy thư mục con
    -w, --max-width PIXEL   Resize nếu width > PIXEL
    -h, --max-height PIXEL  Resize nếu height > PIXEL
    --webp                  Tạo thêm file WebP
    --webp-quality NUM      Chất lượng WebP (1-100, default: 80)
    --overwrite             Ghi đè file output nếu đã tồn tại

EXAMPLES:
    # Nén 1 file
    $0 image.png

    # Nén với chất lượng cao hơn
    $0 -q 95 photo.jpg

    # Nén cả thư mục
    $0 -r ./images/

    # Nén và tạo backup
    $0 -b -o ./compressed/ ./photos/

    # Nén + resize + tạo WebP
    $0 -w 1920 --webp ./gallery/

CÔNG CỤ HỖ TRỢ:
    - PNG: pngquant (tốt nhất) hoặc ImageMagick
    - JPG: jpegoptim (tốt nhất) hoặc ImageMagick
    - WebP: cwebp hoặc ImageMagick

Cài đặt công cụ tối ưu (Ubuntu/Debian):
    sudo apt-get install pngquant jpegoptim webp

EOF
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Kiểm tra công cụ có sẵn
check_tools() {
    PNG_TOOL=""
    JPG_TOOL=""
    WEBP_TOOL=""

    if command -v pngquant &> /dev/null; then
        PNG_TOOL="pngquant"
    elif command -v convert &> /dev/null; then
        PNG_TOOL="imagemagick"
    fi

    if command -v jpegoptim &> /dev/null; then
        JPG_TOOL="jpegoptim"
    elif command -v convert &> /dev/null; then
        JPG_TOOL="imagemagick"
    fi

    if command -v cwebp &> /dev/null; then
        WEBP_TOOL="cwebp"
    elif command -v convert &> /dev/null; then
        WEBP_TOOL="imagemagick"
    fi

    if [[ -z "$PNG_TOOL" && -z "$JPG_TOOL" ]]; then
        log_error "Không tìm thấy công cụ nén ảnh nào!"
        log_info "Vui lòng cài đặt ImageMagick: sudo apt-get install imagemagick"
        exit 1
    fi

    log_info "Công cụ sử dụng: PNG=$PNG_TOOL, JPG=$JPG_TOOL"
}

# Lấy kích thước file
get_file_size() {
    stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null || echo "0"
}

# Format size cho dễ đọc
format_size() {
    local size=$1
    if [ $size -lt 1024 ]; then
        echo "${size}B"
    elif [ $size -lt 1048576 ]; then
        echo "$(echo "scale=1; $size/1024" | bc)KB"
    else
        echo "$(echo "scale=2; $size/1048576" | bc)MB"
    fi
}

# Tính % giảm kích thước
calculate_reduction() {
    local original=$1
    local compressed=$2
    if [ $original -eq 0 ]; then
        echo "0"
    else
        echo "$(echo "scale=1; (1 - $compressed/$original) * 100" | bc)"
    fi
}

# Nén PNG file
compress_png() {
    local input="$1"
    local output="$2"
    local original_size=$(get_file_size "$input")
    local temp_file="${output}.tmp"

    log_info "Đang nén PNG: $(basename "$input") ($(format_size $original_size))"

    # Tạo thư mục output nếu cần
    mkdir -p "$(dirname "$output")"

    if [ "$PNG_TOOL" = "pngquant" ]; then
        # pngquant cho kết quả tốt hơn
        pngquant --quality=${QUALITY_PNG}-100 --force --output "$temp_file" "$input" 2>/dev/null || \
            convert "$input" -strip -define png:compression-level=9 "$temp_file"
    else
        # Sử dụng ImageMagick
        local resize_opt=""
        if [ -n "$MAX_WIDTH" ] || [ -n "$MAX_HEIGHT" ]; then
            resize_opt="-resize ${MAX_WIDTH:-99999}x${MAX_HEIGHT:-99999}>"
        fi
        convert "$input" -strip $resize_opt -define png:compression-level=9 -define png:format=png8 "$temp_file" 2>/dev/null || \
            convert "$input" -strip $resize_opt -define png:compression-level=9 "$temp_file"
    fi

    # Resize nếu cần (với pngquant thì cần xử lý riêng)
    if [ -n "$MAX_WIDTH" ] || [ -n "$MAX_HEIGHT" ]; then
        if [ "$PNG_TOOL" = "pngquant" ] || [ "$PNG_TOOL" = "imagemagick" ]; then
            local final_temp="${temp_file}.resize"
            convert "$temp_file" -resize ${MAX_WIDTH:-99999}x${MAX_HEIGHT:-99999}\> "$final_temp"
            mv "$final_temp" "$temp_file"
        fi
    fi

    mv "$temp_file" "$output"

    local new_size=$(get_file_size "$output")
    local reduction=$(calculate_reduction $original_size $new_size)

    log_success "✓ $(basename "$input"): $(format_size $original_size) → $(format_size $new_size) (-${reduction}%)"

    # Tạo WebP nếu được yêu cầu
    if [ "$CONVERT_WEBP" = true ]; then
        convert_to_webp "$input" "${output%.*}.webp"
    fi
}

# Nén JPG file
compress_jpg() {
    local input="$1"
    local output="$2"
    local original_size=$(get_file_size "$input")
    local temp_file="${output}.tmp"

    log_info "Đang nén JPG: $(basename "$input") ($(format_size $original_size))"

    # Tạo thư mục output nếu cần
    mkdir -p "$(dirname "$output")"

    if [ "$JPG_TOOL" = "jpegoptim" ]; then
        # jpegoptim cho kết quả tốt hơn
        cp "$input" "$temp_file"
        local resize_opt=""
        [ -n "$MAX_WIDTH" ] && resize_opt="--width=$MAX_WIDTH"
        [ -n "$MAX_HEIGHT" ] && resize_opt="--height=$MAX_HEIGHT"
        jpegoptim --quiet --strip-all $resize_opt -m$QUALITY_JPG "$temp_file" 2>/dev/null || \
            convert "$input" -strip -resize ${MAX_WIDTH:-99999}x${MAX_HEIGHT:-99999}\> -quality $QUALITY_JPG "$temp_file"
    else
        # Sử dụng ImageMagick
        local resize_opt=""
        if [ -n "$MAX_WIDTH" ] || [ -n "$MAX_HEIGHT" ]; then
            resize_opt="-resize ${MAX_WIDTH:-99999}x${MAX_HEIGHT:-99999}>"
        fi
        convert "$input" -strip $resize_opt -interlace Plane -sampling-factor 4:2:0 -quality $QUALITY_JPG "$temp_file"
    fi

    mv "$temp_file" "$output"

    local new_size=$(get_file_size "$output")
    local reduction=$(calculate_reduction $original_size $new_size)

    log_success "✓ $(basename "$input"): $(format_size $original_size) → $(format_size $new_size) (-${reduction}%)"

    # Tạo WebP nếu được yêu cầu
    if [ "$CONVERT_WEBP" = true ]; then
        convert_to_webp "$input" "${output%.*}.webp"
    fi
}

# Chuyển đổi sang WebP
convert_to_webp() {
    local input="$1"
    local output="$2"

    log_info "  → Tạo WebP: $(basename "$output")"

    if [ "$WEBP_TOOL" = "cwebp" ]; then
        cwebp -quiet -q $WEBP_QUALITY "$input" -o "$output" 2>/dev/null || \
            convert "$input" -quality $WEBP_QUALITY "$output"
    else
        convert "$input" -quality $WEBP_QUALITY "$output"
    fi
}

# Xử lý 1 file
process_file() {
    local input="$1"
    local filename=$(basename "$input")
    local extension="${filename##*.}"
    extension=$(echo "$extension" | tr '[:upper:]' '[:lower:]')

    # Xác định output path
    local output
    if [ -n "$OUTPUT_DIR" ]; then
        output="${OUTPUT_DIR}/${filename}"
    else
        if [ "$BACKUP" = true ]; then
            cp "$input" "${input}.backup"
        fi
        output="$input"
    fi

    # Kiểm tra file output đã tồn tại
    if [ "$OVERWRITE" = false ] && [ -n "$OUTPUT_DIR" ] && [ -f "$output" ]; then
        log_warn "Bỏ qua (đã tồn tại): $filename"
        return
    fi

    case "$extension" in
        png)
            if [ -n "$PNG_TOOL" ]; then
                compress_png "$input" "$output"
            else
                log_warn "Không có công cụ nén PNG, bỏ qua: $filename"
            fi
            ;;
        jpg|jpeg)
            if [ -n "$JPG_TOOL" ]; then
                compress_jpg "$input" "$output"
            else
                log_warn "Không có công cụ nén JPG, bỏ qua: $filename"
            fi
            ;;
        *)
            log_warn "Định dạng không hỗ trợ: $extension"
            ;;
    esac
}

# Xử lý thư mục
process_directory() {
    local dir="$1"
    local find_opts="-maxdepth 1"
    [ "$RECURSIVE" = true ] && find_opts=""

    log_info "Đang quét thư mục: $dir"

    while IFS= read -r file; do
        [ -f "$file" ] && process_file "$file"
    done < <(find "$dir" $find_opts -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) 2>/dev/null)
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -q|--quality)
                QUALITY_JPG="$2"
                shift 2
                ;;
            -p|--png-quality)
                QUALITY_PNG="$2"
                shift 2
                ;;
            -o|--output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            -b|--backup)
                BACKUP=true
                shift
                ;;
            -r|--recursive)
                RECURSIVE=true
                shift
                ;;
            --max-width)
                MAX_WIDTH="$2"
                shift 2
                ;;
            --max-height)
                MAX_HEIGHT="$2"
                shift 2
                ;;
            -w|--max-width-short)
                MAX_WIDTH="$2"
                shift 2
                ;;
            --webp)
                CONVERT_WEBP=true
                shift
                ;;
            --webp-quality)
                WEBP_QUALITY="$2"
                shift 2
                ;;
            --overwrite)
                OVERWRITE=true
                shift
                ;;
            -*)
                log_error "Tùy chọn không hợp lệ: $1"
                show_help
                exit 1
                ;;
            *)
                INPUT_PATH="$1"
                shift
                ;;
        esac
    done

    # Kiểm tra input
    if [ -z "$INPUT_PATH" ]; then
        log_error "Thiếu đường dẫn file hoặc thư mục!"
        show_help
        exit 1
    fi

    if [ ! -e "$INPUT_PATH" ]; then
        log_error "File hoặc thư mục không tồn tại: $INPUT_PATH"
        exit 1
    fi

    # Kiểm tra công cụ
    check_tools

    # Tạo output directory nếu cần
    if [ -n "$OUTPUT_DIR" ]; then
        mkdir -p "$OUTPUT_DIR"
    fi

    # Hiển thị thông tin cấu hình
    echo "============================================"
    echo "  Image Compressor for Web"
    echo "============================================"
    echo "Input:        $INPUT_PATH"
    echo "JPG Quality:  $QUALITY_JPG"
    echo "PNG Quality:  $QUALITY_PNG"
    [ -n "$OUTPUT_DIR" ] && echo "Output:       $OUTPUT_DIR"
    [ -n "$MAX_WIDTH" ] && echo "Max Width:    ${MAX_WIDTH}px"
    [ -n "$MAX_HEIGHT" ] && echo "Max Height:   ${MAX_HEIGHT}px"
    [ "$CONVERT_WEBP" = true ] && echo "WebP Quality: $WEBP_QUALITY"
    echo "--------------------------------------------"

    # Xử lý
    if [ -d "$INPUT_PATH" ]; then
        process_directory "$INPUT_PATH"
    else
        process_file "$INPUT_PATH"
    fi

    echo "--------------------------------------------"
    log_success "Hoàn thành!"
}

main "$@"
