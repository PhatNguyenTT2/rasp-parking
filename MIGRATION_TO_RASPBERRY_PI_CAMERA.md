# 🔄 Kế Hoạch Migration: Webcam PC → Raspberry Pi Camera

## 📊 Tổng Quan Migration

### Hiện Tại (PC Webcam Architecture)
```
┌─────────────────────────────────────────────────────────────┐
│                   Frontend (PC Browser)                     │
│   - React App chạy trên localhost:5173                     │
│   - Camera capture qua Web API (navigator.mediaDevices)    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Node.js - PC)                     │
│   - Express server localhost:3001                           │
│   - Receive base64 image từ frontend                        │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST (base64 image)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         Python LP Service (Flask - PC)                      │
│   - Flask server localhost:5001                             │
│   - YOLOv5 models chạy trên CPU/GPU PC                     │
│   - OpenCV cv2.VideoCapture(0) → PC Webcam                 │
└─────────────────────────────────────────────────────────────┘
```

**Vấn đề:**
- 🔴 Python service chạy trên PC → không thể truy cập Raspberry Pi camera
- 🔴 `cv2.VideoCapture(0)` chỉ hoạt động với USB/internal webcam của PC
- 🔴 Frontend camera API chỉ access được camera của máy chạy browser

---

### Mục Tiêu (Raspberry Pi Camera Architecture)
```
┌─────────────────────────────────────────────────────────────┐
│              Frontend (PC Browser)                          │
│   - React App không dùng Web Camera API                    │
│   - Gửi request để capture từ Pi Camera                    │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST /api/parking/logs/recognize/pi-camera
                     ▼
┌─────────────────────────────────────────────────────────────┐
│           Backend API (Node.js - PC)                        │
│   - Forward request đến Pi Camera Service                  │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP POST http://192.168.x.x:5001/api/recognize/picamera
                     ▼
┌─────────────────────────────────────────────────────────────┐
│    Python LP Service (Flask - Raspberry Pi)                 │
│   - Flask server 0.0.0.0:5001                               │
│   - YOLOv5 models (có thể dùng nano model cho Pi)         │
│   - picamera2 library → Pi Camera Module                   │
│   - rpicam-hello -t 0 → Test camera                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Roadmap Chi Tiết

### 🔧 Phase 1: Setup Raspberry Pi Environment (2-3 giờ)

#### Bước 1.1: Cài Đặt Python Dependencies trên Pi
```bash
# SSH vào Pi
ssh pi@192.168.1.223

# Update system
sudo apt update && sudo apt upgrade -y

# Cài đặt system dependencies
sudo apt install -y python3-pip python3-venv
sudo apt install -y libopencv-dev python3-opencv
sudo apt install -y libatlas-base-dev libhdf5-dev

# QUAN TRỌNG: Cài picamera2 (thay vì picamera cũ)
sudo apt install -y python3-picamera2

# Kiểm tra picamera2
python3 -c "from picamera2 import Picamera2; print('picamera2 OK')"
```

#### Bước 1.3: Copy Project Files sang Pi

**✅ Khuyến nghị: Dùng Git Clone**

# Clone repository từ GitHub
git clone https://github.com/PhatNguyenTT2/rasp-parking.git 
# Di chuyển vào thư mục project
cd rasp-parking

#### Bước 1.4: Cài Dependencies trên Pi
```bash
# Trên Pi
cd ~/rasp-parking/lp-service
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# QUAN TRỌNG: Nếu lỗi với torch, dùng version cho ARM:
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Hoặc dùng model nano (nhẹ hơn cho Pi):
# Đã có sẵn trong License-Plate-Recognition/model/
```

#### Bước 1.5: Kiểm Tra Models
```bash
# Trên Pi
cd ~/rasp-parking/License-Plate-Recognition/model
ls -lh

# Nên thấy:
# LP_detector_nano_61.pt  (nhẹ hơn cho Pi)
# LP_ocr_nano_62.pt       (nhẹ hơn cho Pi)
# LP_detector.pt          (full model - nặng)
# LP_ocr.pt               (full model - nặng)

