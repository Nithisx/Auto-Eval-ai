// middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// where to store uploads (ensure this folder is writeable)
const BASE_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'answers');

// ensure base dir exists
fs.mkdirSync(BASE_UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // we'll create a temporary dir per request; controller will move/rename if needed
    cb(null, BASE_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    // unique filename: timestamp + original
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const allowedMime = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/tif',
  'application/pdf'
];

function fileFilter (req, file, cb) {
  if (allowedMime.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Allowed: jpg, png, webp, tiff, pdf'), false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024 // 15 MB per file (tune as needed)
  }
});

module.exports = { upload, BASE_UPLOAD_DIR };
