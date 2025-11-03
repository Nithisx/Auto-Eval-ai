// routes/classesRoutes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const classesController = require("../Controllers/Classcontrollers");
const authMiddleware = require("../Middleware/Authmiddleware");
const requireRole = require("../Middleware/Rolemiddlewares");
const ClassesModel = require("../Model/Class");
const UserModel = require("../Model/Usermodel");


// Create class (principal only)
router.post(
  '/',
  authMiddleware,
  requireRole('principal'),
  [
    body('name').notEmpty().withMessage('Class name is required'),
    body('grade').optional().isInt().withMessage('Grade must be integer'),
    body('sections').optional().isArray().withMessage('sections must be array of strings'),
    body('sections.*').optional().isString().trim().notEmpty().withMessage('Section name must be non-empty')
  ],
  classesController.createClass
);

// Create section for class
router.post(
  '/:classId/sections',
  authMiddleware,
  requireRole('principal'),
  [
    param('classId').isUUID().withMessage('Valid classId required'),
    body('name').notEmpty().withMessage('Section name required')
  ],
  classesController.createSection
);

// Get all classes with sections
router.get('/', authMiddleware, classesController.getClasses);

// Get sections for a class
router.get('/:classId/sections', authMiddleware, [param('classId').isUUID().withMessage('Valid classId required')], classesController.getSections);

// Delete a class (principal only)
router.delete(
  '/:classId',
  authMiddleware,
  requireRole('principal'),
  [param('classId').isUUID().withMessage('Valid classId required')],
  async (req, res, next) => {
    try {
      const { classId } = req.params;
      const ok = await ClassesModel.deleteClass(classId);
      if (!ok) return res.status(404).json({ error: 'Class not found' });
      res.json({ deleted: true });
    } catch (err) { next(err); }
  }
);

// Delete a section within a class (principal only)
router.delete(
  '/:classId/sections/:sectionId',
  authMiddleware,
  requireRole('principal'),
  [
    param('classId').isUUID().withMessage('Valid classId required'),
    param('sectionId').isUUID().withMessage('Valid sectionId required')
  ],
  async (req, res, next) => {
    try {
      const { sectionId } = req.params;
      const ok = await ClassesModel.deleteSection(sectionId);
      if (!ok) return res.status(404).json({ error: 'Section not found' });
      res.json({ deleted: true });
    } catch (err) { next(err); }
  }
);

module.exports = router;

// --- Teacher assignment endpoints ---

// List available teachers (helper under /classes scope for simplicity)
router.get(
  '/teachers/all',
  authMiddleware,
  requireRole(['principal','admin']),
  async (req, res, next) => {
    try {
      const teachers = await UserModel.listByRole('teacher');
      res.json({ teachers });
    } catch (err) { next(err); }
  }
);

// Get assigned teachers for a section
router.get(
  '/:classId/sections/:sectionId/teachers',
  authMiddleware,
  requireRole(['principal','admin']),
  [
    param('classId').isUUID(),
    param('sectionId').isUUID()
  ],
  async (req, res, next) => {
    try {
      const { classId, sectionId } = req.params;
      const list = await ClassesModel.listAssignedTeachers(classId, sectionId);
      res.json({ teachers: list });
    } catch (err) { next(err); }
  }
);

// Assign teacher to section
router.post(
  '/:classId/sections/:sectionId/assign-teacher',
  authMiddleware,
  requireRole(['principal','admin']),
  [
    param('classId').isUUID(),
    param('sectionId').isUUID(),
    body('teacher_id').isUUID().withMessage('teacher_id required')
  ],
  async (req, res, next) => {
    try {
      const { classId, sectionId } = req.params;
      const { teacher_id } = req.body;
      const created = await ClassesModel.assignTeacher({ teacher_id, class_id: classId, section_id: sectionId });
      res.status(201).json({ assigned: created !== null, teacher_id });
    } catch (err) { next(err); }
  }
);

// Remove teacher assignment
router.delete(
  '/:classId/sections/:sectionId/assign-teacher/:teacherId',
  authMiddleware,
  requireRole(['principal','admin']),
  [
    param('classId').isUUID(),
    param('sectionId').isUUID(),
    param('teacherId').isUUID()
  ],
  async (req, res, next) => {
    try {
      const { classId, sectionId, teacherId } = req.params;
      await ClassesModel.removeTeacherAssignment(teacherId, classId, sectionId);
      res.json({ removed: true });
    } catch (err) { next(err); }
  }
);