# Gợi ý: Dùng nano models cho Raspberry Pi
```

---

### 🛠️ Phase 2: Code Modifications (3-4 giờ)

#### Bước 2.1: Tạo Pi Camera Module mới

**File mới: `lp-service/picamera_handler.py`**
```python
"""
Raspberry Pi Camera Handler
Sử dụng picamera2 thay vì OpenCV VideoCapture
"""
from picamera2 import Picamera2
import cv2
import numpy as np
import time
import os

class PiCameraHandler:
    """
    Handler cho Raspberry Pi Camera Module
    """
    
    def __init__(self):
        """Initialize Pi Camera"""
        print("🔧 Initializing Raspberry Pi Camera...")
        
        self.picam = Picamera2()
        
        # Configure camera - FullHD cho license plate detection
        camera_config = self.picam.create_still_configuration(
            main={"size": (1920, 1080), "format": "RGB888"},
            buffer_count=2
        )
        self.picam.configure(camera_config)
        
        # Start camera
        self.picam.start()
        
        # Warm up camera (chờ auto-exposure ổn định)
        time.sleep(2)
        
        print("✅ Pi Camera initialized successfully!")
    
    def capture_frame(self):
        """
        Capture single frame from Pi Camera
        
        Returns:
            numpy.ndarray: OpenCV BGR image
        """
        try:
            # Capture RGB array
            rgb_array = self.picam.capture_array()
            
            # Convert RGB to BGR (OpenCV format)
            bgr_image = cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
            
            return bgr_image
            
        except Exception as e:
            print(f"❌ Error capturing frame: {e}")
            return None
    
    def capture_to_file(self, filepath):
        """
        Capture image and save to file
        
        Args:
            filepath (str): Path to save image
            
        Returns:
            bool: Success status
        """
        try:
            self.picam.capture_file(filepath)
            return True
        except Exception as e:
            print(f"❌ Error saving capture: {e}")
            return False
    
    def close(self):
        """Release camera resources"""
        try:
            self.picam.stop()
            self.picam.close()
            print("✅ Pi Camera closed")
        except Exception as e:
            print(f"⚠️ Warning closing camera: {e}")
    
    def __del__(self):
        """Destructor - ensure camera is released"""
        self.close()


# Singleton instance
_picamera_instance = None

def get_picamera():
    """
    Get singleton Pi Camera instance
    
    Returns:
        PiCameraHandler: Camera handler
    """
    global _picamera_instance
    
    if _picamera_instance is None:
        _picamera_instance = PiCameraHandler()
    
    return _picamera_instance


# Test function
def test_picamera():
    """Test Pi Camera capture"""
    print("\n🧪 Testing Pi Camera...")
    
    camera = get_picamera()
    
    # Test capture
    frame = camera.capture_frame()
    
    if frame is not None:
        print(f"✅ Captured frame shape: {frame.shape}")
        
        # Save test image
        test_path = "test_picamera.jpg"
        cv2.imwrite(test_path, frame)
        print(f"✅ Test image saved: {test_path}")
        
        return True
    else:
        print("❌ Failed to capture frame")
        return False


if __name__ == "__main__":
    # Run test
    success = test_picamera()
    exit(0 if success else 1)
```

#### Bước 2.2: Update Recognition Service

**File: `lp-service/lp_recognition_service.py`**

Thêm import và method mới:

```python
# Thêm vào đầu file (sau các import hiện có)
import platform

# Detect if running on Raspberry Pi
IS_RASPBERRY_PI = platform.machine() in ['armv7l', 'aarch64']

if IS_RASPBERRY_PI:
    from picamera_handler import get_picamera
    print("🍓 Running on Raspberry Pi - Using picamera2")
else:
    print("💻 Running on PC - Using OpenCV VideoCapture")
```

Thêm method mới trong class `LicensePlateRecognitionService`:

```python
    def recognize_from_pi_camera(self):
        """
        Capture from Raspberry Pi Camera and recognize license plate
        (Only works on Raspberry Pi)
        
        Returns:
            dict: Recognition result
        """
        if not IS_RASPBERRY_PI:
            return {
                'success': False,
                'error': 'This method only works on Raspberry Pi'
            }
        
        try:
            # Get Pi Camera
            picam = get_picamera()
            
            # Capture frame
            frame = picam.capture_frame()
            
            if frame is None:
                return {
                    'success': False,
                    'error': 'Could not capture frame from Pi Camera'
                }
            
            # Process with existing method
            return self._process_image(frame)
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Pi Camera error: {str(e)}'
            }
