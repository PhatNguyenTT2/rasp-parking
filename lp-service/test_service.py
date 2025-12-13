"""
Test script for License Plate Recognition Service
Run this to verify the service is working correctly
"""

import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(__file__))

from lp_recognition_service import get_recognition_service

def test_service():
    """Test the recognition service"""
    print("=" * 60)
    print("🧪 License Plate Recognition Service - Test Suite")
    print("=" * 60)
    
    # Initialize service
    print("\n1️⃣  Initializing service...")
    try:
        service = get_recognition_service()
        print("✅ Service initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize service: {e}")
        return False
    
    # Test with sample image
    print("\n2️⃣  Testing with sample image...")
    test_image_path = os.path.join(
        os.path.dirname(__file__),
        '..',
        'License-Plate-Recognition',
        'test_image',
        '3.jpg'
    )
    
    if not os.path.exists(test_image_path):
        print(f"⚠️  Sample image not found: {test_image_path}")
        print("   Please ensure License-Plate-Recognition/test_image/3.jpg exists")
        return False
    
    print(f"   Image: {test_image_path}")
    
    try:
        result = service.recognize_from_image(test_image_path)
        
        if result['success']:
            print(f"✅ Recognition successful!")
            print(f"   License Plate: {result['licensePlate']}")
            print(f"   Confidence: {result.get('confidence', 0):.2%}")
        else:
            print(f"❌ Recognition failed: {result.get('error', 'Unknown error')}")
            return False
            
    except Exception as e:
        print(f"❌ Error during recognition: {e}")
        return False
    
    # Test camera (optional - may fail if no camera)
    print("\n3️⃣  Testing camera capture (optional)...")
    try:
        result = service.recognize_from_camera(0)
        
        if result['success']:
            print(f"✅ Camera capture successful!")
            print(f"   License Plate: {result['licensePlate']}")
            print(f"   Confidence: {result.get('confidence', 0):.2%}")
        else:
            print(f"⚠️  Camera capture failed: {result.get('error', 'Unknown error')}")
            print("   This is expected if no camera is connected")
            
    except Exception as e:
        print(f"⚠️  Camera test skipped: {e}")
        print("   This is expected if no camera is connected")
    
    print("\n" + "=" * 60)
    print("✅ TEST COMPLETED SUCCESSFULLY")
    print("=" * 60)
    print("\n💡 Next steps:")
    print("   1. Start the API server: python api_server.py")
    print("   2. Test the API: curl http://localhost:5001/api/test")
    print("   3. Check health: curl http://localhost:5001/health")
    
    return True


if __name__ == '__main__':
    success = test_service()
    sys.exit(0 if success else 1)
