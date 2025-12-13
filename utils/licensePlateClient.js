const axios = require('axios')
const FormData = require('form-data')
const fs = require('fs')
const logger = require('./logger')

const LP_SERVICE_URL = process.env.LP_SERVICE_URL || 'http://localhost:5001'
const REQUEST_TIMEOUT = 15000 // 15 seconds

/**
 * License Plate Recognition Client
 * Communicates with Python Flask service for license plate recognition
 */
class LicensePlateClient {
  /**
   * Recognize license plate from image file
   * @param {string} imagePath - Path to image file
   * @returns {Promise<Object>} Recognition result
   *   { success: boolean, licensePlate: string, confidence: number, error?: string }
   */
  static async recognizeFromFile(imagePath) {
    try {
      // Check if file exists
      if (!fs.existsSync(imagePath)) {
        logger.error(`Image file not found: ${imagePath}`)
        return {
          success: false,
          error: 'Image file not found'
        }
      }

      // Create form data
      const formData = new FormData()
      formData.append('file', fs.createReadStream(imagePath))

      logger.info(`Calling LP recognition service for file: ${imagePath}`)

      // Call Python API
      const response = await axios.post(
        `${LP_SERVICE_URL}/api/recognize`,
        formData,
        {
          headers: {
            ...formData.getHeaders()
          },
          timeout: REQUEST_TIMEOUT
        }
      )

      if (response.data.success) {
        logger.info(`License plate recognized: ${response.data.data.licensePlate}`)
        return {
          success: true,
          licensePlate: response.data.data.licensePlate,
          confidence: response.data.data.confidence,
          timestamp: response.data.data.timestamp
        }
      } else {
        logger.warn(`Recognition failed: ${response.data.error}`)
        return {
          success: false,
          error: response.data.error
        }
      }
    } catch (error) {
      logger.error('License plate recognition error:', error.message)

      // Handle specific error types
      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'License plate recognition service is not running'
        }
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Recognition service timeout'
        }
      }

      return {
        success: false,
        error: error.response?.data?.error || error.message
      }
    }
  }

  /**
   * Recognize license plate from camera
   * @param {number} cameraId - Camera device ID (default: 0)
   * @returns {Promise<Object>} Recognition result
   */
  static async recognizeFromCamera(cameraId = 0) {
    try {
      logger.info(`Capturing from camera ${cameraId} for LP recognition`)

      const response = await axios.post(
        `${LP_SERVICE_URL}/api/recognize/camera`,
        { cameraId },
        { timeout: REQUEST_TIMEOUT }
      )

      if (response.data.success) {
        logger.info(`License plate recognized from camera: ${response.data.data.licensePlate}`)
        return {
          success: true,
          licensePlate: response.data.data.licensePlate,
          confidence: response.data.data.confidence,
          timestamp: response.data.data.timestamp
        }
      } else {
        logger.warn(`Camera recognition failed: ${response.data.error}`)
        return {
          success: false,
          error: response.data.error
        }
      }
    } catch (error) {
      logger.error('Camera recognition error:', error.message)

      if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: 'License plate recognition service is not running'
        }
      } else if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: 'Camera capture timeout'
        }
      }

      return {
        success: false,
        error: error.response?.data?.error || error.message
      }
    }
  }

  /**
   * Check if license plate recognition service is healthy
   * @returns {Promise<boolean>} True if service is available
   */
  static async healthCheck() {
    try {
      const response = await axios.get(`${LP_SERVICE_URL}/health`, {
        timeout: 5000
      })

      const isHealthy = response.data.status === 'ok' && response.data.ready

      if (isHealthy) {
        logger.info('LP recognition service is healthy')
      } else {
        logger.warn('LP recognition service is not ready')
      }

      return isHealthy
    } catch (error) {
      logger.error('LP recognition service health check failed:', error.message)
      return false
    }
  }

  /**
   * Test recognition service with built-in test image
   * @returns {Promise<Object>} Test result
   */
  static async testService() {
    try {
      const response = await axios.get(`${LP_SERVICE_URL}/api/test`, {
        timeout: REQUEST_TIMEOUT
      })

      return response.data
    } catch (error) {
      logger.error('LP recognition service test failed:', error.message)
      return {
        success: false,
        error: error.message
      }
    }
  }

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

  /**
   * Get service URL configuration
   * @returns {string} Service URL
   */
  static getServiceUrl() {
    return LP_SERVICE_URL
  }
}

module.exports = LicensePlateClient
