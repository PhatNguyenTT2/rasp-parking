const parkingLogsRouter = require('express').Router();
const ParkingLog = require('../model/parkingLog');
const LicensePlateClient = require('../utils/licensePlateClient');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup multer to store in memory (for base64 conversion)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max for base64 storage
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

/**
 * Parking Logs Controller - Minimal CRUD Approach
 * 
 * Only 5 basic CRUD endpoints:
 * - GET /api/parking/logs - Get all parking logs with filtering
 * - GET /api/parking/logs/:id - Get single parking log by ID
 * - POST /api/parking/logs - Create new parking log (Entry)
 * - PUT /api/parking/logs/:id - Update parking log
 * - DELETE /api/parking/logs/:id - Delete parking log (Exit processed)
 * 
 * Methods NOT implemented as endpoints (waiting for frontend request):
 * - getCurrentParking() - Use GET /api/parking/logs with no exit filter
 * - findByCardId() - Use GET /api/parking/logs?cardId=xxx
 * - findByLicensePlate() - Use GET /api/parking/logs?licensePlate=xxx
 * - getParkingDuration() - Calculate on exit endpoint
 */

/**
 * GET /api/parking/logs
 * Get all parking logs with filtering via query parameters
 * 
 * Query parameters:
 * - cardId: string - Filter by card ID
 * - licensePlate: string - Filter by license plate
 * - startDate: date - Filter from date
 * - endDate: date - Filter to date
 * - page: number - Page number for pagination
 * - limit: number - Items per page
 */
