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
        
        self.picam = None
        self.is_initialized = False
        
        try:
            # Create Picamera2 instance
            self.picam = Picamera2()
            
            # Use preview configuration instead of still (more compatible)
            # and lower resolution for better performance
            camera_config = self.picam.create_preview_configuration(
                main={"size": (1280, 720), "format": "RGB888"}
            )
            
            # Configure camera
            self.picam.configure(camera_config)
            
            # IMPORTANT: Start camera và đợi nó khởi tạo hoàn toàn
            self.picam.start()
            
            # Warm up camera - đợi lâu hơn để allocator hoàn tất
            print("⏳ Waiting for camera to warm up...")
            time.sleep(3)
            
            self.is_initialized = True
            print("✅ Pi Camera initialized successfully!")
            
        except Exception as e:
            print(f"❌ Failed to initialize Pi Camera: {e}")
            print("💡 Suggestions:")
            print("   1. Check camera is enabled: sudo raspi-config -> Interface Options -> Camera")
            print("   2. Check camera connection: libcamera-hello --list-cameras")
            print("   3. Reboot Pi: sudo reboot")
            self.is_initialized = False
            if self.picam:
                try:
                    self.picam.close()
                except:
                    pass
            raise
    
    def capture_frame(self):
        """
        Capture single frame from Pi Camera
        
        Returns:
            numpy.ndarray: OpenCV BGR image
        """
        if not self.is_initialized or self.picam is None:
            print("❌ Camera not initialized")
            return None
            
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
        if not self.is_initialized or self.picam is None:
            print("❌ Camera not initialized")
            return False
            
        try:
            self.picam.capture_file(filepath)
            return True
        except Exception as e:
            print(f"❌ Error saving capture: {e}")
            return False
    
    def close(self):
        """Release camera resources"""
        if self.picam is None:
            return
            
        try:
            if self.is_initialized:
                self.picam.stop()
            self.picam.close()
            self.is_initialized = False
            self.picam = None
            print("✅ Pi Camera closed")
        except Exception as e:
            print(f"⚠️ Warning closing camera: {e}")
    
    def __del__(self):
        """Destructor - ensure camera is released"""
        try:
            self.close()
        except:
            pass


def get_picamera():
    """
    Create new Pi Camera instance (no singleton to avoid camera lock)
    
    Returns:
        PiCameraHandler: Camera handler
    """
    return PiCameraHandler()


# Test function
def test_picamera():
    """Test Pi Camera capture"""
    print("\n🧪 Testing Pi Camera...")
    
    camera = None
    try:
        camera = get_picamera()
        
        if not camera.is_initialized:
            print("❌ Camera initialization failed")
            return False
        
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
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False
    finally:
        if camera:
            camera.close()


if __name__ == "__main__":
    # Run test
    success = test_picamera()
    exit(0 if success else 1)
