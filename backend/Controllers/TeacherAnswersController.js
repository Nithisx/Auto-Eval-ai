// Controllers/TeacherAnswersController.js
const pool = require("../Config/Config");
const TeacherAnswersModel = require("../Model/TeacherAnswers");
const ClassesModel = require("../Model/Class");
const ExamsModel = require("../Model/Exams");
const SubjectsModel = require("../Model/Subjects");
const { validate: isUuid } = require("uuid");

const path = require("path");
const { upload, BASE_UPLOAD_DIR } = require("../Middleware/Uploadmiddleware");

const teacherAnswersController = {
  // POST /api/sections/:sectionId/exams/:examId/subjects/:subjectId/teacher-answers
  // Body: application/json (the JSON payload with questions[] as in your example)
  async create(req, res, next) {
    try {
      const uploader = req.user; // assume auth middleware set req.user { user_id, role, ... }
      const { sectionId, examId, subjectId } = req.params;

      // Validate UUIDs
      if (!isUuid(sectionId) || !isUuid(examId) || !isUuid(subjectId)) {
        return res.status(400).json({ error: "Invalid IDs in URL" });
      }

      // Validate section/exam/subject existence
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: "Section not found" });

      const exam = await ExamsModel.getExamById(examId);
      if (!exam) return res.status(404).json({ error: "Exam not found" });

      const subject = await SubjectsModel.findById(subjectId);
      if (!subject) return res.status(404).json({ error: "Subject not found" });

      // Authorization: teacher must be assigned to this section (if teacher role)
      if (uploader.role === "teacher") {
        const assigned = await ClassesModel.isTeacherAssigned(
          uploader.user_id,
          section.class_id,
          sectionId
        );
        if (!assigned) {
          return res
            .status(403)
            .json({ error: "Forbidden: you are not assigned to this section" });
        }
      } else if (uploader.role !== "principal" && uploader.role !== "admin") {
        return res.status(403).json({
          error:
            "Forbidden: only principal/assigned teacher/admin can save teacher answers",
        });
      }

      // Handle multipart/form-data (file uploads) AND application/json
      // If a file was uploaded via multer it will be available as req.file
      // `questions` may be a JSON-string when sent with multipart; attempt to parse.
      let payload = req.body || {};
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          // leave as-is
        }
      }

      // If questions came in as a JSON string (common with multipart forms), parse it
      if (payload && typeof payload.questions === "string") {
        try {
          payload.questions = JSON.parse(payload.questions);
        } catch (e) {
          return res
            .status(400)
            .json({ error: "Invalid JSON in questions field" });
        }
      }

      // If files were uploaded (multiple), attach metadata array into the payload so it is saved in the answers column
      if (Array.isArray(req.files) && req.files.length > 0) {
        payload._uploaded_files = [];
        for (const file of req.files) {
          const relPath = path
            .join("uploads", "answers", file.filename)
            .replace(/\\/g, "/");
          payload._uploaded_files.push({
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: relPath,
            absolute_path: file.path,
          });
        }
      } else if (req.file) {
        // backward compatibility if single file was used
        const file = req.file;
        const relPath = path
          .join("uploads", "answers", file.filename)
          .replace(/\\/g, "/");
        payload._uploaded_files = [
          {
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            path: relPath,
            absolute_path: file.path,
          },
        ];
      }

      // Validate request body - we expect JSON with questions[] (but we will store payload as-is)
      const payloadFinal = payload;
      if (!payload || typeof payload !== "object") {
        return res
          .status(400)
          .json({ error: "Invalid body: expected JSON payload" });
      }

      if (!Array.isArray(payloadFinal.questions)) {
        return res
          .status(400)
          .json({ error: "Payload must contain questions[] array" });
      }

      // Optional: quick structural checks on questions entries (basic)
      for (const q of payloadFinal.questions) {
        if (typeof q.question_number === "undefined" || !q.question_text) {
          return res.status(400).json({
            error: "Each question must have question_number and question_text",
          });
        }
      }

      // Save to DB in a transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const toInsert = {
          exam_id: examId,
          section_id: sectionId,
          subject_id: subjectId,
          uploader_id: uploader.user_id,
          total_marks: payloadFinal.total_marks || null,
          answers: payloadFinal, // store the full JSON structure (questions + rubrics + optional _uploaded_file)
        };

        const created = await TeacherAnswersModel.createTeacherAnswer(
          toInsert,
          client
        );

        // After successful upload, update the teacher_answer_id in the subject table
        const updatedSubject = await SubjectsModel.updateTeacherAnswerId(
          subjectId,
          created.teacher_answer_id,
          client
        );

        await client.query("COMMIT");

        return res.status(201).json({
          message: "Teacher answers saved successfully",
          teacher_answer: created,
        });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },

  // GET list for an exam/section/subject (optional helper)
  async list(req, res, next) {
    try {
      const { sectionId, examId, subjectId } = req.params;
      // Pass UUID strings directly without parsing
      const rows = await TeacherAnswersModel.listByExamSectionSubject(
        examId,
        sectionId,
        subjectId
      );
      return res.json({ teacher_answers: rows });
    } catch (err) {
      next(err);
    }
  },

  // GET single by id (optional)
  async getById(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const row = await TeacherAnswersModel.findById(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.json({ teacher_answer: row });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = teacherAnswersController;
