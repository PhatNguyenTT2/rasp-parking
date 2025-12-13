const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const config = require('./utils/config')
const logger = require('./utils/logger')
const middleware = require('./utils/middleware')
const parkingLogRouter = require('./controller/parkingLogs')

const app = express()

logger.info('connecting to', config.MONGODB_URI)

mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    logger.info('connected to MongoDB')
  })
  .catch(error => {
    logger.error('error connection to MongoDB:', error.message)
  })

// CORS configuration - cho phép frontend gọi API
app.use(cors())

app.use(express.json())
app.use(middleware.requestLogger)

// API routes MUST come before static files
app.use('/api/parking/logs', parkingLogRouter)

// Serve static files (frontend build & images)
app.use(express.static('dist'))
app.use(express.static('public'))

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app
