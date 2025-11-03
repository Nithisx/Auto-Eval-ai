// routes/notesRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../Middleware/Authmiddleware");
const requireRole = require("../Middleware/Rolemiddlewares");
const { uploadNotes } = require("../Middleware/Notesuploadmiddleware");
const notesController = require("../Controllers/Notescontroller");

// Upload notes PDF (principal or teacher)

// Accept raw JSON for notes upload (no file upload)
router.post(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/notes",
  authMiddleware,
  requireRole(["principal", "teacher"]),
  notesController.uploadNotesJson
);

// List notes (for an exam). Protected; adjust roles as needed
router.get(
  "/sections/:sectionId/exams/:examId/subjects/:subjectId/notes",
  authMiddleware,
  requireRole(["principal", "teacher", "student"]), // allow students to view
  notesController.listNotes
);

module.exports = router;
