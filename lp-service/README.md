# License Plate Recognition Service

Python Flask API service for Vietnamese license plate recognition.

## Setup

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Ensure YOLOv5 is installed:**
The parent folder should contain `License-Plate-Recognition/yolov5/`

3. **Run the service:**
```bash
python api_server.py
```

The service will start on `http://localhost:5001`

## API Endpoints

### Health Check
```bash
GET http://localhost:5001/health
```

### Recognize from Image
```bash
POST http://localhost:5001/api/recognize
Content-Type: multipart/form-data

file: [image file]
```

### Recognize from Camera
```bash
POST http://localhost:5001/api/recognize/camera
Content-Type: application/json

{
  "cameraId": 0
}
```

### Test Endpoint
```bash
GET http://localhost:5001/api/test
```

## Response Format

Success:
```json
{
  "success": true,
  "data": {
    "licensePlate": "59A1-2345",
    "confidence": 0.95,
    "timestamp": "2025-12-08T10:30:00"
  }
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```
