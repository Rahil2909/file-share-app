const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: String,
  path: String,
  size: Number,
  mimetype: String
});

const roomSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  files: [fileSchema],
  paymentStatus: Boolean,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Room', roomSchema);