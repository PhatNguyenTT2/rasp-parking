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
