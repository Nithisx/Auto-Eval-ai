// routes/studentImageAnswerRoutes.js
const express = require("express");
const { body, param, query } = require("express-validator");
const router = express.Router();
const StudentImageAnswerController = require("../Controllers/Studentimageanswercontroller");
const authMiddleware = require("../Middleware/Authmiddleware");
const requireRole = require("../Middleware/Rolemiddlewares");
const { upload } = require("../Middleware/Uploadmiddleware");

// Submit student image answer (students and principals)
router.post(
  "/student-image-answers",
  authMiddleware,
  requireRole(["student", "principal"]),
  upload.array("images", 10), // Accept up to 10 images
  [
    body("section_id").isUUID().withMessage("Valid section_id required"),
    body("exam_id").isUUID().withMessage("Valid exam_id required"),
    body("subject_id").isUUID().withMessage("Valid subject_id required"),
    body("student_id").isUUID().withMessage("Valid student_id required"),
    body("question_id")
      .optional()
      .isUUID()
      .withMessage("Valid question_id required if provided"),
  ],
  StudentImageAnswerController.submitImageAnswer
);

// Get student image answers with filters (teachers, principals, students)
router.get(
  "/student-image-answers",
  authMiddleware,
  requireRole(["principal", "teacher", "student"]),
  [
    query("section_id")
      .optional()
      .isUUID()
      .withMessage("Valid section_id required"),
    query("exam_id").optional().isUUID().withMessage("Valid exam_id required"),
    query("subject_id")
      .optional()
      .isUUID()
      .withMessage("Valid subject_id required"),
    query("student_id")
      .optional()
      .isUUID()
      .withMessage("Valid student_id required"),
    query("question_id")
      .optional()
      .isUUID()
      .withMessage("Valid question_id required"),
    query("status")
      .optional()
      .isIn(["submitted", "graded", "reviewed"])
      .withMessage("Invalid status"),
  ],
  StudentImageAnswerController.getImageAnswers
);

// Get specific student image answer by ID
router.get(
  "/student-image-answers/:answerId",
  authMiddleware,
  requireRole(["principal", "teacher", "student"]),
  [param("answerId").isUUID().withMessage("Valid answerId required")],
  StudentImageAnswerController.getImageAnswerById
);

// Grade student image answer (teachers and principals only)
router.put(
  "/student-image-answers/:answerId/grade",
  authMiddleware,
  requireRole(["principal", "teacher"]),
  [
    param("answerId").isUUID().withMessage("Valid answerId required"),
    body("status")
      .optional()
      .isIn(["graded", "reviewed"])
      .withMessage("Invalid status"),
    body("marks_obtained")
      .isNumeric()
      .withMessage("Valid marks_obtained required"),
    body("teacher_feedback")
      .optional()
      .isString()
      .withMessage("teacher_feedback must be a string"),
  ],
  StudentImageAnswerController.gradeImageAnswer
);

// Get exam statistics (teachers and principals only)
router.get(
  "/student-image-answers/exam/:examId/statistics",
  authMiddleware,
  requireRole(["principal", "teacher"]),
  [param("examId").isUUID().withMessage("Valid examId required")],
  StudentImageAnswerController.getExamStatistics
);

// Delete student image answer (principals only)
router.delete(
  "/student-image-answers/:answerId",
  authMiddleware,
  requireRole(["principal"]),
  [param("answerId").isUUID().withMessage("Valid answerId required")],
  StudentImageAnswerController.deleteImageAnswer
);

module.exports = router;
