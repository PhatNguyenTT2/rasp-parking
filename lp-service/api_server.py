"""
Flask REST API Server for License Plate Recognition
Provides HTTP endpoints for Node.js backend to call Python recognition service
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
import uuid
from datetime import datetime
from lp_recognition_service import get_recognition_service
import cv2
import numpy as np

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
UPLOAD_FOLDER = 'uploads'
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'bmp'}

# Create upload folder if not exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize recognition service
try:
    recognition_service = get_recognition_service()
    SERVICE_READY = True
except Exception as e:
    print(f"❌ Failed to initialize recognition service: {e}")
    SERVICE_READY = False


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok' if SERVICE_READY else 'error',
        'service': 'License Plate Recognition API',
        'version': '1.0.0',
        'ready': SERVICE_READY
    })


@app.route('/api/recognize', methods=['POST'])
def recognize_license_plate():
    """
    Recognize license plate from uploaded image
    🆕 Now returns base64 encoded image for database storage
    
    Request:
        - Multipart form-data with 'file' field
        OR
        - JSON with 'image' field (base64 encoded)
    
    Response:
        {
            "success": true,
            "data": {
                "licensePlate": "59A1-2345",
                "confidence": 0.95,
                "imageData": "data:image/jpeg;base64,...",
                "imageMeta": {...},
                "timestamp": "2025-12-08T10:30:00"
            }
        }
    """
    if not SERVICE_READY:
        return jsonify({
            'success': False,
            'error': 'Recognition service not ready'
        }), 503
    
    try:
        filepath = None
        image_base64 = None
        mime_type = None
        file_size = 0
        original_filename = None
        
        # Handle multipart file upload
        if 'file' in request.files:
            file = request.files['file']
            
            if file.filename == '':
                return jsonify({
                    'success': False,
                    'error': 'No file selected'
                }), 400
            
            if not allowed_file(file.filename):
                return jsonify({
                    'success': False,
                    'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'
                }), 400
            
            # Read file into memory
            file_bytes = file.read()
            file_size = len(file_bytes)
            
            if file_size > MAX_FILE_SIZE:
                return jsonify({
                    'success': False,
                    'error': 'File too large (max 10MB)'
                }), 400
            
            # Store metadata
            mime_type = file.content_type or 'image/jpeg'
            original_filename = file.filename
            
            # Convert to base64 for response
            image_base64 = base64.b64encode(file_bytes).decode('utf-8')
            
            # Save temporary file for recognition
            filename = f"{uuid.uuid4()}.jpg"
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            with open(filepath, 'wb') as f:
                f.write(file_bytes)
        
        # Handle base64 encoded image
        elif request.is_json and 'image' in request.json:
            try:
                image_data = request.json['image']
                # Remove data URL prefix if present
                if ',' in image_data:
                    header, image_data = image_data.split(',', 1)
                    # Extract mime type from header
                    if 'data:' in header:
                        mime_type = header.split(':')[1].split(';')[0]
                else:
                    mime_type = 'image/jpeg'
                
                # Decode base64
                image_bytes = base64.b64decode(image_data)
                file_size = len(image_bytes)
                image_base64 = image_data  # Already base64
                original_filename = 'camera_capture.jpg'
                
                # Save to temporary file for recognition
                filename = f"{uuid.uuid4()}.jpg"
                filepath = os.path.join(UPLOAD_FOLDER, filename)
                with open(filepath, 'wb') as f:
                    f.write(image_bytes)
            except Exception as e:
                return jsonify({
                    'success': False,
                    'error': f'Invalid base64 image: {str(e)}'
                }), 400
        
        else:
            return jsonify({
                'success': False,
                'error': 'No image provided. Send multipart file or JSON with base64 image'
            }), 400
        
        # Recognize license plate
        result = recognition_service.recognize_from_image(filepath)
        
        # Clean up temporary file
        try:
            if filepath and os.path.exists(filepath):
                os.remove(filepath)
        except Exception as e:
            print(f"Warning: Could not delete temp file: {e}")
        
        # Return result with base64 image data
        if result['success']:
            response_data = {
                'licensePlate': result['licensePlate'],
                'confidence': result.get('confidence', 0),
                'timestamp': datetime.now().isoformat()
            }
            
            # Add base64 image data if available
            if image_base64:
                response_data['imageData'] = f'data:{mime_type};base64,{image_base64}'
                response_data['imageMeta'] = {
                    'mimeType': mime_type,
                    'size': file_size,
                    'filename': original_filename
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
        print(f"Error in /api/recognize: {e}")
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500


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
    
    picam = None
    try:
        from picamera_handler import get_picamera
        import base64
        
        print("📸 Initializing Pi Camera for recognition...")
        
        # Get camera and capture frame
        picam = get_picamera()
        
        if not picam.is_initialized:
            return jsonify({
                'success': False,
                'error': 'Camera initialization failed'
            }), 500
        
        frame = picam.capture_frame()
        
        if frame is None:
            return jsonify({
                'success': False,
                'error': 'Could not capture frame from Pi Camera'
            }), 500
        
        # Process with recognition service
        result = recognition_service._process_image(frame)
        
        if result['success']:
            # Encode frame as base64 for response
            success, buffer = cv2.imencode('.jpg', frame)
            if success:
                jpg_base64 = base64.b64encode(buffer).decode('utf-8')
                image_data = f'data:image/jpeg;base64,{jpg_base64}'
            else:
                image_data = None
            
            response_data = {
                'licensePlate': result['licensePlate'],
                'confidence': result.get('confidence', 0),
                'imageData': image_data,
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
    finally:
        # Always release camera after use
        if picam:
            try:
                picam.close()
            except:
                pass


@app.route('/api/camera/test', methods=['GET'])
def test_camera():
    """
    Test Pi Camera availability
    """
    import platform
    
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


@app.route('/api/camera/preview', methods=['GET'])
def camera_preview():
    """
    Get preview frame from Pi Camera as base64 image
    Used for live preview before capture
    """
    import platform
    
    is_pi = platform.machine() in ['armv7l', 'aarch64']
    
    if not is_pi:
        return jsonify({
            'success': False,
            'error': 'Preview only works on Raspberry Pi'
        }), 400
    
    picam = None
    try:
        from picamera_handler import get_picamera
        import base64
        
        print("📸 Initializing Pi Camera for preview...")
        
        # Get camera and capture frame
        picam = get_picamera()
        
        if not picam.is_initialized:
            return jsonify({
                'success': False,
                'error': 'Camera not initialized'
            }), 500
        
        frame = picam.capture_frame()
        
        if frame is None:
            return jsonify({
                'success': False,
                'error': 'Could not capture preview frame'
            }), 500
        
        # Encode frame as JPEG
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            return jsonify({
                'success': False,
                'error': 'Could not encode frame'
            }), 500
        
        # Convert to base64
        jpg_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'imageData': f'data:image/jpeg;base64,{jpg_base64}',
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
    finally:
        # Always release camera after use
        if picam:
            try:
                picam.close()
            except:
                pass


@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint with sample image"""
    if not SERVICE_READY:
        return jsonify({
            'success': False,
            'error': 'Recognition service not ready'
        }), 503
    
    try:
        # Test with sample image
        test_image_path = os.path.join(
            os.path.dirname(__file__),
            '..',
            'License-Plate-Recognition',
            'test_image',
            '3.jpg'
        )
        
        if not os.path.exists(test_image_path):
            return jsonify({
                'success': False,
                'error': f'Test image not found: {test_image_path}'
            }), 404
        
        result = recognition_service.recognize_from_image(test_image_path)
        
        return jsonify({
            'success': result['success'],
            'data': result if result['success'] else None,
            'error': result.get('error') if not result['success'] else None
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


if __name__ == '__main__':
    import platform
    
    # Check if running on Raspberry Pi
    is_pi = platform.machine() in ['armv7l', 'aarch64']
    
    print("=" * 60)
    print("🚀 License Plate Recognition API Server")
    print("=" * 60)
    
    if is_pi:
        print("🍓 Running on Raspberry Pi")
        print("📡 Listening on all interfaces (0.0.0.0:5001)")
        print(f"🔗 Access from PC: http://<pi-ip-address>:5001")
        host = '0.0.0.0'
    else:
        print("💻 Running on PC")
        print("📡 Listening on localhost:5001")
        host = '127.0.0.1'
    
    print(f"📍 Health Check: http://localhost:5001/health")
    print(f"📍 Recognize Endpoint: POST http://localhost:5001/api/recognize")
    print(f"📍 Pi Camera Endpoint: POST http://localhost:5001/api/recognize/picamera")
    print(f"📍 Camera Test: GET http://localhost:5001/api/camera/test")
    print(f"📍 Camera Preview: GET http://localhost:5001/api/camera/preview")
    print(f"📍 Test Endpoint: GET http://localhost:5001/api/test")
    print("=" * 60)
    print()
    
    # Run Flask app
    app.run(
        host=host,
        port=5001,
        debug=True,
        threaded=True
    )
