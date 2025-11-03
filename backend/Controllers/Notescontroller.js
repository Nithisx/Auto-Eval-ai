// Controllers/Notescontroller.js
const fs = require("fs");
const path = require("path");
const pool = require("../Config/Config");
const UploadsModel = require("../Model/Uploads");
const ClassesModel = require("../Model/Class");
const SubjectsModel = require("../Model/Subjects");
const ExamsModel = require("../Model/Exams");
const QuestionsModel = require("../Model/Questions");
const RubricsModel = require("../Model/Rubrics");
const { BASE_NOTES_DIR } = require("../Middleware/Notesuploadmiddleware");

const notesController = {
  // POST /api/sections/:sectionId/exams/:examId/subjects/:subjectId/notes
  // Accepts: multipart form-data with file field 'file' and a text field 'notes_json' containing the JSON payload (string).
  // Accepts: application/json with notes data
  async uploadNotesJson(req, res, next) {
    try {
      const uploader = req.user; // { user_id, role, ... }
      const { sectionId, examId, subjectId } = req.params;

      // Validate section exists
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: "Section not found" });

      // Validate exam exists
      const exam = await ExamsModel.getExamById(examId);
      if (!exam) return res.status(404).json({ error: "Exam not found" });

      // Validate subject exists
      const subject = await SubjectsModel.findById(subjectId);
      if (!subject) return res.status(404).json({ error: "Subject not found" });

      // Authorization: principal allowed; teacher must be assigned
      if (uploader.role === "teacher") {
        const assigned = await ClassesModel.isTeacherAssigned(
          uploader.user_id,
          section.class_id,
          sectionId
        );
        if (!assigned)
          return res
            .status(403)
            .json({ error: "Forbidden: you are not assigned to this section" });
      } else if (uploader.role !== "principal" && uploader.role !== "admin") {
        return res.status(403).json({
          error: "Forbidden: only principal/assigned teacher can upload notes",
        });
      }

      // Accept raw JSON in body
      const notesObj = req.body;
      if (!notesObj || !Array.isArray(notesObj.questions)) {
        return res.status(400).json({
          error: "Invalid payload: must contain questions[]",
        });
      }

      // Save upload metadata in DB (uploads + uploaded_pages). Use a DB transaction for safety.
      const client = await pool.connect();
      let uploadRow;
      try {
        await client.query("BEGIN");

        // Create uploads row (file_type = 'notes_json')
        uploadRow = await UploadsModel.createUpload(
          {
            uploader_id: uploader.user_id,
            exam_id: examId,
            section_id: sectionId,
            subject_id: subjectId,
            file_name: `${exam.title} - ${subject.name}.json`,
            storage_path: null,
            file_type: "notes_json",
          },
          client
        );

        // Insert each question and its rubrics
        const insertedQuestions = [];
        for (const q of notesObj.questions) {
          const qnum = q.question_number;
          const qtext = q.question_text || q.question || q.prompt || "";
          const qmax = q.max_marks || 0;
          const qideal = q.ideal_answer || null;

          if (typeof qnum === "undefined" || !qtext) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              error:
                "Each question must include question_number and question_text",
            });
          }

          // create question record
          const createdQ = await QuestionsModel.createQuestion(
            {
              exam_id: examId,
              question_number: qnum,
              prompt: qtext,
              max_marks: qmax,
              ideal_answer: qideal,
            },
            client
          );

          // rubrics: object of keys -> { description, weightage }
          const rubricsObject = q.rubrics || {};
          const createdRubrics = [];
          for (const [rubricKey, rubricVal] of Object.entries(rubricsObject)) {
            const title = String(rubricKey);
            const description = rubricVal.description || null;
            const weightage = rubricVal.weightage || rubricVal.weight || 1.0;

            const createdRubric = await RubricsModel.createRubric(
              {
                question_id: createdQ.question_id,
                title,
                description,
                weight: weightage,
                min_score: 0,
                max_score: null,
                created_by: uploader.user_id,
              },
              client
            );

            createdRubrics.push(createdRubric);
          }

          insertedQuestions.push({
            question: createdQ,
            rubrics: createdRubrics,
          });
        }

        await client.query("COMMIT");

        // Success
        return res.status(201).json({
          message: "Notes and exam questions saved to database (JSON)",
          upload: uploadRow,
          section,
          exam,
          subject,
          questions_count: insertedQuestions.length,
          questions: insertedQuestions,
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

  // GET notes for an exam/section/subject
  async listNotes(req, res, next) {
    try {
      const { sectionId, examId, subjectId } = req.params;

      // Query uploads table for exam_id and file_type = 'notes_pdf'
      const { rows } = await pool.query(
        `SELECT upload_id, uploader_id, exam_id, filename, storage_path, file_type, uploaded_at
         FROM uploads
         WHERE exam_id = $1 AND file_type = 'notes_pdf'
         ORDER BY uploaded_at DESC`,
        [examId]
      );

      return res.json({ notes: rows });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = notesController;
