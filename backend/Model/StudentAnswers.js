// Model/StudentAnswers.js
const pool = require("../Config/Config");

const StudentAnswersModel = {
  /**
   * Insert a student answers row.
   * data: { exam_id, section_id, subject_id, student_id, submitted_by, answers }
   */
  async createStudentAnswer(data, client = null) {
    const sql = `
      INSERT INTO student_answers
        (student_answer_id, exam_id, section_id, subject_id, student_id, submitted_by, answers)
      VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const params = [
      data.student_answer_id || null,
      data.exam_id,
      data.section_id,
      data.subject_id,
      data.student_id,
      data.submitted_by || null,
      data.answers ? JSON.stringify(data.answers) : null,
    ];

    if (client) {
      const { rows } = await client.query(sql, params);
      return rows[0];
    } else {
      const { rows } = await pool.query(sql, params);
      return rows[0];
    }
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM student_answers WHERE student_answer_id = $1 LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  },

  async listByExamSectionSubjectStudent(
    examId,
    sectionId,
    subjectId,
    studentId
  ) {
    const { rows } = await pool.query(
      `SELECT * FROM student_answers
       WHERE exam_id = $1 AND section_id = $2 AND subject_id = $3 AND student_id = $4
       ORDER BY created_at DESC`,
      [examId, sectionId, subjectId, studentId]
    );
    return rows;
  },
};

module.exports = StudentAnswersModel;
