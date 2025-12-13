import { useState, useRef } from 'react';
import { ArrowUpCircle, CheckCircle2, XCircle, Clock, Calendar, Timer, Bike, LogOut, Camera, Upload, Zap, X } from 'lucide-react';
import parkingLogService from '../../services/parkingLogService';

function ExitLane({ onExitProcessed }) {
  const [formData, setFormData] = useState({
    cardId: '',
    exitLicensePlate: '',
    exitImage: '',
    exitImageData: null, // Store base64 image data
    exitImageFile: null  // Store file for upload
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [exitTime, setExitTime] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognitionError, setRecognitionError] = useState('');
  const [showWebcam, setShowWebcam] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setIsProcessing(true);

    // Capture exit time when processing starts
    const currentExitTime = new Date();
    setExitTime(currentExitTime);

    try {
      const exitResult = await parkingLogService.processExit(
        formData.cardId,
        formData.exitLicensePlate.toUpperCase()
      );

      if (exitResult.success) {
        // Add exit image and exit time to result
        setResult({
          success: true,
          data: {
            ...exitResult.data,
            exitImage: formData.exitImage,
            actualExitTime: currentExitTime
          },
          message: exitResult.message
        });
        // Clear form inputs after successful processing
        setFormData({ cardId: '', exitLicensePlate: '', exitImage: '', exitImageData: null, exitImageFile: null });
        // Don't refresh data yet - wait for confirmation
      } else {
        setError(exitResult.error.message);
        setResult({
          success: false,
          error: exitResult.error,
          data: exitResult.data, // Include data with ID for deletion
          exitImage: formData.exitImage,
          exitTime: currentExitTime
        });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error?.message || 'Có lỗi xảy ra khi xử lý xe ra';
      setError(errorMsg);
      setResult({
        success: false,
        error: { message: errorMsg },
        data: err.response?.data?.data, // Include data if available
        exitImage: formData.exitImage,
        exitTime: currentExitTime
      });
      console.error('Error processing exit:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle image upload for license plate recognition at exit
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsRecognizing(true);
    setRecognitionError('');

    try {
      const result = await parkingLogService.recognizeFromImage(file);

      if (result.success) {
        // Auto-fill exit license plate and store both imageData and file
        setFormData({
          ...formData,
          exitLicensePlate: result.data.licensePlate,
          exitImageData: result.data.imageData, // base64 from backend
          exitImageFile: file // original file for upload
        });
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
    setShowWebcam(false);
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
            // Auto-fill exit license plate and image
            setFormData({
              ...formData,
              exitLicensePlate: result.data.licensePlate,
              exitImageData: result.data.imageData,
              exitImageFile: file
            });
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

  const calculateDuration = (entry, exit) => {
    if (!entry || !exit) return 'N/A';
    const duration = Math.round((new Date(exit) - new Date(entry)) / 60000); // minutes
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;

    if (hours > 0) {
      return `${hours} giờ ${minutes} phút`;
    }
    return `${minutes} phút`;
  };

  const handleConfirmExit = async () => {
    if (!result?.data?._id && !result?.data?.id) {
      setError('Không tìm thấy ID của log để xác nhận');
      return;
    }

    setIsConfirming(true);
    try {
      const logId = result.data._id || result.data.id;
      const deleteResult = await parkingLogService.deleteLog(logId);

      if (deleteResult.success) {
        // Clear all states
        setResult(null);
        setError('');
        setExitTime(null);
        // Notify parent to refresh data
        if (onExitProcessed) onExitProcessed();
      } else {
        setError('Không thể xóa log: ' + (deleteResult.error?.message || 'Lỗi không xác định'));
      }
    } catch (err) {
      setError('Lỗi khi xóa log: ' + (err.response?.data?.error?.message || err.message));
      console.error('Error deleting log:', err);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden flex flex-col shadow-md border border-gray-200 h-full">
      {/* Header */}
      <div className="bg-blue-500 text-white p-4 flex items-center gap-2 flex-shrink-0">
        <ArrowUpCircle size={24} />
        <h2 className="text-xl font-semibold">Làn Ra - Xe Máy</h2>
      </div>

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="bg-green-600 text-white p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Camera size={20} />
                Chụp Camera & Nhận Diện (Exit)
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
                    <div className="border-4 border-green-400 rounded-lg w-3/4 h-1/2 opacity-50"></div>
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <p className="text-white text-sm bg-black bg-opacity-50 inline-block px-3 py-1 rounded">
                      Đặt biển số xe vào khung hình
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
                  {isRecognizing ? 'Đang nhận diện...' : 'Chụp & Nhận Diện'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Exit Form */}
        <div className="m-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold mb-3 text-blue-700 flex items-center gap-2">
            <LogOut size={18} />
            Xử Lý Xe Ra
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-700 px-3 py-2 rounded text-sm">
                {error}
              </div>
            )}

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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isProcessing}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Biển số xe (Nhận diện) <span className="text-red-500">*</span>
              </label>

              {/* Auto-Recognition Tool for Exit */}
              <div className="mb-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                {recognitionError && (
                  <div className="mb-2 bg-red-50 border border-red-200 text-red-700 px-2 py-1 rounded text-xs">
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
                      disabled={isRecognizing || isProcessing}
                    />
                    <div className={`w-full px-3 py-2 rounded-lg text-center cursor-pointer flex items-center justify-center gap-2 transition-all text-sm ${isRecognizing || isProcessing
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
                    disabled={isRecognizing || isProcessing}
                    className={`flex-1 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm ${isRecognizing || isProcessing
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md'
                      }`}
                  >
                    <Camera size={16} />
                    Chụp Camera
                  </button>
                </div>
              </div>

              {/* Image Preview */}
              {formData.exitImageData && (
                <div className="mb-2 p-3 bg-white rounded-lg border border-blue-300">
                  <p className="text-sm font-medium text-gray-700 mb-2">Ảnh đã chọn:</p>
                  <img
                    src={formData.exitImageData}
                    alt="Exit Vehicle"
                    className="w-full h-200 object-cover rounded-lg border border-gray-200"
                  />
                </div>
              )}

              <input
                type="text"
                required
                value={formData.exitLicensePlate}
                onChange={(e) => setFormData({ ...formData, exitLicensePlate: e.target.value })}
                placeholder="VD: 59A1-2345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isProcessing}
              />
            </div>
            {exitTime && (
              <div className="bg-blue-100 p-3 rounded-lg border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-blue-700 font-medium">Thời gian ra:</span>
                  <span className="text-sm text-blue-900 font-semibold">
                    {formatTime(exitTime)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-blue-600 text-white py-2 rouont-semibold hover:bg-blue-700 transinded-lg ftion-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? 'Đang xử lý...' : (
                <>
                  Xử Lý Xe Ra
                </>
              )}
            </button>
          </form>
        </div>

        {/* Exit Result */}
        {result && (
          <div className={`mx-4 mb-4 p-4 rounded-lg border ${result.success
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
            }`}>
            <h3 className={`text-base font-semibold mb-3 flex items-center gap-2 ${result.success ? 'text-emerald-700' : 'text-red-700'
              }`}>
              <Bike size={18} />
              {result.success ? 'Kết Quả Xử Lý' : 'Lỗi Xử Lý'}
            </h3>

            {result.success ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                  <span className="text-gray-600 text-sm">Biển số vào:</span>
                  <span className="font-bold text-lg text-blue-600 tracking-wider">
                    {result.data.licensePlate}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                  <span className="text-gray-600 text-sm">ID Thẻ:</span>
                  <span className="font-medium text-gray-800">
                    {result.data.cardId}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                  <span className="text-gray-600 text-sm">Thời gian vào:</span>
                  <span className="font-medium text-gray-800 flex items-center gap-1">
                    <Clock size={14} />
                    {formatTime(result.data.entryTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                  <span className="text-gray-600 text-sm">Thời gian ra:</span>
                  <span className="font-medium text-gray-800 flex items-center gap-1">
                    <Clock size={14} />
                    {formatTime(result.data.actualExitTime || result.data.exitTime)}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200">
                  <span className="text-gray-600 text-sm">Thời lượng đỗ:</span>
                  <span className="font-semibold text-blue-600 flex items-center gap-1">
                    <Timer size={14} />
                    {calculateDuration(result.data.entryTime, result.data.actualExitTime || result.data.exitTime)}
                  </span>
                </div>
                <div className="bg-emerald-100 p-3 rounded-lg border border-emerald-300 text-center">
                  <span className="text-emerald-700 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} />
                    Cho phép xe ra - Biển số khớp
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-red-100 p-3 rounded-lg border border-red-300">
                  <p className="text-red-700 font-semibold text-center flex items-center justify-center gap-2">
                    <XCircle size={20} />
                    {result.error?.code === 'LICENSE_PLATE_MISMATCH' ? 'Biển số không khớp!' : 'Không tìm thấy xe!'}
                  </p>
                </div>
                {result.error?.details && (
                  <div className="bg-white p-3 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">Chi tiết:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Biển số vào:</span>
                        <span className="font-medium text-emerald-600">{result.error.details.entry}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Biển số ra:</span>
                        <span className="font-medium text-red-600">{result.error.details.exit}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-yellow-800 text-sm text-center">
                    Không cho phép xe ra - Vui lòng kiểm tra lại
                  </p>
                </div>
              </div>
            )}

            {/* Confirmation Button - appears for both success and error */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <button
                onClick={handleConfirmExit}
                disabled={isConfirming}
                className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${result.success
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                  } disabled:bg-gray-400 disabled:cursor-not-allowed`}
              >
                {isConfirming ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Đang xác nhận...
                  </>
                ) : (
                  <>
                    {result.success ? 'Xác nhận xe ra' : 'Xác nhận xe ra'}
                  </>
                )}
              </button>
              <p className="text-xs text-center mt-2 text-gray-500">
                {result.success
                  ? 'Xác nhận để xóa log khỏi hệ thống'
                  : 'Xác nhận để xóa log mặc dù không cho phép xe ra'
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExitLane;
