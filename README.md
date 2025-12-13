# Hệ Thống Quản Lý Bãi Đỗ Xe Thông Minh

## 🎯 Tổng Quan
Hệ thống quản lý bãi đỗ xe tự động sử dụng **AI nhận diện biển số xe** (License Plate Recognition), camera và RFID để kiểm soát luồng xe ra vào.

### ✨ Tính Năng Mới: Nhận Diện Biển Số Tự Động
- 🤖 **AI-Powered OCR**: Tự động nhận diện biển số xe Việt Nam
- 📸 **Camera Integration**: Chụp và nhận diện realtime
- 📤 **Upload Support**: Upload ảnh để nhận diện
- ⚡ **Auto-Fill**: Tự động điền biển số vào form
- 🎯 **Accuracy**: 85-95% độ chính xác

## 🏗️ Kiến Trúc Hệ Thống

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend       │────▶│  Backend API     │────▶│   MongoDB       │
│  (React)        │     │  (Node.js)       │     │   Database      │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Python Service  │
                        │  (Flask + YOLOv5)│
                        │  LP Recognition  │
                        └──────────────────┘
```

## Cấu Trúc Dữ Liệu

### ParkingLog Model
**Mục đích**: Ghi nhận lịch sử xe vào bãi (entry log only)

**Lưu ý**: Model này chỉ lưu thông tin khi xe **vào**, không lưu thông tin xe ra. Khi xe ra, hệ thống sẽ:
- Tìm record theo `cardId`
- So sánh biển số
- Tính thời gian đỗ
- Xóa/đánh dấu record đã xử lý

- **licensePlate**: Biển số xe (bắt buộc, tự động chuyển thành chữ hoa)
- **entryTime**: Thời gian xe vào (bắt buộc, mặc định là thời điểm hiện tại)
- **cardId**: ID thẻ xe/RFID (bắt buộc)
- **image**: Ảnh chụp xe khi vào (tùy chọn)

## Workflow Hệ Thống

### 1. Luồng Xe Vào (Entry Lane) - **🆕 với AI Recognition**
**Thiết bị**: Camera + RFID Reader (hoặc Manual Input)

**Quy trình Tự Động**:
1. Xe đến cổng vào
2. 🤖 **Camera tự động chụp** hoặc **User upload ảnh**
3. 🔍 **AI nhận diện biển số** (Python YOLOv5 Service)
4. ✅ **Tự động điền** biển số vào form
5. RFID Reader đọc ID thẻ xe (hoặc nhập tay)
6. Ghi nhận thời gian vào
7. Lưu dữ liệu vào MongoDB (licensePlate, entryTime, cardId, image)
8. ✅ Xác nhận xe vào thành công

**API Endpoint**:
- `POST /api/parking/logs/recognize` - Upload ảnh để nhận diện
- `POST /api/parking/logs/recognize/camera` - Chụp từ camera
- `POST /api/parking/logs` - Tạo log xe vào

### 2. Luồng Xe Ra (Exit Lane) - **🆕 với AI Recognition**
**Thiết bị**: Camera + RFID Reader

**Quy trình Tự Động**:
1. Xe đến cổng ra
2. RFID Reader đọc ID thẻ xe (hoặc nhập tay)
3. 📸 **Camera tự động chụp xe ra**
4. 🔍 **AI nhận diện biển số xe ra**
5. ✅ **Tự động điền** biển số vào form
6. Ghi nhận thời gian ra
7. 🔄 **So sánh biển số** với database

**Kiểm tra tự động**:
- Tra cứu database theo `cardId`
- 🤖 So sánh biển số AI đọc được với database
- **Nếu khớp**: 
  - Tính toán thời gian đỗ (exitTime - entryTime)
  - Hiển thị đối chiếu hình ảnh vào/ra
  - Mở cổng cho xe ra
  - Xóa record trong database
  - Hiển thị thông tin: biển số, thẻ, thời gian vào/ra, thời lượng đỗ
- **Nếu không khớp**: 
  - Cảnh báo biển số không khớp (hiển thị cả 2 biển số)
  - Hiển thị hình ảnh xe ra để kiểm tra
  - Không mở cổng
  - Ghi log sự cố

**Dữ liệu đầu vào (từ Raspberry Pi)**:
- `cardId`: ID thẻ từ RFID Reader (bắt buộc)
- `exitLicensePlate`: Biển số xe từ OCR (bắt buộc)
- `exitImage`: URL hình ảnh xe ra (tùy chọn)
- `exitTime`: Thời gian ra (tự động tạo khi xử lý)

### 3. Tính Toán Thời Gian Đỗ
```
Thời gian đỗ = Thời gian ra - entryTime (từ database)
```

## Công Nghệ Sử dụng

### Backend
- **Node.js + Express**: API server
- **MongoDB + Mongoose**: Database
- **Socket.io**: Real-time communication (nếu cần)

### Frontend
- **React + Vite**: Giao diện quản lý
- **TailwindCSS**: Styling

### Raspberry Pi
- **Python**: Xử lý camera và GPIO
- **OpenCV**: Xử lý hình ảnh
- **OCR**: Nhận diện biển số
- **MFRC522/RC522**: RFID Reader

## 📁 Cấu Trúc Thư Mục
```
parking/
├── controller/              # API controllers
│   └── parkingLogs.js      # ✅ Với LP Recognition endpoints
├── model/                  # MongoDB models
│   └── parkingLog.js       # Entry log model
├── utils/                  # Utilities
│   ├── licensePlateClient.js  # 🆕 Python service client
│   ├── config.js
│   ├── logger.js
│   └── middleware.js
├── frontend/               # React frontend
│   ├── services/
│   │   └── parkingLogService.js  # ✅ Với recognition methods
│   └── src/
│       └── components/
│           ├── EntryLane.jsx    # ✅ Auto-recognition UI
│           └── ExitLane.jsx     # ✅ Auto-recognition UI
├── lp-service/             # 🆕 Python LP Recognition Service
│   ├── api_server.py       # Flask REST API
│   ├── lp_recognition_service.py  # Recognition logic
│   ├── requirements.txt    # Python dependencies
│   └── test_service.py     # Test script
├── License-Plate-Recognition/  # AI Models & Training
│   ├── model/              # YOLOv5 trained models
│   ├── yolov5/            # YOLOv5 framework
│   └── function/          # Helper functions
└── public/
    └── uploads/           # 🆕 Uploaded vehicle images