parkingLogsRouter.get('/', async (request, response) => {
  try {
    const {
      cardId,
      licensePlate,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = request.query;

    // Build filter object
    const filter = {};

    if (cardId) {
      filter.cardId = cardId;
    }

    if (licensePlate) {
      filter.licensePlate = licensePlate.toUpperCase();
    }

    // Date range filter
    if (startDate || endDate) {
      filter.entryTime = {};
      if (startDate) {
        filter.entryTime.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.entryTime.$lte = new Date(endDate);
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const parkingLogs = await ParkingLog.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ entryTime: -1 });

    // Get total count for pagination
    const total = await ParkingLog.countDocuments(filter);

    response.json({
      success: true,
      data: {
        parkingLogs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get parking logs error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get parking logs',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/parking/logs/recognize
 * Auto-recognize license plate from uploaded image
 * Use case: Entry lane - upload image, get license plate automatically
 */
parkingLogsRouter.post('/recognize', upload.single('image'), async (request, response) => {
  try {
    if (!request.file) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'No image uploaded',
          code: 'NO_IMAGE'
        }
      });
    }

    // Convert buffer to base64
    const imageBase64 = `data:${request.file.mimetype};base64,${request.file.buffer.toString('base64')}`;

    // Save temporarily to disk for Python service
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempPath = path.join(tempDir, `${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, request.file.buffer);

    // Call Python service to recognize license plate
    const recognitionResult = await LicensePlateClient.recognizeFromFile(tempPath);

    // Delete temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    if (!recognitionResult.success) {
      return response.status(422).json({
        success: false,
        error: {
          message: 'Could not recognize license plate',
          code: 'RECOGNITION_FAILED',
          details: recognitionResult.error
        }
      });
    }

    // 🆕 Return data from Python service (includes imageData and imageMeta)
    response.json({
      success: true,
      data: {
        licensePlate: recognitionResult.licensePlate,
        confidence: recognitionResult.confidence,
        imageData: recognitionResult.imageData || imageBase64, // Use Python's base64 or fallback
        imageMeta: recognitionResult.imageMeta || {
          mimeType: request.file.mimetype,
          size: request.file.size,
          filename: request.file.originalname
        },
        timestamp: recognitionResult.timestamp
      },
      message: 'License plate recognized successfully'
    });

  } catch (error) {
    console.error('Recognition endpoint error:', error);

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to process image',
        code: 'PROCESSING_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/parking/logs/recognize/camera
 * Trigger camera to capture and recognize license plate
 * Use case: Entry/Exit lane - capture from camera
 */
parkingLogsRouter.post('/recognize/camera', async (request, response) => {
  try {
    const { cameraId = 0 } = request.body;

    const recognitionResult = await LicensePlateClient.recognizeFromCamera(cameraId);

    if (!recognitionResult.success) {
      return response.status(422).json({
        success: false,
        error: {
          message: 'Could not recognize license plate from camera',
          code: 'CAMERA_RECOGNITION_FAILED',
          details: recognitionResult.error
        }
      });
    }

    response.json({
      success: true,
      data: {
        licensePlate: recognitionResult.licensePlate,
        confidence: recognitionResult.confidence,
        timestamp: recognitionResult.timestamp
      },
      message: 'License plate captured and recognized successfully'
    });

  } catch (error) {
    console.error('Camera recognition error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to capture from camera',
        code: 'CAMERA_ERROR',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/parking/logs/lp-service/health
 * Check if license plate recognition service is healthy
 */
parkingLogsRouter.get('/lp-service/health', async (request, response) => {
  try {
    const isHealthy = await LicensePlateClient.healthCheck();

    response.json({
      success: true,
      data: {
        healthy: isHealthy,
        serviceUrl: LicensePlateClient.getServiceUrl(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    response.status(500).json({
      success: false,
      error: {
        message: 'Health check failed',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/parking/logs/:id
 * Get single parking log by ID
 */
parkingLogsRouter.get('/:id', async (request, response) => {
  try {
    const parkingLog = await ParkingLog.findById(request.params.id);

    if (!parkingLog) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Parking log not found',
          code: 'PARKING_LOG_NOT_FOUND'
        }
      });
    }

    response.json({
      success: true,
      data: parkingLog
    });
  } catch (error) {
    console.error('Get parking log by ID error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to get parking log',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/parking/logs
 * Create new parking log (Vehicle Entry)
 * Supports base64 image data for deployment
 */
parkingLogsRouter.post('/', upload.single('image'), async (request, response) => {
  try {
    const {
      licensePlate,
      cardId,
      imageData,
      entryTime
    } = request.body;

    // Validation
    if (!licensePlate || !cardId) {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Missing required fields',
          code: 'MISSING_REQUIRED_FIELDS',
          details: 'licensePlate and cardId are required'
        }
      });
    }

    // Check if card is already in use (vehicle not exited yet)
    const existingLog = await ParkingLog.findOne({ cardId });

    if (existingLog) {
      return response.status(409).json({
        success: false,
        error: {
          message: 'Card already in use',
          code: 'CARD_IN_USE',
          details: `Card ${cardId} is already registered for vehicle ${existingLog.licensePlate} at ${existingLog.entryTime}`
        }
      });
    }

    // Prepare image data
    let finalImageData = imageData || null;
    let imageMeta = null;

    // If file uploaded, convert to base64
    if (request.file) {
      finalImageData = `data:${request.file.mimetype};base64,${request.file.buffer.toString('base64')}`;
      imageMeta = {
        mimeType: request.file.mimetype,
        size: request.file.size,
        filename: request.file.originalname
      };
    }

    // Create parking log
    const parkingLog = new ParkingLog({
      licensePlate: licensePlate.toUpperCase(),
      cardId,
      imageData: finalImageData,
      imageMeta: imageMeta,
      entryTime: entryTime || Date.now()
    });

    const savedParkingLog = await parkingLog.save();

    response.status(201).json({
      success: true,
      data: savedParkingLog,
      message: 'Vehicle entry recorded successfully'
    });
  } catch (error) {
    console.error('Create parking log error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to create parking log',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/parking/logs/:id
 * Update parking log
 * Use case: Correct entry data if OCR misread
 */

/**
 * PUT /api/parking/logs/:id
 * Update parking log
 * Use case: Correct entry data if OCR misread
 */
parkingLogsRouter.put('/:id', async (request, response) => {
  try {
    const {
      licensePlate,
      cardId,
      image,
      entryTime
    } = request.body;

    // Find parking log
    const parkingLog = await ParkingLog.findById(request.params.id);

    if (!parkingLog) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Parking log not found',
          code: 'PARKING_LOG_NOT_FOUND'
        }
      });
    }

    // Check if new cardId is already in use (excluding current log)
    if (cardId && cardId !== parkingLog.cardId) {
      const existingLog = await ParkingLog.findOne({
        _id: { $ne: parkingLog._id },
        cardId
      });

      if (existingLog) {
        return response.status(409).json({
          success: false,
          error: {
            message: 'Card already in use',
            code: 'CARD_IN_USE'
          }
        });
      }
    }

    // Update fields
    if (licensePlate !== undefined) parkingLog.licensePlate = licensePlate.toUpperCase();
    if (cardId !== undefined) parkingLog.cardId = cardId;
    if (image !== undefined) parkingLog.image = image;
    if (entryTime !== undefined) parkingLog.entryTime = entryTime;

    const updatedParkingLog = await parkingLog.save();

    response.json({
      success: true,
      data: updatedParkingLog,
      message: 'Parking log updated successfully'
    });
  } catch (error) {
    console.error('Update parking log error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return response.status(400).json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.message
        }
      });
    }

    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to update parking log',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/parking/logs/:id
 * Delete parking log
 * Use case: Remove log after vehicle exit is processed
 * Or cleanup invalid entries
 */
parkingLogsRouter.delete('/:id', async (request, response) => {
  try {
    const parkingLog = await ParkingLog.findById(request.params.id);

    if (!parkingLog) {
      return response.status(404).json({
        success: false,
        error: {
          message: 'Parking log not found',
          code: 'PARKING_LOG_NOT_FOUND'
        }
      });
    }

    // Calculate parking duration before deletion
    const parkingDuration = Date.now() - parkingLog.entryTime;
    const durationInMinutes = Math.floor(parkingDuration / 1000 / 60);

    // Store entry image before deletion
    const entryImage = parkingLog.image;

    // Hard delete - remove from database
    await ParkingLog.findByIdAndDelete(request.params.id);

    response.json({
      success: true,
      message: 'Parking log deleted successfully',
      data: {
        id: parkingLog._id,
        licensePlate: parkingLog.licensePlate,
        cardId: parkingLog.cardId,
        image: entryImage,
        entryTime: parkingLog.entryTime,
        exitTime: new Date(),
        parkingDuration: {
          milliseconds: parkingDuration,
          minutes: durationInMinutes,
          hours: Math.floor(durationInMinutes / 60),
          formatted: `${Math.floor(durationInMinutes / 60)}h ${durationInMinutes % 60}m`
        }
      }
    });
  } catch (error) {
    console.error('Delete parking log error:', error);
    response.status(500).json({
      success: false,
      error: {
        message: 'Failed to delete parking log',
        details: error.message
      }
    });
  }
});

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
    console.error('Pi Camera capture error:', error);
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

module.exports = parkingLogsRouter;
