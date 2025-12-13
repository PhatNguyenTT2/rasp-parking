const mongoose = require('mongoose')

const parkingLogSchema = new mongoose.Schema({
  licensePlate: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  entryTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  cardId: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  // Base64 encoded image data (for deployment without file storage)
  imageData: {
    type: String,
    default: null
  },
  // Image metadata
  imageMeta: {
    mimeType: { type: String },
    size: { type: Number },
    filename: { type: String }
  }
}, {
  timestamps: { createdAt: true, updatedAt: true }
})

// Index để tăng tốc độ truy vấn
parkingLogSchema.index({ licensePlate: 1 })
parkingLogSchema.index({ entryTime: -1 })
parkingLogSchema.index({ cardId: 1 })

// Compound index để truy vấn theo biển số và thời gian vào
parkingLogSchema.index({ licensePlate: 1, cardId: 1, entryTime: -1 })

parkingLogSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('ParkingLog', parkingLogSchema)