```

## 🚀 API Endpoints

### 🆕 License Plate Recognition
- `POST /api/parking/logs/recognize` - Nhận diện từ upload ảnh
  - Body: `multipart/form-data` với field `image`
  - Response: `{ licensePlate, confidence, image, timestamp }`

- `POST /api/parking/logs/recognize/camera` - Nhận diện từ camera
  - Body: `{ cameraId: 0 }`
  - Response: `{ licensePlate, confidence, timestamp }`

- `GET /api/parking/logs/lp-service/health` - Health check Python service

### Entry
- `POST /api/parking/logs` - Ghi nhận xe vào
  - Body: `{ licensePlate, cardId, image?, entryTime? }`

### Exit
- **Frontend Service: `processExit(cardId, exitLicensePlate)`**
  - Tìm xe theo `cardId`
  - Validate biển số khớp
  - Xóa record nếu hợp lệ
  - Input bổ sung: `exitImage` (URL), `exitTime` (auto-generated)
  - Response: Thông tin xe vào/ra, thời gian đỗ, trạng thái, hình ảnh đối chiếu

### Query
- `GET /api/parking/logs` - Lấy danh sách log
- `GET /api/parking/logs/:id` - Lấy log theo ID
- `PUT /api/parking/logs/:id` - Cập nhật log
- `DELETE /api/parking/logs/:id` - Xóa log (xe ra)

## ⚙️ Yêu Cầu Cài Đặt

### Hệ Thống
- Node.js 18+
- Python 3.8+
- MongoDB 6+

### Backend
```bash
npm install
```

Dependencies:
- express, mongoose, cors, dotenv
- 🆕 **axios** - HTTP client
- 🆕 **multer** - File upload
- 🆕 **form-data** - Multipart form data

### Frontend
```bash
cd frontend
npm run dev
```

## 📚 Documentation

- **🆕 [Setup Guide - License Plate Recognition](SETUP_LICENSE_PLATE_RECOGNITION.md)** - Chi tiết tích hợp AI
- **🆕 [Implementation Complete](IMPLEMENTATION_COMPLETE.md)** - Tóm tắt triển khai
- **[Design Overview](DESIGN_OVERVIEW.md)** - Thiết kế hệ thống
- **[LP Recognition Original](License-Plate-Recognition/README.md)** - Model AI gốc

## 🎯 Features Checklist

### ✅ Completed
- [x] MongoDB schema & indexes
- [x] Backend CRUD API
- [x] Frontend Entry/Exit lanes
- [x] Real-time updates
- [x] Entry/Exit validation
- [x] 🆕 **AI License Plate Recognition**
- [x] 🆕 **Camera integration**
- [x] 🆕 **Auto-fill license plates**
- [x] 🆕 **Image upload support**
- [x] 🆕 **Python Flask service**

### 🚧 In Progress / Future
- [ ] Raspberry Pi GPIO integration
- [ ] RFID hardware integration
- [ ] Gate control automation
- [ ] Payment processing
- [ ] Analytics dashboard
- [ ] Multi-language support

## 🧪 Testing

### Test Python Service
```bash
cd lp-service
python test_service.py
```

### Test Backend API
```bash
npm test
```

### Manual API Test
```bash
# Health check
curl http://localhost:5001/health

