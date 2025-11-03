const pool = require("../Config/Config");
const { validate: isUuid } = require("uuid");

const TeacherAnswersModel = {
  /**
   * Insert a teacher answers row.
   * If client is provided, uses the given client (transaction support).
   * data: { exam_id, section_id, subject_id, uploader_id, total_marks, answers }
   */
  async createTeacherAnswer(data, client = null) {
    console.log("[createTeacherAnswer] Input data:", data);

    // Validate UUIDs if you want
    if (
      !isUuid(data.exam_id) ||
      !isUuid(data.section_id) ||
      !isUuid(data.subject_id)
    ) {
      console.error("[createTeacherAnswer] Invalid UUID in input:", {
        exam_id: data.exam_id,
        section_id: data.section_id,
        subject_id: data.subject_id,
      });
      throw new Error("Invalid UUID provided to createTeacherAnswer");
    }

    const sql = `
      INSERT INTO teacher_answers
        (exam_id, section_id, subject_id, uploader_id, total_marks, answers)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const params = [
      data.exam_id,
      data.section_id,
      data.subject_id,
      data.uploader_id || null,
      data.total_marks || null,
      data.answers,
    ];

    console.log("[createTeacherAnswer] Executing SQL with params:", params);

    if (client) {
      const { rows } = await client.query(sql, params);
      return rows[0];
    } else {
      const { rows } = await pool.query(sql, params);
      return rows[0];
    }
  },

  async findById(id) {
    console.log("[findById] Searching for teacher_answer_id:", id);

    if (!isUuid(id)) {
      console.error("[findById] Invalid UUID:", id);
      throw new Error("Invalid UUID provided to findById");
    }

    const { rows } = await pool.query(
      `SELECT * FROM teacher_answers WHERE teacher_answer_id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async listByExamSectionSubject(examId, sectionId, subjectId) {
    console.log("[listByExamSectionSubject] Inputs:", {
      examId,
      sectionId,
      subjectId,
    });

    // Validate UUIDs before query
    if (![examId, sectionId, subjectId].every(isUuid)) {
      console.error("[listByExamSectionSubject] Invalid UUID(s):", {
        examId,
        sectionId,
        subjectId,
      });
      throw new Error("Invalid UUID provided to listByExamSectionSubject");
    }

    const sql = `
      SELECT * FROM teacher_answers
      WHERE exam_id = $1 AND section_id = $2 AND subject_id = $3
      ORDER BY created_at DESC
    `;
    const params = [examId, sectionId, subjectId];

    console.log("[listByExamSectionSubject] Executing SQL with params:", params);

    const { rows } = await pool.query(sql, params);
    return rows;
  },
};

module.exports = TeacherAnswersModel;
