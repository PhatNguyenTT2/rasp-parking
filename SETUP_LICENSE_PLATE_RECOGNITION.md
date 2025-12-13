# 🚗 Hướng Dẫn Tích Hợp License Plate Recognition

## 📋 Tổng Quan

Hệ thống nhận diện biển số xe Việt Nam được tích hợp vào ứng dụng quản lý bãi xe, cho phép:
- ✅ Tự động nhận diện biển số từ camera khi xe vào/ra
- ✅ Upload ảnh để nhận diện biển số
- ✅ Tự động điền thông tin vào form
- ✅ Giảm thiểu lỗi nhập tay

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  - EntryLane: Upload/Camera → Auto-fill License Plate      │
│  - ExitLane: Camera Capture → Validate License Plate       │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js/Express)                  │
│  Endpoints:                                                 │
│  - POST /api/parking/logs/recognize                         │
│  - POST /api/parking/logs/recognize/camera                  │
│  - GET  /api/parking/logs/lp-service/health                 │
└─────────────────┬───────────────────────────────────────────┘
                  │ HTTP (Port 5001)
                  ▼
┌─────────────────────────────────────────────────────────────┐
│         Python Flask Service (Port 5001)                    │
│  - YOLOv5 License Plate Detection                           │
│  - YOLOv5 OCR Character Recognition                         │
│  - Vietnamese License Plate Support                         │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Cài Đặt

### Bước 1: Cài Đặt Backend Dependencies

```bash
# Từ thư mục gốc của project
npm install
cd frontend; npm install
```

Dependencies mới được thêm:
- `axios`: HTTP client để gọi Python service
- `form-data`: Xử lý multipart form data
- `multer`: Upload file middleware

### Bước 2: Cài Đặt Python Service

```bash
# Di chuyển vào thư mục lp-service
cd lp-service

# Cài đặt Python dependencies
pip install -r requirements.txt
```

**Lưu ý:** Đảm bảo Python 3.8+ đã được cài đặt

### Bước 3: Kiểm Tra YOLOv5 Models

Đảm bảo các file model tồn tại:
```
License-Plate-Recognition/
  ├── model/
  │   ├── LP_detector.pt         # Model phát hiện biển số
  │   ├── LP_ocr.pt              # Model OCR đọc ký tự
  │   ├── LP_detector_nano_61.pt
  │   └── LP_ocr_nano_62.pt
  └── yolov5/                    # YOLOv5 framework
```


## 🚀 Khởi Động Hệ Thống

### Cách 1: Khởi động thủ công (Development)

**Terminal 1 - Python Service:**
```bash
cd lp-service
python api_server.py
```
Truy cập: http://localhost:5001/health

**Terminal 2 - MongoDB:**
```bash
mongod
```

**Terminal 3 - Backend API:**
```bash
npm run dev
```
Truy cập: http://localhost:3001

**Terminal 4 - Frontend:**
```bash
cd frontend
npm run dev
```
Truy cập: http://localhost:5173

### Cách 2: Khởi động với scripts (Production)

Tạo file `start-all.ps1` (Windows PowerShell):
```powershell
# Start MongoDB
Start-Process mongod

# Start Python Service
Start-Process powershell -ArgumentList "cd lp-service; python api_server.py"

# Start Backend
Start-Process powershell -ArgumentList "npm start"

# Start Frontend
Start-Process powershell -ArgumentList "cd frontend; npm run dev"
```

Chạy:
```bash
.\start-all.ps1
```

## 📡 API Endpoints

### 1. Nhận diện từ Upload Image

**Request:**
```http
POST /api/parking/logs/recognize
Content-Type: multipart/form-data

image: [File]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "licensePlate": "59A1-2345",
    "confidence": 0.95,
    "image": "/uploads/1234567890.jpg",
    "timestamp": "2025-12-08T10:30:00Z"
  },
  "message": "License plate recognized successfully"
}
```

### 2. Nhận diện từ Camera

**Request:**
```http
POST /api/parking/logs/recognize/camera
Content-Type: application/json

{
  "cameraId": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "licensePlate": "51F-12345",
    "confidence": 0.92,
    "timestamp": "2025-12-08T10:35:00Z"
  },
  "message": "License plate captured and recognized successfully"
}
```

### 3. Health Check

**Request:**
```http
GET /api/parking/logs/lp-service/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "healthy": true,
    "serviceUrl": "http://localhost:5001",
    "timestamp": "2025-12-08T10:40:00Z"
  }
}
```

