from PIL import Image
import cv2
import torch
import math 
import function.utils_rotate as utils_rotate
from IPython.display import display
import os
import time
import argparse
import function.helper as helper

# ============================================================================
# CONFIGURATION - Cấu hình đường dẫn ảnh mặc định
# ============================================================================
# Bạn có thể thay đổi đường dẫn ảnh ở đây
DEFAULT_IMAGE_PATH = "018.jpg"  # Thay đổi đường dẫn ảnh tại đây

# ============================================================================
# ARGUMENT PARSING - Xử lý tham số dòng lệnh (tùy chọn)
# ============================================================================
ap = argparse.ArgumentParser(description='Vietnamese License Plate Recognition from Image')
ap.add_argument('-i', '--image', required=False, default=DEFAULT_IMAGE_PATH, 
                help=f'Path to input image file (default: {DEFAULT_IMAGE_PATH})')
args = ap.parse_args()

# Sử dụng đường dẫn từ argument hoặc DEFAULT_IMAGE_PATH
image_path = args.image

print(f"📷 Using image: {image_path}")

# ============================================================================
# MODEL LOADING - Load YOLOv5 models
# ============================================================================
print("🔧 Loading YOLOv5 models...")
yolo_LP_detect = torch.hub.load('ultralytics/yolov5', 'custom', path='model/LP_detector.pt', force_reload=True)
yolo_license_plate = torch.hub.load('ultralytics/yolov5', 'custom', path='model/LP_ocr.pt', force_reload=True)
yolo_license_plate.conf = 0.60
print("✅ Models loaded!\n")

# ============================================================================
# IMAGE READING - Đọc ảnh
# ============================================================================
img = cv2.imread(image_path)

if img is None:
    print(f"❌ Error: Cannot read image from '{image_path}'")
    print("💡 Tip: Update DEFAULT_IMAGE_PATH in the script or use -i argument")
    exit(1)

print(f"✅ Image loaded: {img.shape[1]}x{img.shape[0]}\n")
plates = yolo_LP_detect(img, size=640)

plates = yolo_LP_detect(img, size=640)
list_plates = plates.pandas().xyxy[0].values.tolist()
list_read_plates = set()
if len(list_plates) == 0:
    lp = helper.read_plate(yolo_license_plate,img)
    if lp != "unknown":
        cv2.putText(img, lp, (7, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
        list_read_plates.add(lp)
else:
    for plate in list_plates:
        flag = 0
        x = int(plate[0]) # xmin
        y = int(plate[1]) # ymin
        w = int(plate[2] - plate[0]) # xmax - xmin
        h = int(plate[3] - plate[1]) # ymax - ymin  
        crop_img = img[y:y+h, x:x+w]
        cv2.rectangle(img, (int(plate[0]),int(plate[1])), (int(plate[2]),int(plate[3])), color = (0,0,225), thickness = 2)
        cv2.imwrite("crop.jpg", crop_img)
        rc_image = cv2.imread("crop.jpg")
        lp = ""
        for cc in range(0,2):
            for ct in range(0,2):
                lp = helper.read_plate(yolo_license_plate, utils_rotate.deskew(crop_img, cc, ct))
                if lp != "unknown":
                    list_read_plates.add(lp)
                    cv2.putText(img, lp, (int(plate[0]), int(plate[1]-10)), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36,255,12), 2)
                    flag = 1
                    break
            if flag == 1:
                break

# ============================================================================
# DISPLAY RESULTS - Hiển thị kết quả
# ============================================================================
print(f"\n{'='*60}")
print(f"📊 RESULTS:")
print(f"  Detected plates: {len(list_plates)}")
print(f"  Successfully read: {len(list_read_plates)}")
if list_read_plates:
    print(f"  License plates: {', '.join(list_read_plates)}")
print(f"{'='*60}\n")

print("🖼️  Press any key to close the image window...")
cv2.imshow('License Plate Recognition', img)
cv2.waitKey()
cv2.destroyAllWindows()