```

#### Bước 2.3: Update API Server

**File: `lp-service/api_server.py`**

Thêm endpoint mới:

```python
# Thêm sau endpoint /api/recognize/camera
@app.route('/api/recognize/picamera', methods=['POST'])
def recognize_from_picamera():
    """
    Capture from Raspberry Pi Camera and recognize license plate
    🆕 Endpoint specifically for Raspberry Pi Camera Module
    
    Response:
        {
            "success": true,
            "data": {
                "licensePlate": "59A1-2345",
                "confidence": 0.95,
                "imageData": "data:image/jpeg;base64,...",
                "timestamp": "2025-12-13T10:30:00"
            }
        }
    """
    if not SERVICE_READY:
        return jsonify({
            'success': False,
            'error': 'Recognition service not ready'
        }), 503
    
    try:
        # Recognize from Pi Camera
        result = recognition_service.recognize_from_pi_camera()
        
        if result['success']:
            # Optionally encode frame as base64 for response
            # (implementation similar to recognize_from_camera)
            response_data = {
                'licensePlate': result['licensePlate'],
                'confidence': result.get('confidence', 0),
                'timestamp': datetime.now().isoformat()
            }
            
            return jsonify({
                'success': True,
                'data': response_data
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Recognition failed')
            }), 422
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/camera/test', methods=['GET'])
def test_camera():
    """
    Test camera availability (PC webcam or Pi Camera)
    """
    import platform
    
    is_pi = platform.machine() in ['armv7l', 'aarch64']
    
    if is_pi:
        try:
            from picamera_handler import test_picamera
            success = test_picamera()
            return jsonify({
                'success': success,
                'camera_type': 'Raspberry Pi Camera',
                'platform': platform.machine()
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'camera_type': 'Raspberry Pi Camera'
            }), 500
    else:
        try:
            import cv2
            cap = cv2.VideoCapture(0)
            success = cap.isOpened()
            cap.release()
            return jsonify({
                'success': success,
                'camera_type': 'PC Webcam',
                'platform': platform.machine()
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e),
                'camera_type': 'PC Webcam'
            }), 500
