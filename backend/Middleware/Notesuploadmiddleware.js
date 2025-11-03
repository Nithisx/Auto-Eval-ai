// middlewares/notesUploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const BASE_NOTES_DIR = path.join(__dirname, '..', 'uploads', 'notes');
fs.mkdirSync(BASE_NOTES_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, BASE_NOTES_DIR);
  },
  filename: function (req, file, cb) {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

function fileFilter(req, file, cb) {
  const mime = file.mimetype;

}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 30 * 1024 * 1024 // 30 MB
  }
});

module.exports = { uploadNotes: upload.single('file'), BASE_NOTES_DIR };
