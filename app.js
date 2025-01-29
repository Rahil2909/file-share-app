require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const shortid = require('shortid');
const fs = require('fs');
const Room = require('./models/Room');

const app = express();

// Database connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('🚀 Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Routes
app.get('/', (req, res) => res.render('index'));

app.get('/join', async (req, res) => {
  try {
    const code = req.query.code;
    const error = req.query.error;
    
    if (code) {
      const room = await Room.findOne({ code });
      if (!room) {
        return res.redirect('/join?error=Invalid%20room%20code');
      }
      return res.redirect(`/room/${code}`);
    }
    
    res.render('join', { error });
  } catch (error) {
    console.error('Join error:', error);
    res.redirect('/join?error=Server%20error');
  }
});

app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    const files = req.files;
    if (!files?.length) {
      return res.render('error', { message: '📂 No files selected' });
    }

    const MAX_FREE_FILES = 5;
    if (files.length > MAX_FREE_FILES) {
      return res.render('payment_required', {
        fileCount: files.length,
        requiredAmount: 200,
        maxFreeFiles: MAX_FREE_FILES
      });
    }

    const roomCode = shortid.generate();
    const newRoom = new Room({
      code: roomCode,
      files: files.map(file => ({
        filename: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      })),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    await newRoom.save();
    res.redirect(`/room/${roomCode}`);
  } catch (error) {
    console.error('Upload error:', error);
    res.render('error', { message: '🚨 Upload failed: ' + error.message });
  }
});

app.get('/room/:code', async (req, res) => {
  try {
    const room = await Room.findOne({ code: req.params.code });
    if (!room) {
      return res.redirect('/join?error=Room%20not%20found');
    }

    if (room.files.length > 5 && !room.paymentStatus) {
      return res.render('payment_required', {
        fileCount: room.files.length,
        requiredAmount: 200,
        maxFreeFiles: 5
      });
    }

    res.render('room', {
      room,
      shareText: encodeURIComponent(`Access my files using code: ${room.code}`),
      shareUrl: encodeURIComponent(`${process.env.BASE_URL}/room/${room.code}`)
    });
  } catch (error) {
    console.error('Room access error:', error);
    res.redirect('/join?error=Server%20error');
  }
});

app.get('/download/:fileId', async (req, res) => {
  try {
    const room = await Room.findOne({ "files._id": req.params.fileId });
    if (!room) {
      return res.render('error', { message: '❌ File not found' });
    }

    const file = room.files.id(req.params.fileId);
    if (!file) {
      return res.render('error', { message: '❌ File not found' });
    }

    res.download(file.path, file.filename);
  } catch (error) {
    console.error('Download error:', error);
    res.render('error', { message: '🚨 Download failed: ' + error.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global error:', err.stack);
  res.status(500).render('error', { message: '⚠️ Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🔗 Access at: http://localhost:${PORT}`);
});