## 🎨 Frontend Usage

### Entry Lane Component

```jsx
// User clicks "Upload Ảnh"
<input type="file" onChange={handleImageUpload} />

// Auto-fill license plate after recognition
setFormData({
  licensePlate: "59A1-2345",
  image: "/uploads/..."
})
```

### Exit Lane Component

```jsx
// User clicks "Chụp Camera"
<button onClick={handleCameraCapture}>
  Chụp Camera & Nhận Diện
</button>

// Auto-fill exit license plate
setFormData({
  exitLicensePlate: "59A1-2345"
})
```

## 🐛 Troubleshooting

### Python Service không khởi động

**Lỗi:** `ModuleNotFoundError: No module named 'torch'`
```bash
pip install torch torchvision
```

**Lỗi:** `Could not import helper module`
```bash
# Kiểm tra đường dẫn License-Plate-Recognition
cd lp-service
python -c "import sys; sys.path.append('../License-Plate-Recognition'); from function import helper"
```

### Backend không kết nối được Python Service

**Kiểm tra:**
1. Python service đang chạy: `curl http://localhost:5001/health`
2. Firewall không chặn port 5001
3. Biến môi trường `LP_SERVICE_URL` đúng

**Test thủ công:**
```bash
curl -X POST http://localhost:5001/api/test
```

### Camera không hoạt động

**Lỗi:** `Could not open camera 0`

**Giải pháp:**
1. Kiểm tra camera được kết nối
2. Cho phép ứng dụng truy cập camera
3. Thử camera ID khác (0, 1, 2...)

### Upload ảnh thất bại

**Lỗi:** `File too large`
```bash
# Tăng giới hạn trong .env
UPLOAD_MAX_SIZE=20971520  # 20MB
```

**Lỗi:** `No image provided`
- Kiểm tra form có `encType="multipart/form-data"`
- Đảm bảo field name là `image`

## 🧪 Testing

### Test Python Service

```bash
cd lp-service

# Test với sample image
python -c "from lp_recognition_service import test_service; test_service()"

# Test API server
curl http://localhost:5001/api/test
```

### Test Backend Integration

```bash
# Upload test image
curl -X POST http://localhost:3001/api/parking/logs/recognize \
  -F "image=@test.jpg"

# Camera capture (cần camera)
curl -X POST http://localhost:3001/api/parking/logs/recognize/camera \
  -H "Content-Type: application/json" \
  -d '{"cameraId": 0}'
```

### Test Frontend

1. Mở http://localhost:5173
2. Click "Thêm Xe" ở Entry Lane
3. Click "Upload Ảnh" và chọn ảnh biển số xe
4. Kiểm tra biển số tự động điền vào form

## 📊 Performance

- **Recognition Time:** ~1-3 giây/ảnh
- **Accuracy:** 85-95% (tùy chất lượng ảnh)
- **Supported Formats:** JPG, PNG, BMP
- **Max Image Size:** 10MB
- **Concurrent Requests:** 5 requests/second

## 🔒 Security Considerations

1. **File Upload:**
   - Chỉ cho phép image files
   - Giới hạn kích thước file
   - Validate file type

2. **API Rate Limiting:**
   - Thêm rate limiting cho recognition endpoints
   - Prevent abuse

3. **Error Handling:**
   - Không expose internal paths
   - Log errors securely

## 📚 References

- [YOLOv5 Documentation](https://github.com/ultralytics/yolov5)
- [License Plate Recognition Repo](./License-Plate-Recognition/README.md)
- [Flask Documentation](https://flask.palletsprojects.com/)

## 💡 Tips

1. **Chất lượng ảnh tốt = độ chính xác cao:**
   - Ánh sáng đủ
   - Biển số rõ ràng, không bị che khuất
   - Góc chụp thẳng

2. **Optimization:**
   - Cache recognition results nếu cùng ảnh
   - Sử dụng model nano cho tốc độ nhanh hơn
   - Compress ảnh trước khi upload

3. **Monitoring:**
   - Log tất cả recognition requests
   - Track accuracy rate
   - Monitor Python service health

## 🆘 Support

Nếu gặp vấn đề, kiểm tra:
1. Logs của Python service
2. Logs của Backend API
3. Browser console (Frontend)
4. Network tab (DevTools)

---

**Chúc bạn triển khai thành công! 🎉**
