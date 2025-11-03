// routes/teacherAnswersRoutes.js
const express = require("express");
const router = express.Router();
const teacherAnswersController = require("../Controllers/TeacherAnswersController");
const authMiddleware = require("../Middleware/Authmiddleware"); // assumes you have auth
const { upload } = require("../Middleware/Uploadmiddleware");

// Create teacher answers (accepts JSON body)
router.post(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/teacher-answers",
  authMiddleware,
  // accept multiple files under field name `files` (front-end should use that name)
  // allow up to 10 files (tweak as needed)
  upload.array("files", 10),
  teacherAnswersController.create
);

// List teacher answers for an exam/section/subject
router.get(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/teacher-answers",
  authMiddleware,
  teacherAnswersController.list
);

// Get single teacher answer by id
router.get("/:id", authMiddleware, teacherAnswersController.getById);

module.exports = router;
