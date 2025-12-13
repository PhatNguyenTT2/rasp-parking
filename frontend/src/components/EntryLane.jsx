import { useState, useEffect, useRef } from 'react';
import { ArrowDownCircle, Clock, Calendar, Bike, Plus, X, Camera, Upload, Zap } from 'lucide-react';
import parkingLogService from '../../services/parkingLogService';

function EntryLane({ latestEntry, allEntries, onEntryAdded }) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    licensePlate: '',
    cardId: '',
    imageData: null, // Store base64 image data
    imageFile: null  // Store file for upload
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState(null);
  const [liveRecognitionResult, setLiveRecognitionResult] = useState(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [cameraType, setCameraType] = useState('unknown');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Tự động cập nhật selectedEntry khi có xe mới vào (latestEntry thay đổi)
  useEffect(() => {
    if (latestEntry) {
      setSelectedEntry(latestEntry);
    }
  }, [latestEntry]); // Depend on the whole object to catch all changes

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

  const handleEntryClick = async (entry) => {
    try {
      // Set ngay entry từ list để highlight nhanh (optimistic update)
      setSelectedEntry(entry);

      // Fetch chi tiết xe theo ID từ server
      const result = await parkingLogService.getLogById(entry._id || entry.id);
      if (result.success && result.data) {
        // Cập nhật với data mới từ server, giữ nguyên _id để highlight đúng
        setSelectedEntry(result.data);
      }
    } catch (error) {
      console.error('Error fetching entry details:', error);
      // Nếu lỗi thì vẫn giữ entry từ list (đã set ở trên)
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      // Create FormData to send image file
      const submitData = new FormData();
      submitData.append('licensePlate', formData.licensePlate.toUpperCase());
      submitData.append('cardId', formData.cardId);

      // Add image file if exists
      if (formData.imageFile) {
        submitData.append('image', formData.imageFile);
      } else if (formData.imageData) {
        // If only base64 data (from camera), send as string
        submitData.append('imageData', formData.imageData);
      }

      const result = await parkingLogService.createLog(submitData);

      if (result.success) {
        // Show success message
        setSuccess(`Xe ${formData.licensePlate.toUpperCase()} đã vào bãi thành công!`);
        // Reset form
        setFormData({ licensePlate: '', cardId: '', imageData: null, imageFile: null });
        setShowForm(false);
        // Notify parent to refresh data - MUST run to update list
        if (onEntryAdded) {
          await onEntryAdded();
        }
        // Set the newly created entry as selected
        if (result.data) {
          setSelectedEntry(result.data);
        }
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Có lỗi xảy ra khi thêm xe');
      console.error('Error adding entry:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle image upload for license plate recognition
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsRecognizing(true);
    setError('');
    setRecognitionError('');

    try {
      const result = await parkingLogService.recognizeFromImage(file);

      if (result.success) {
        // Auto-fill license plate and store both imageData and file
        setFormData({
          ...formData,
          licensePlate: result.data.licensePlate,
          imageData: result.data.imageData, // base64 from backend
          imageFile: file // original file for upload
        });
        setSuccess(`Nhận diện thành công: ${result.data.licensePlate} (độ tin cậy: ${(result.data.confidence * 100).toFixed(0)}%)`);
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Không thể nhận diện biển số từ ảnh';
      setRecognitionError(errorMsg);
      setTimeout(() => setRecognitionError(''), 5000);
      console.error('Recognition error:', err);
    } finally {
      setIsRecognizing(false);
      // Reset file input
      e.target.value = '';
    }
  };

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

  // Open webcam dialog
  const openWebcam = async () => {
    setShowWebcam(true);
    setRecognitionError('');

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);

      // Set video stream after a short delay to ensure ref is ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      }, 100);

      // Auto-start scanning after a short delay
      setTimeout(() => {
        setIsAutoScanning(true);
        scanIntervalRef.current = setInterval(performAutoScan, 2000);
      }, 1000);
    } catch (err) {
      console.error('Camera access error:', err);
      setRecognitionError('Không thể truy cập camera. Vui lòng cho phép quyền camera trong trình duyệt.');
      setShowWebcam(false);
    }
  };

  // Close webcam and stop stream
  const closeWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setShowWebcam(false);
    setLiveRecognitionResult(null);
    setIsAutoScanning(false);
  };

  // Capture photo from webcam
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsRecognizing(true);
    setRecognitionError('');

    try {
      // Draw video frame to canvas
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        try {
          // Create file from blob
          const file = new File([blob], 'webcam-capture.jpg', { type: 'image/jpeg' });

          // Send to recognition service
          const result = await parkingLogService.recognizeFromImage(file);

          if (result.success) {
            // Auto-fill license plate and image
            setFormData({
              ...formData,
              licensePlate: result.data.licensePlate,
              imageData: result.data.imageData,
              imageFile: file
            });
            setSuccess(`Chụp và nhận diện thành công: ${result.data.licensePlate} (độ tin cậy: ${(result.data.confidence * 100).toFixed(0)}%)`);
            setTimeout(() => setSuccess(''), 4000);
            closeWebcam();
          }
        } catch (err) {
          const errorMsg = err.response?.data?.error?.message || 'Không thể nhận diện biển số từ ảnh';
          setRecognitionError(errorMsg);
          setTimeout(() => setRecognitionError(''), 5000);
          console.error('Recognition error:', err);
        } finally {
          setIsRecognizing(false);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      setRecognitionError('Lỗi khi chụp ảnh từ webcam');
      setIsRecognizing(false);
      console.error('Capture error:', err);
    }
  };

  // Auto-scan function for live recognition
  const performAutoScan = async () => {
    if (!videoRef.current || !canvasRef.current || isRecognizing) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        try {
          const file = new File([blob], 'auto-scan.jpg', { type: 'image/jpeg' });
          const result = await parkingLogService.recognizeFromImage(file);

          if (result.success && result.data.licensePlate) {
            setLiveRecognitionResult({
              licensePlate: result.data.licensePlate,
              confidence: result.data.confidence
            });
          } else {
            setLiveRecognitionResult(null);
          }
        } catch (err) {
          // Silently fail for auto-scan
          setLiveRecognitionResult(null);
        }
      }, 'image/jpeg', 0.8); // Lower quality for faster processing
    } catch (err) {
      console.error('Auto-scan error:', err);
    }
  };

  // Toggle auto-scanning
  const toggleAutoScan = () => {
    if (isAutoScanning) {
      // Stop auto-scan
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setIsAutoScanning(false);
      setLiveRecognitionResult(null);
    } else {
      // Start auto-scan
      setIsAutoScanning(true);
      scanIntervalRef.current = setInterval(performAutoScan, 2000); // Scan every 2 seconds
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col shadow-md border border-gray-200 h-full">
      {/* Header */}
      <div className="bg-emerald-500 text-white p-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <ArrowDownCircle size={24} />
          <h2 className="text-xl font-semibold">Làn Vào - Xe Máy</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-white text-emerald-600 px-4 py-2 rounded-lg font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-2"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Đóng' : 'Thêm Xe'}
        </button>
      </div>

      {/* Success Message Toast */}
      {success && (
        <div className="m-4 mb-0 bg-emerald-100 border border-emerald-300 text-emerald-700 px-4 py-3 rounded-lg flex items-center gap-2 animate-pulse">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="font-medium">{success}</span>
        </div>
      )}

      {/* Entry Form */}
      {showForm && (
        <div className="m-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
          <h3 className="font-semibold mb-3 text-emerald-700">Thêm Xe Vào</h3>

          {/* Auto-Recognition Tools */}
          <div className="mb-4 p-3 bg-white rounded-lg border-2 border-emerald-300 shadow-sm">
            {recognitionError && (
              <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                ⚠️ {recognitionError}
              </div>
            )}

            <div className="flex gap-2">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={isRecognizing}
                />
                <div className={`w-full px-3 py-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-2 transition-all ${isRecognizing
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md'
                  }`}>
                  <Upload size={16} />
                  {isRecognizing ? 'Đang nhận diện...' : 'Upload Ảnh'}
                </div>
              </label>

              <button
                type="button"
                onClick={openWebcam}
                disabled={isRecognizing}
                className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${isRecognizing
                  ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md'
                  }`}
              >
                <Camera size={16} />
                Chụp Camera
              </button>

              {cameraType.includes('Raspberry') && (
                <button
                  type="button"
                  onClick={handlePiCameraCapture}
                  disabled={isRecognizing}
                  className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all ${isRecognizing
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-md'
                    }`}
                >
                  <Camera size={16} />
                  {isRecognizing ? 'Đang chụp...' : 'Chụp Pi Camera'}
                </button>
              )}
            </div>
          </div>

          {/* Image Preview */}
          {formData.imageData && (
            <div className="mb-3 bg-gray-100 rounded-lg overflow-hidden h-96 border border-gray-200">
              <img
                src={formData.imageData}
                alt="Vehicle"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Biển số xe <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.licensePlate}
                onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                placeholder="VD: 59A1-2345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID Thẻ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.cardId}
                onChange={(e) => setFormData({ ...formData, cardId: e.target.value })}
                placeholder="VD: CARD001"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Đang thêm...' : 'Thêm Xe Vào'}
            </button>
          </form>
        </div>
      )}

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="bg-green-600 text-white p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Camera size={20} />
                Chụp Camera & Nhận Diện
              </h3>
              <button
                onClick={closeWebcam}
                className="text-white hover:bg-green-700 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              {recognitionError && (
                <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
                  ⚠️ {recognitionError}
                </div>
              )}

              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-auto"
                  style={{ maxHeight: '60vh' }}
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Capture overlay guide */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`border-4 rounded-lg w-3/4 h-1/2 transition-colors ${liveRecognitionResult ? 'border-green-400 shadow-lg shadow-green-400/50' : 'border-green-400 opacity-50'
                      }`}></div>
                  </div>

                  {/* Live Recognition Result */}
                  {liveRecognitionResult && (
                    <div className="absolute top-4 left-0 right-0 flex justify-center">
                      <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
                        <span className="text-2xl font-bold tracking-wider">
                          {liveRecognitionResult.licensePlate}
                        </span>
                        <span className="text-sm opacity-90">
                          ({(liveRecognitionResult.confidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Auto-scan indicator */}
                  {isAutoScanning && (
                    <div className="absolute top-4 right-4">
                      <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        Đang quét...
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-white text-sm bg-black bg-opacity-50 inline-block px-3 py-1 rounded">
                      {isAutoScanning ? 'Quét tự động đang hoạt động' : 'Đặt biển số xe vào khung hình'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeWebcam}
                  className="flex-1 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Hủy
                </button>
                <button
                  onClick={capturePhoto}
                  disabled={isRecognizing}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${isRecognizing
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-lg'
                    }`}
                >
                  {isRecognizing ? 'Đang nhận diện...' : 'Chụp & Xác Nhận'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Image Display - tăng kích thước hiển thị ảnh */}
        <div className="m-4 bg-gray-100 rounded-lg overflow-hidden h-96 border border-gray-200 flex-shrink-0">
          {(selectedEntry || latestEntry)?.imageData ? (
            <img
              src={(selectedEntry || latestEntry).imageData}
              alt="Entry vehicle"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Bike size={48} className="mb-2 opacity-40" />
              <p className="text-sm">Chờ xe máy vào...</p>
            </div>
          )}
        </div>

        {/* Vehicle Info */}
        {(selectedEntry || latestEntry) ? (
          <div className="mx-4 mb-4 bg-emerald-50 p-4 rounded-lg border border-emerald-200">
            <h3 className="text-base font-semibold mb-3 text-emerald-700 flex items-center gap-2">
              <Bike size={18} />
              Thông Tin Xe Máy Vào
            </h3>

            <div className="space-y-2">
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 text-sm">Biển số:</span>
                <span className="font-bold text-xl text-emerald-600 tracking-wider">
                  {(selectedEntry || latestEntry).licensePlate}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 text-sm">ID Thẻ:</span>
                <span className="font-medium text-gray-800">
                  {(selectedEntry || latestEntry).cardId}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 text-sm">Ngày:</span>
                <span className="font-medium text-gray-800 flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate((selectedEntry || latestEntry).entryTime)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 text-sm">Thời gian:</span>
                <span className="font-medium text-gray-800 flex items-center gap-1">
                  <Clock size={14} />
                  {formatTime((selectedEntry || latestEntry).entryTime)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                <span className="text-gray-600 text-sm">Trạng thái:</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  Đang đỗ
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-4 mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <p className="text-center text-gray-400">Chưa có xe máy vào</p>
          </div>
        )}

        {/* All Parking Logs */}
        <div className="mx-4 mb-4">
          <h3 className="font-semibold mb-3 text-gray-700 flex items-center gap-2">
            <Clock size={18} />
            Toàn Bộ Xe Trong Bãi ({allEntries?.length || 0})
          </h3>
          <div className="space-y-2">
            {allEntries && allEntries.length > 0 ? (
              allEntries.map((vehicle, index) => {
                // So sánh _id hoặc id, chuyển về string để đảm bảo khớp chính xác
                const vehicleId = String(vehicle._id || vehicle.id);
                const selectedId = String(selectedEntry?._id || selectedEntry?.id || '');
                const isSelected = vehicleId === selectedId;
                const isLatest = index === 0;

                return (
                  <div
                    key={vehicle._id || vehicle.id || index}
                    onClick={() => handleEntryClick(vehicle)}
                    className={`p-3 rounded-lg flex justify-between items-center transition-colors border cursor-pointer ${isSelected
                      ? 'bg-emerald-100 border-emerald-400 shadow-sm'
                      : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-emerald-300'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🏍️</span>
                      <span className={`font-medium ${isSelected ? 'text-emerald-700' : 'text-gray-800'}`}>
                        {vehicle.licensePlate}
                      </span>
                      {isLatest && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Mới nhất</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <Clock size={14} />
                      <span>{formatTime(vehicle.entryTime)}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-gray-400 text-sm py-4">Chưa có xe trong bãi</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntryLane;
