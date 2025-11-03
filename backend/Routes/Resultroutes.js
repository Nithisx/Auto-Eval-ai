// Routes/Resultroutes.js
const express = require("express");
const router = express.Router();
const ResultController = require("../Controllers/Resultcontroller");
const authenticate = require("../Middleware/Authmiddleware");

// Store single result (from LLM service or manual entry)
router.post("/results", authenticate, ResultController.storeResult);

// Store multiple results at once
router.post("/results/bulk", authenticate, ResultController.storeBulkResults);

// Store evaluated result (question-level data from evaluation engine)
router.post(
  "/results/evaluated",
  authenticate,
  ResultController.storeEvaluated
);

// Get single result by ID
router.get("/results/:resultId", authenticate, ResultController.getResultById);

// Get all results for a specific student
router.get(
  "/results/student/:studentId",
  authenticate,
  ResultController.getStudentResults
);

// Get a specific student's result for an exam/section/subject
router.get(
  "/results/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId",
  authenticate,
  ResultController.getStudentExamResult
);

// Get all students' results for an exam/section/subject
router.get(
  "/results/sections/:sectionId/exams/:examId/subjects/:subjectId",
  authenticate,
  ResultController.getSectionExamSubjectResults
);

// Get statistics for an exam/section/subject
router.get(
  "/results/sections/:sectionId/exams/:examId/subjects/:subjectId/statistics",
  authenticate,
  ResultController.getStatistics
);

// Delete a result
router.delete(
  "/results/:resultId",
  authenticate,
  ResultController.deleteResult
);

module.exports = router;
