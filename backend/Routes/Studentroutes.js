// routes/studentsRoutes.js
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const studentsController = require('../Controllers/Studentcontroller');
const authMiddleware = require('../Middleware/Authmiddleware');
const requireRole = require('../Middleware/Rolemiddlewares');

// Create students inside a section (principal OR teacher)
router.post(
  '/:sectionId/students',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [
    param('sectionId').isUUID().withMessage('Valid sectionId required'),

    // accept either single student fields OR students array
    body('students').optional().isArray(),
    // if single student: body fields validated below
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('full_name').optional().notEmpty().withMessage('Full name required'),
    body('roll_number').optional().isString()
  ],
  studentsController.createStudents
);

// Fetch students in a section (principal, teacher, student? choose roles — here we protect, allow principal & teacher)
router.get(
  '/:sectionId/students',
  authMiddleware,
  requireRole(['principal', 'teacher']),
  [param('sectionId').isUUID().withMessage('Valid sectionId required')],
  studentsController.getStudentsInSection
);

module.exports = router;
