// routes/studentAnswersRoutes.js
const express = require("express");
const router = express.Router();
const studentAnswersController = require("../Controllers/StudentAnswersController");
const authMiddleware = require("../Middleware/Authmiddleware");

// Create student answers (accepts JSON body)
router.post(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId/answers",
  authMiddleware,
  studentAnswersController.create
);

// List student answers for an exam/section/subject/student
router.get(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId/answers",
  authMiddleware,
  studentAnswersController.list
);

// Get single student answer by id
router.get(
  "/:id",
  authMiddleware,
  studentAnswersController.getById
);

module.exports = router;
