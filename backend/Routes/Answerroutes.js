// routes/answersRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../Middleware/Authmiddleware');
const requireRole = require('../Middleware/Rolemiddlewares');
const { upload } = require('../Middleware/Uploadmiddleware');
const answersController = require('../Controllers/Answercontroller');

// Mount pattern: section -> student -> exam -> subject -> answers
// Example: POST /api/sections/:sectionId/students/:studentId/exams/:examId/subjects/:subjectId/answers
router.post(
  '/sections/:sectionId/students/:studentId/exams/:examId/subjects/:subjectId/answers',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  // accept up to 20 files named 'files'
  upload.array('files', 20),
  answersController.uploadAnswerSheet
);

module.exports = router;