```

#### Bước 2.4: Update Node.js Backend

**File: `utils/licensePlateClient.js`**

Thêm method mới:

```javascript
  /**
   * Recognize license plate from Raspberry Pi Camera
   * @returns {Promise<Object>} Recognition result
   */
  static async recognizeFromPiCamera() {
    try {
      logger.info('Capturing from Raspberry Pi Camera for LP recognition')

      const response = await axios.post(
        `${LP_SERVICE_URL}/api/recognize/picamera`,
        {},
        { timeout: REQUEST_TIMEOUT }
      )

      if (response.data.success) {
        logger.info(`Pi Camera LP recognized: ${response.data.data.licensePlate}`)
        return {
          success: true,
          licensePlate: response.data.data.licensePlate,
          confidence: response.data.data.confidence,
          timestamp: response.data.data.timestamp,
          imageData: response.data.data.imageData
        }
      } else {
        logger.warn(`Pi Camera recognition failed: ${response.data.error}`)
        return {
          success: false,
          error: response.data.error
        }
      }
    } catch (error) {
      logger.error('Pi Camera recognition error:', error.message)

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'Pi Camera service is not running'
        }
      }

      return {
        success: false,
        error: error.response?.data?.error || error.message
      }
    }
  }

  /**
   * Test camera availability
   * @returns {Promise<Object>} Camera test result
   */
  static async testCamera() {
    try {
      const response = await axios.get(
        `${LP_SERVICE_URL}/api/camera/test`,
        { timeout: 5000 }
      )

      return {
        success: response.data.success,
        cameraType: response.data.camera_type,
        platform: response.data.platform
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }
```

**File: `controller/parkingLogs.js`**

Thêm endpoint mới:

```javascript
/**
 * POST /api/parking/logs/recognize/pi-camera
 * Capture and recognize from Raspberry Pi Camera
 */
parkingLogsRouter.post('/recognize/pi-camera', async (request, response) => {
  try {
    const result = await LicensePlateClient.recognizeFromPiCamera();

    if (result.success) {
      return response.json({
        success: true,
        data: {
          licensePlate: result.licensePlate,
          confidence: result.confidence,
          imageData: result.imageData,
          timestamp: result.timestamp
        },
        message: 'License plate captured from Pi Camera successfully'
      });
    } else {
      return response.status(422).json({
        success: false,
        error: {
          message: result.error || 'Failed to capture from Pi Camera'
        }
      });
    }
  } catch (error) {
    logger.error('Pi Camera capture error:', error);
    return response.status(500).json({
      success: false,
      error: {
        message: 'Server error during Pi Camera capture'
      }
    });
  }
});

/**
 * GET /api/parking/logs/camera/test
 * Test camera availability
 */
parkingLogsRouter.get('/camera/test', async (request, response) => {
  try {
    const result = await LicensePlateClient.testCamera();
    
    return response.json({
      success: result.success,
      data: {
        cameraType: result.cameraType,
        platform: result.platform,
        available: result.success
      }
    });
  } catch (error) {
    return response.status(500).json({
      success: false,
      error: {
        message: error.message
      }
    });
  }
});
```

#### Bước 2.5: Update Frontend

**File: `frontend/services/parkingLogService.js`**

Thêm method mới:

```javascript
  // Recognize from Raspberry Pi Camera
  recognizeFromPiCamera: async () => {
    try {
      const response = await apiClient.post('/recognize/pi-camera');
      return response.data;
    } catch (error) {
      console.error('Pi Camera recognition failed:', error);
      throw error;
    }
  },

  // Test camera availability
  testCamera: async () => {
    try {
      const response = await apiClient.get('/camera/test');
      return response.data;
    } catch (error) {
      console.error('Camera test failed:', error);
      throw error;
    }
  },
```

**File: `frontend/src/components/EntryLane.jsx`**

Thêm handler và UI button:

```jsx
  // Add new state
  const [cameraType, setCameraType] = useState('unknown');

  // Test camera on mount
  useEffect(() => {
    const checkCamera = async () => {
      try {
        const result = await parkingLogService.testCamera();
        if (result.success) {
          setCameraType(result.data.cameraType);
        }
      } catch (error) {
        console.error('Camera test error:', error);
      }
    };
    checkCamera();
  }, []);

  // Handle Pi Camera capture
  const handlePiCameraCapture = async () => {
    setIsRecognizing(true);
    setError('');
    setRecognitionError('');

    try {
      const result = await parkingLogService.recognizeFromPiCamera();

      if (result.success) {
        setFormData({
          ...formData,
          licensePlate: result.data.licensePlate,
          imageData: result.data.imageData,
          imageFile: null
        });
        setSuccess(
          `Nhận diện từ Pi Camera: ${result.data.licensePlate} ` +
          `(${(result.data.confidence * 100).toFixed(0)}%)`
        );
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 
                      'Không thể chụp từ Pi Camera';
      setRecognitionError(errorMsg);
      setTimeout(() => setRecognitionError(''), 5000);
    } finally {
      setIsRecognizing(false);
    }
  };

  // Update button UI to show Pi Camera button
  // Add after existing camera button:
  {cameraType.includes('Raspberry') && (
    <button
      type="button"
      onClick={handlePiCameraCapture}
      disabled={isRecognizing}
      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white 
                 rounded-lg hover:bg-purple-700 disabled:opacity-50"
    >
      <Camera size={20} />
      {isRecognizing ? 'Đang chụp...' : 'Chụp Pi Camera'}
    </button>
  )}
```

---

### 🔌 Phase 3: Network Configuration (1 giờ)

#### Bước 3.1: Configure Flask trên Pi để Listen All Interfaces

**File: `lp-service/api_server.py`** (chạy trên Pi)

Update phần cuối file:

```python
if __name__ == '__main__':
    import platform
    
    # Check if running on Raspberry Pi
    is_pi = platform.machine() in ['armv7l', 'aarch64']
    
    if is_pi:
        print("\n🍓 Starting Flask server on Raspberry Pi")
        print("📡 Listening on all interfaces (0.0.0.0:5001)")
        print(f"🔗 Access from PC: http://<pi-ip-address>:5001")
        # Listen on all interfaces for remote access
        app.run(host='0.0.0.0', port=5001, debug=True)
    else:
        print("\n💻 Starting Flask server on PC")
        print("📡 Listening on localhost:5001")
        # Listen only on localhost
        app.run(host='127.0.0.1', port=5001, debug=True)
```

#### Bước 3.2: Configure Firewall trên Pi

```bash
# Trên Pi
# Allow port 5001
sudo ufw allow 5001/tcp

# Check status
sudo ufw status

# Hoặc nếu chưa enable firewall:
sudo ufw enable
sudo ufw allow 5001/tcp
```

#### Bước 3.3: Update Environment Variables trên PC

**File: `.env`** (trên PC)

```bash
# Update LP_SERVICE_URL to point to Raspberry Pi
LP_SERVICE_URL=http://192.168.x.x:5001

# Backup old value
# LP_SERVICE_URL=http://localhost:5001
```

---

### 🧪 Phase 4: Testing (2-3 giờ)

#### Test 4.1: Test Pi Camera Handler

```bash
# Trên Pi
cd ~/rasp-parking/lp-service
source venv/bin/activate

# Test camera handler
python picamera_handler.py

# Expected output:
# 🧪 Testing Pi Camera...
# 🔧 Initializing Raspberry Pi Camera...
# ✅ Pi Camera initialized successfully!
# ✅ Captured frame shape: (1080, 1920, 3)
# ✅ Test image saved: test_picamera.jpg
```

#### Test 4.2: Test Recognition Service

```bash
# Trên Pi
python -c "
from lp_recognition_service import get_recognition_service
service = get_recognition_service()
result = service.recognize_from_pi_camera()
print(result)
"

# Check test_picamera.jpg có biển số xe không
```

#### Test 4.3: Test Flask API

```bash
# Terminal 1 - Trên Pi: Start Flask
cd ~/rasp-parking/lp-service
source venv/bin/activate
python api_server.py

# Terminal 2 - Trên PC: Test API
# Test health
curl http://192.168.x.x:5001/health

# Test camera
curl http://192.168.x.x:5001/api/camera/test

# Test recognition (cần có biển số trước camera)
curl -X POST http://192.168.x.x:5001/api/recognize/picamera
```

#### Test 4.4: Test Node.js Backend

```bash
# Trên PC: Start backend
npm run dev

# Test endpoints
curl http://localhost:3001/api/parking/logs/camera/test

curl -X POST http://localhost:3001/api/parking/logs/recognize/pi-camera
```

#### Test 4.5: Test Frontend

1. Start frontend: `cd frontend; npm run dev`
2. Mở http://localhost:5173
3. Click "Thêm Xe" ở Entry Lane
4. Check camera type indicator
5. Click "Chụp Pi Camera" button
6. Verify license plate auto-fill

---

### 🐛 Phase 5: Troubleshooting Guide

#### Problem 1: Pi Camera không khởi động

**Lỗi:** `Failed to create camera`

```bash
# Check camera enabled
sudo raspi-config
# → Interface Options → Camera → Enable

# Reboot
sudo reboot

# Test lại
rpicam-hello -t 5000
```

#### Problem 2: Cannot connect to Pi from PC

**Lỗi:** `ECONNREFUSED`

```bash
# Trên Pi: Check Flask running
ps aux | grep api_server

# Check port listening
sudo netstat -tulpn | grep 5001

# Check firewall
sudo ufw status

# Test local first
curl http://localhost:5001/health

# Then from PC
curl http://192.168.x.x:5001/health
```

#### Problem 3: YOLOv5 chậm trên Pi

**Solution:** Dùng nano models

```python
# File: lp_recognition_service.py
# Change model paths
lp_detector_path = os.path.join(base_path, 'model', 'LP_detector_nano_61.pt')
lp_ocr_path = os.path.join(base_path, 'model', 'LP_ocr_nano_62.pt')
```

#### Problem 4: Out of memory trên Pi

```bash
# Tăng swap
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# CONF_SWAPSIZE=2048

sudo dphys-swapfile setup
sudo dphys-swapfile swapon
```

#### Problem 5: Permission denied camera

```bash
# Add user to video group
sudo usermod -aG video $USER

# Logout và login lại
```

---

### 🚀 Phase 6: Deployment & Production (1-2 giờ)

#### Bước 6.1: Auto-start Flask trên Pi

**File: `/etc/systemd/system/lp-service.service`**

```ini
[Unit]
Description=License Plate Recognition Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/rasp-parking/lp-service
Environment="PATH=/home/pi/rasp-parking/lp-service/venv/bin"
ExecStart=/home/pi/rasp-parking/lp-service/venv/bin/python api_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Enable service
sudo systemctl enable lp-service.service
sudo systemctl start lp-service.service

# Check status
sudo systemctl status lp-service.service

# View logs
sudo journalctl -u lp-service.service -f
```

#### Bước 6.2: Setup Static IP cho Pi

```bash
# Edit dhcpcd.conf
sudo nano /etc/dhcpcd.conf

# Add:
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Restart
sudo reboot
```

#### Bước 6.3: Production Settings

**On PC - `.env`:**
```bash
# Production Pi IP
LP_SERVICE_URL=http://192.168.1.100:5001

# Increase timeout for Pi
LP_SERVICE_TIMEOUT=30000
```

---

## 📊 Performance Comparison

| Metric | PC Webcam | Raspberry Pi 4 | Raspberry Pi 5 |
|--------|-----------|----------------|----------------|
| **Recognition Time** | 1-2s | 3-5s | 2-3s |
| **Camera Quality** | 720p | 1080p | 4K |
| **Cost** | - | $35+ | $60+ |
| **Power** | High | 5W | 12W |
| **Portability** | ❌ | ✅ | ✅ |
| **Dedicated** | ❌ | ✅ | ✅ |

**Recommendation:**
- Raspberry Pi 4 (4GB): Tốt cho production với nano models
- Raspberry Pi 5 (8GB): Optimal cho full models

---

## 🎯 Checklist

### Pre-Migration
- [ ] Pi camera tested with `rpicam-hello`
- [ ] Network connectivity PC ↔ Pi verified
- [ ] Code backed up
- [ ] Pi OS updated

### Pi Setup
- [ ] Python 3.8+ installed
- [ ] picamera2 installed and tested
- [ ] Project files copied to Pi
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] Models available

### Code Updates
- [ ] `picamera_handler.py` created and tested
- [ ] `lp_recognition_service.py` updated
- [ ] `api_server.py` updated with new endpoints
- [ ] `licensePlateClient.js` updated
- [ ] `parkingLogs.js` controller updated
- [ ] Frontend updated with Pi Camera button

### Network
- [ ] Flask listening on 0.0.0.0:5001
- [ ] Firewall configured
- [ ] `.env` updated with Pi IP
- [ ] Static IP configured (optional)

### Testing
- [ ] Pi camera capture works
- [ ] Recognition works from Pi camera
- [ ] Flask API accessible from PC
- [ ] Node.js backend integration works
- [ ] Frontend button works

### Production
- [ ] Systemd service configured
- [ ] Auto-start enabled
- [ ] Logs monitored
- [ ] Performance acceptable

---

## 🆘 Support Commands

```bash
# On Pi - Service Management
sudo systemctl status lp-service    # Check status
sudo systemctl restart lp-service   # Restart
sudo journalctl -u lp-service -f   # Live logs

# On Pi - Camera Check
rpicam-hello -t 0                  # Camera preview
rpicam-still -o test.jpg           # Take photo

# Network Debugging
ping 192.168.x.x                   # Test connectivity
nc -zv 192.168.x.x 5001           # Test port
curl http://192.168.x.x:5001/health # Test API

# Performance Monitoring
top                                # CPU/Memory
vcgencmd measure_temp              # Pi temperature
```

---

## 📚 References

- [Picamera2 Documentation](https://datasheets.raspberrypi.com/camera/picamera2-manual.pdf)
- [Raspberry Pi Camera Docs](https://www.raspberrypi.com/documentation/computers/camera_software.html)
- [rpicam-apps](https://github.com/raspberrypi/rpicam-apps)
- [Flask Deployment](https://flask.palletsprojects.com/en/2.3.x/deploying/)

---

**Estimated Total Time:** 10-15 giờ
**Difficulty:** ⭐⭐⭐⭐ (Medium-Hard)
**Prerequisites:** SSH access, basic Linux knowledge, Python basics

**Success Criteria:**
✅ Có thể chụp ảnh từ Pi Camera
✅ Nhận diện biển số từ Pi Camera hoạt động
✅ Frontend button hoạt động và auto-fill được
✅ Hệ thống ổn định và có thể auto-restart

---

**Good luck with your migration! 🚀🍓**
