import axios from 'axios'

// Base API URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

/**
 * Parking Log Service
 * Handles all API calls related to parking logs
 */
const parkingLogService = {
  /**
   * Get all parking logs with optional filters
   * @param {Object} params - Query parameters
   * @param {string} params.cardId - Filter by card ID
   * @param {string} params.licensePlate - Filter by license plate
   * @param {string} params.startDate - Filter from date (ISO string)
   * @param {string} params.endDate - Filter to date (ISO string)
   * @param {number} params.page - Page number for pagination
   * @param {number} params.limit - Items per page
   * @returns {Promise<Object>} Response with parking logs array and pagination
   */
  getAllLogs: async (params = {}) => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs`, { params })
      return response.data
    } catch (error) {
      console.error('Error fetching parking logs:', error)
      throw error
    }
  },

  /**
   * Get parking log by ID
   * @param {string} logId - Parking log ID
   * @returns {Promise<Object>} Parking log data
   */
  getLogById: async (logId) => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs/${logId}`)
      return response.data
    } catch (error) {
      console.error('Error fetching parking log:', error)
      throw error
    }
  },

  /**
   * Create new parking log (Vehicle Entry)
   * @param {FormData|Object} logData - Parking log data (FormData or object)
   * @returns {Promise<Object>} Created parking log data
   */
  createLog: async (logData) => {
    try {
      // If logData is FormData, send with multipart/form-data header
      const headers = logData instanceof FormData
        ? { 'Content-Type': 'multipart/form-data' }
        : { 'Content-Type': 'application/json' }

      const response = await axios.post(`${API_URL}/parking/logs`, logData, { headers })
      return response.data
    } catch (error) {
      console.error('Error creating parking log:', error)
      throw error
    }
  },

  /**
   * Update parking log
   * @param {string} logId - Parking log ID
   * @param {Object} logData - Updated parking log data
   * @param {string} logData.licensePlate - License plate (optional)
   * @param {string} logData.cardId - Card ID (optional)
   * @param {string} logData.image - Image URL (optional)
   * @param {Date|string} logData.entryTime - Entry time (optional)
   * @returns {Promise<Object>} Updated parking log data
   */
  updateLog: async (logId, logData) => {
    try {
      const response = await axios.put(`${API_URL}/parking/logs/${logId}`, logData)
      return response.data
    } catch (error) {
      console.error('Error updating parking log:', error)
      throw error
    }
  },

  /**
   * Delete parking log (Vehicle Exit)
   * @param {string} logId - Parking log ID
   * @returns {Promise<Object>} Success message with parking duration
   */
  deleteLog: async (logId) => {
    try {
      const response = await axios.delete(`${API_URL}/parking/logs/${logId}`)
      return response.data
    } catch (error) {
      console.error('Error deleting parking log:', error)
      throw error
    }
  },

  /**
   * Auto-recognize license plate from uploaded image
   * @param {File} imageFile - Image file object
   * @returns {Promise<Object>} Recognition result with license plate
   */
  recognizeFromImage: async (imageFile) => {
    try {
      const formData = new FormData()
      formData.append('image', imageFile)

      const response = await axios.post(
        `${API_URL}/parking/logs/recognize`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )

      return response.data
    } catch (error) {
      console.error('Error recognizing license plate from image:', error)
      throw error
    }
  },

  /**
   * Trigger camera to capture and recognize license plate
   * @param {number} cameraId - Camera ID (default: 0)
   * @returns {Promise<Object>} Recognition result with license plate
   */
  recognizeFromCamera: async (cameraId = 0) => {
    try {
      const response = await axios.post(
        `${API_URL}/parking/logs/recognize/camera`,
        { cameraId }
      )

      return response.data
    } catch (error) {
      console.error('Error capturing from camera:', error)
      throw error
    }
  },

  /**
   * Check if license plate recognition service is healthy
   * @returns {Promise<Object>} Health status
   */
  checkLPServiceHealth: async () => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs/lp-service/health`)
      return response.data
    } catch (error) {
      console.error('Error checking LP service health:', error)
      throw error
    }
  },

  /**
   * Get current parking (vehicles currently in parking lot)
   * @returns {Promise<Object>} List of vehicles currently parked
   */
  getCurrentParking: async () => {
    try {
      // Lấy toàn bộ xe trong bãi (limit cao để đảm bảo lấy hết)
      const response = await axios.get(`${API_URL}/parking/logs`, {
        params: { limit: 1000 }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching current parking:', error)
      throw error
    }
  },

  /**
   * Find parking log by card ID
   * @param {string} cardId - Card ID to search
   * @returns {Promise<Object>} Parking log data
   */
  findByCardId: async (cardId) => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs`, {
        params: { cardId }
      })
      return response.data
    } catch (error) {
      console.error('Error finding parking log by card ID:', error)
      throw error
    }
  },

  /**
   * Find parking logs by license plate
   * @param {string} licensePlate - License plate to search
   * @returns {Promise<Object>} Parking logs matching license plate
   */
  findByLicensePlate: async (licensePlate) => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs`, {
        params: { licensePlate }
      })
      return response.data
    } catch (error) {
      console.error('Error finding parking logs by license plate:', error)
      throw error
    }
  },

  /**
   * Get parking logs with date range filter
   * @param {string|Date} startDate - Start date
   * @param {string|Date} endDate - End date
   * @returns {Promise<Object>} Filtered parking logs
   */
  getLogsByDateRange: async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs`, {
        params: {
          startDate: startDate instanceof Date ? startDate.toISOString() : startDate,
          endDate: endDate instanceof Date ? endDate.toISOString() : endDate
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching parking logs by date range:', error)
      throw error
    }
  },

  /**
   * Get today's parking logs
   * @returns {Promise<Object>} Today's parking logs
   */
  getTodayLogs: async () => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const response = await axios.get(`${API_URL}/parking/logs`, {
        params: {
          startDate: today.toISOString(),
          endDate: tomorrow.toISOString()
        }
      })
      return response.data
    } catch (error) {
      console.error('Error fetching today\'s parking logs:', error)
      throw error
    }
  },

  /**
   * Search parking logs
   * @param {string} searchTerm - License plate or card ID to search
   * @returns {Promise<Object>} Search results
   */
  searchLogs: async (searchTerm) => {
    try {
      // Try searching by both license plate and card ID
      const [licensePlateResults, cardIdResults] = await Promise.all([
        axios.get(`${API_URL}/parking/logs`, { params: { licensePlate: searchTerm } }),
        axios.get(`${API_URL}/parking/logs`, { params: { cardId: searchTerm } })
      ])

      // Combine and deduplicate results
      const allLogs = [
        ...licensePlateResults.data.data.parkingLogs,
        ...cardIdResults.data.data.parkingLogs
      ]

      const uniqueLogs = Array.from(
        new Map(allLogs.map(log => [log.id, log])).values()
      )

      return {
        success: true,
        data: {
          parkingLogs: uniqueLogs,
          pagination: licensePlateResults.data.data.pagination
        }
      }
    } catch (error) {
      console.error('Error searching parking logs:', error)
      throw error
    }
  },

  /**
   * Get all parking logs
   * @returns {Promise<Object>} All parking logs
   */
  getLogsPaginated: async () => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs`)
      return response.data
    } catch (error) {
      console.error('Error fetching parking logs:', error)
      throw error
    }
  },

  /**
   * Process vehicle exit
   * Helper method to handle exit workflow
   * @param {string} cardId - Card ID
   * @param {string} exitLicensePlate - License plate detected at exit
   * @returns {Promise<Object>} Exit result with validation
   */
  processExit: async (cardId, exitLicensePlate) => {
    try {
      // Find entry log by card ID
      const entryResponse = await axios.get(`${API_URL}/parking/logs`, {
        params: { cardId }
      })

      if (!entryResponse.data.data.parkingLogs.length) {
        return {
          success: false,
          error: {
            code: 'NO_ENTRY_FOUND',
            message: 'No entry record found for this card'
          }
        }
      }

      const entryLog = entryResponse.data.data.parkingLogs[0]

      // Validate license plate match
      const licensePlateMatch =
        entryLog.licensePlate.toUpperCase() === exitLicensePlate.toUpperCase()

      if (!licensePlateMatch) {
        return {
          success: false,
          error: {
            code: 'LICENSE_PLATE_MISMATCH',
            message: 'License plate does not match',
            details: {
              entry: entryLog.licensePlate,
              exit: exitLicensePlate
            },
            entryImage: entryLog.image // Add entry image for comparison
          },
          data: {
            _id: entryLog.id,
            id: entryLog.id,
            licensePlate: entryLog.licensePlate,
            cardId: entryLog.cardId,
            image: entryLog.image,
            entryTime: entryLog.entryTime
          }
        }
      }

      // Don't delete yet - just return entry log data for confirmation
      // Frontend will call deleteLog() after user confirms
      return {
        success: true,
        data: {
          _id: entryLog.id,
          id: entryLog.id,
          licensePlate: entryLog.licensePlate,
          cardId: entryLog.cardId,
          image: entryLog.image,
          entryTime: entryLog.entryTime
        },
        message: 'License plate validated - ready for exit confirmation'
      }
    } catch (error) {
      console.error('Error processing vehicle exit:', error)
      throw error
    }
  },

  /**
   * Get parking statistics
   * @param {string} startDate - Start date (optional)
   * @param {string} endDate - End date (optional)
   * @returns {Promise<Object>} Parking statistics
   */
  getStatistics: async (startDate = null, endDate = null) => {
    try {
      const params = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const response = await axios.get(`${API_URL}/parking/logs`, { params })
      const logs = response.data.data.parkingLogs

      // Calculate statistics
      const statistics = {
        total: logs.length,
        uniqueVehicles: new Set(logs.map(log => log.licensePlate)).size,
        uniqueCards: new Set(logs.map(log => log.cardId)).size,
        averageParkingDuration: logs.length > 0
          ? logs.reduce((acc, log) => {
            const duration = Date.now() - new Date(log.entryTime).getTime()
            return acc + duration
          }, 0) / logs.length
          : 0
      }

      return {
        success: true,
        data: statistics
      }
    } catch (error) {
      console.error('Error fetching parking statistics:', error)
      throw error
    }
  },

  /**
   * Recognize from Raspberry Pi Camera
   * @returns {Promise<Object>} Recognition result
   */
  recognizeFromPiCamera: async () => {
    try {
      const response = await axios.post(`${API_URL}/parking/logs/recognize/pi-camera`)
      return response.data
    } catch (error) {
      console.error('Pi Camera recognition failed:', error)
      throw error
    }
  },

  /**
   * Test camera availability
   * @returns {Promise<Object>} Camera test result
   */
  testCamera: async () => {
    try {
      const response = await axios.get(`${API_URL}/parking/logs/camera/test`)
      return response.data
    } catch (error) {
      console.error('Camera test failed:', error)
      throw error
    }
  }
}

export default parkingLogService