# Test recognition
curl http://localhost:5001/api/test

# Backend health
curl http://localhost:3001/api/parking/logs/lp-service/health
```

## 🎨 Screenshots

### Entry Lane với Auto-Recognition
![Entry Lane](docs/screenshots/entry-lane.png)

Features:
- 📤 Upload ảnh để nhận diện
- 📸 Chụp từ camera
- ✅ Tự động điền biển số
- 📊 Hiển thị độ tin cậy

### Exit Lane với Validation
![Exit Lane](docs/screenshots/exit-lane.png)

Features:
- 📸 Auto-capture từ camera
- 🔄 So sánh với database
- ⏱️ Tính thời gian đỗ xe
- ✅ Xác nhận xe ra

## 🐛 Troubleshooting

### Python Service Issues
```bash
# Check Python version
python --version  # Should be 3.8+

# Reinstall dependencies
pip install -r lp-service/requirements.txt --force-reinstall

# Test models
cd lp-service
python test_service.py
```

### Backend Connection Issues
```bash
# Check if Python service is running
curl http://localhost:5001/health

# Check environment variables
echo $LP_SERVICE_URL  # Should be http://localhost:5001

# Restart services
.\quick-start.ps1
```

### Camera Issues
- Ensure camera permissions are granted
- Try different camera IDs (0, 1, 2)
- Check if camera is being used by another app

## 📊 Performance

- **Recognition Time:** 1-3 seconds per image
- **Accuracy:** 85-95% (depends on image quality)
- **Concurrent Requests:** Up to 5 req/s
- **Max Image Size:** 10MB
- **Supported Formats:** JPG, PNG, BMP

## 🔐 Security

- File upload validation
- Image size limits
- CORS configuration
- Error message sanitization
- Rate limiting (recommended for production)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project uses:
- [YOLOv5](https://github.com/ultralytics/yolov5) - GPL-3.0 License
- [License-Plate-Recognition](License-Plate-Recognition/) - Original repo license

## 👥 Authors

- Backend & Integration - Your Team
- LP Recognition Model - [Marsmallotr](https://github.com/Marsmallotr/License-Plate-Recognition)

## 🙏 Acknowledgments

- [Mì AI](https://www.miai.vn/) - Dataset contribution
- [winter2897](https://github.com/winter2897) - Dataset contribution
- YOLOv5 Team - Object detection framework

---

**🚀 Ready to start? Run `.\quick-start.ps1` and visit http://localhost:5173**

### Backend
```bash
npm start
```

### Frontend
```bash
cd frontend
npm run dev
```

### Raspberry Pi
```bash
cd raspberry-pi
python main.py
```

## Lưu Ý Bảo Mật
- Xác thực thẻ RFID trước khi xử lý
- Log tất cả các sự cố (biển số không khớp)
- Backup database định kỳ
- Mã hóa dữ liệu nhạy cảm nếu cần

## Tính Năng Mở Rộng (Future)
- [ ] Tính phí đỗ xe tự động
- [ ] Thông báo qua email/SMS
- [ ] Dashboard analytics
- [ ] API webhook cho hệ thống bên ngoài
- [ ] Multi-language support
