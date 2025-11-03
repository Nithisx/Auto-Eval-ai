// Controllers/StudentAnswersController.js
const pool = require("../Config/Config");
const StudentAnswersModel = require("../Model/StudentAnswers");
const ClassesModel = require("../Model/Class");
const ExamsModel = require("../Model/Exams");
const SubjectsModel = require("../Model/Subjects");
const StudentsModel = require("../Model/Studentmodel");

/**
 * Basic UUID validation (36-char canonical form). Adjust if you accept other variants.
 */
const isUUID = (id) =>
  typeof id === "string" &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    id
  );

const studentAnswersController = {
  // POST /api/sections/:sectionId/exams/:examId/subjects/:subjectId/students/:studentId/answers
  // Body: { answers: [ { question_number, answer_text }, ... ] }
  async create(req, res, next) {
    try {
      const submitter = req.user; // optional: who is making the request
      const { sectionId, examId, subjectId, studentId } = req.params;

      // Validate UUIDs
      //   if (![examId, sectionId, subjectId, studentId].every(isUUID)) {
      //     return res.status(400).json({ error: "One or more IDs in URL are not valid UUIDs" });
      //   }

      // Validate existence of section/exam/subject (optional but recommended)
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: "Section not found" });

      const exam = await ExamsModel.getExamById(examId);
      if (!exam) return res.status(404).json({ error: "Exam not found" });

      const subject = await SubjectsModel.findById(subjectId);
      if (!subject) return res.status(404).json({ error: "Subject not found" });

      // Validate body
      const payload = req.body;
      if (
        !payload ||
        typeof payload !== "object" ||
        !Array.isArray(payload.answers)
      ) {
        return res
          .status(400)
          .json({ error: "Invalid body: expected JSON with answers[] array" });
      }

      // Basic checks on answers items
      for (const a of payload.answers) {
        if (typeof a.question_number === "undefined" || a.answer_text == null) {
          return res.status(400).json({
            error: "Each answer must contain question_number and answer_text",
          });
        }
      }

      // Optional: ensure optional exam_id/section_id/subject_id in body (if provided) match URL
      if (payload.exam_id && payload.exam_id !== examId) {
        return res
          .status(400)
          .json({ error: "Payload exam_id does not match URL examId" });
      }
      if (payload.section_id && payload.section_id !== sectionId) {
        return res
          .status(400)
          .json({ error: "Payload section_id does not match URL sectionId" });
      }
      if (payload.subject_id && payload.subject_id !== subjectId) {
        return res
          .status(400)
          .json({ error: "Payload subject_id does not match URL subjectId" });
      }

      // Insert into DB within a transaction
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const toInsert = {
          exam_id: examId,
          section_id: sectionId,
          subject_id: subjectId,
          student_id: studentId,
          submitted_by: submitter ? submitter.user_id : null,
          answers: payload.answers,
        };

        const created = await StudentAnswersModel.createStudentAnswer(
          toInsert,
          client
        );

        // After successful creation, update the student_answer_id in the students table
        await StudentsModel.updateStudentAnswerId(
          studentId,
          created.student_answer_id,
          client
        );

        await client.query("COMMIT");

        return res.status(201).json({
          message: "Student answers saved successfully",
          student_answer: created,
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

  // GET list for a student on an exam/section/subject
  async list(req, res, next) {
    try {
      const { examId, sectionId, subjectId, studentId } = req.params;
      if (![examId, sectionId, subjectId, studentId].every(isUUID)) {
        return res
          .status(400)
          .json({ error: "One or more IDs in URL are not valid UUIDs" });
      }

      const rows = await StudentAnswersModel.listByExamSectionSubjectStudent(
        examId,
        sectionId,
        subjectId,
        studentId
      );
      return res.json({ student_answers: rows });
    } catch (err) {
      next(err);
    }
  },

  // GET by id
  async getById(req, res, next) {
    try {
      const id = req.params.id;
      if (!isUUID(id))
        return res
          .status(400)
          .json({ error: "Invalid student_answer_id UUID" });
      const row = await StudentAnswersModel.findById(id);
      if (!row) return res.status(404).json({ error: "Not found" });
      return res.json({ student_answer: row });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = studentAnswersController;
