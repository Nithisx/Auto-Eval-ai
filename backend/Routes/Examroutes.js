// routes/examsRoutes.js
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const examsController = require('../Controllers/Examcontroller');
const authMiddleware = require('../Middleware/Authmiddleware');
const requireRole = require('../Middleware/Rolemiddlewares');

// Create exam in a section (principal or teacher)
router.post(
  '/:sectionId/exams',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [
    param('sectionId').isUUID().withMessage('Valid sectionId required'),
    body('title').notEmpty().withMessage('Exam title is required'),
    body('description').optional().isString(),
    body('start_time').optional().isISO8601().toDate(),
    body('end_time').optional().isISO8601().toDate(),
    body('subjects').optional().isArray().withMessage('subjects should be array of names'),
    body('subjects.*').optional().isString().trim().notEmpty(),
    body('subject_ids').optional().isArray().withMessage('subject_ids should be array of uuids'),
    body('subject_ids.*').optional().isUUID().withMessage('each subject_id must be uuid')
  ],
  examsController.createExam
);

// Get exams for section
router.get(
  '/:sectionId/exams',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [param('sectionId').isUUID().withMessage('Valid sectionId required')],
  examsController.getExamsBySection
);

// Add subjects to an existing exam
router.post(
  '/:examId/subjects',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [
    param('examId').isUUID().withMessage('Valid examId required'),
    body('subjects').optional().isArray(),
    body('subjects.*').optional().isString().notEmpty(),
    body('subject_ids').optional().isArray(),
    body('subject_ids.*').optional().isUUID()
  ],
  examsController.addSubjects
);

// Get subjects for an exam
router.get(
  '/subjects/:examId',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [param('examId').isUUID().withMessage('Valid examId required')],
  examsController.getSubjectsByExam
);

module.exports = router;
