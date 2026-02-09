#!/usr/bin/env python3
import cv2
import numpy as np
from PIL import Image

def remove_watermark(input_path, output_path):
    # Đọc ảnh
    img = cv2.imread(input_path)
    
    # Chuyển sang RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    # Tạo mask để phát hiện watermark (màu xám nhạt)
    # Watermark shutterstock thường có màu xám nhạt (200-240)
    lower_gray = np.array([180, 180, 180])
    upper_gray = np.array([255, 255, 255])
    
    mask = cv2.inRange(img_rgb, lower_gray, upper_gray)
    
    # Mở rộng mask một chút để bao phủ toàn bộ watermark
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=1)
    
    # Sử dụng inpainting để lấp đầy vùng watermark
    result = cv2.inpaint(img, mask, 3, cv2.INPAINT_TELEA)
    
    # Cắt bỏ thanh Shutterstock ở dưới (khoảng 50 pixel cuối)
    height = result.shape[0]
    result = result[0:height-60, :]
    
    # Lưu ảnh kết quả
    cv2.imwrite(output_path, result)
    print(f"Đã xóa watermark và lưu vào: {output_path}")

if __name__ == "__main__":
    remove_watermark("ngua.jpg", "ngua_no_watermark.jpg")
