// Model/Resultmodel.js
const pool = require("../Config/Config");

const ResultModel = {
  /**
   * Create a new evaluation result
   * data: {
   *   exam_id,
   *   section_id,
   *   subject_id,
   *   student_id,
   *   evaluated_by,
   *   questions: [{ question_number, question_text, student_answer, ideal_answer, rubrics, max_marks, awarded_marks, feedback }],
   *   total_marks,
   *   max_total_marks
   * }
   */
  async createResult(data, client = null) {
    const sql = `
      INSERT INTO evaluation_results
        (result_id, exam_id, section_id, subject_id, student_id, evaluated_by, 
         questions, total_marks, max_total_marks)
      VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const params = [
      data.exam_id,
      data.section_id,
      data.subject_id,
      data.student_id,
      data.evaluated_by || null,
      data.questions ? JSON.stringify(data.questions) : null,
      data.total_marks,
      data.max_total_marks,
    ];

    if (client) {
      const { rows } = await client.query(sql, params);
      return rows[0];
    } else {
      const { rows } = await pool.query(sql, params);
      return rows[0];
    }
  },

  /**
   * Get result by ID
   */
  async findById(resultId) {
    const { rows } = await pool.query(
      `SELECT * FROM evaluation_results WHERE result_id = $1 LIMIT 1`,
      [resultId]
    );
    return rows[0] || null;
  },

  /**
   * Get a single student's result for a specific exam/section/subject
   */
  async findByStudentExamSectionSubject(
    examId,
    sectionId,
    subjectId,
    studentId
  ) {
    const sql = `
      SELECT 
        er.*,
        u.full_name as student_name,
        u.email as student_email,
        s.roll_number,
        sub.name as subject_name,
        ex.title as exam_title
      FROM evaluation_results er
      LEFT JOIN students s ON er.student_id = s.student_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN subjects sub ON er.subject_id = sub.subject_id
      LEFT JOIN exams ex ON er.exam_id = ex.exam_id
      WHERE er.exam_id = $1 
        AND er.section_id = $2 
        AND er.subject_id = $3 
        AND er.student_id = $4
      ORDER BY er.created_at DESC
      LIMIT 1;
    `;
    const { rows } = await pool.query(sql, [
      examId,
      sectionId,
      subjectId,
      studentId,
    ]);
    return rows[0] || null;
  },

  /**
   * Get all students' results for a specific exam/section/subject
   */
  async listByExamSectionSubject(examId, sectionId, subjectId) {
    const sql = `
      SELECT 
        er.*,
        u.full_name as student_name,
        u.email as student_email,
        s.roll_number,
        sub.name as subject_name,
        ex.title as exam_title
      FROM evaluation_results er
      LEFT JOIN students s ON er.student_id = s.student_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN subjects sub ON er.subject_id = sub.subject_id
      LEFT JOIN exams ex ON er.exam_id = ex.exam_id
      WHERE er.exam_id = $1 
        AND er.section_id = $2 
        AND er.subject_id = $3
      ORDER BY s.roll_number ASC;
    `;
    const { rows } = await pool.query(sql, [examId, sectionId, subjectId]);
    return rows;
  },

  /**
   * Get all results for a student across all exams/subjects
   */
  async listByStudent(studentId) {
    const sql = `
      SELECT 
        er.*,
        sub.name as subject_name,
        ex.title as exam_title,
        ex.start_time as exam_date
      FROM evaluation_results er
      LEFT JOIN subjects sub ON er.subject_id = sub.subject_id
      LEFT JOIN exams ex ON er.exam_id = ex.exam_id
      WHERE er.student_id = $1
      ORDER BY er.created_at DESC;
    `;
    const { rows } = await pool.query(sql, [studentId]);
    return rows;
  },

  /**
   * Update an existing result
   */
  async updateResult(resultId, data) {
    const sql = `
      UPDATE evaluation_results
      SET 
        questions = $1,
        total_marks = $2,
        max_total_marks = $3,
        updated_at = now()
      WHERE result_id = $4
      RETURNING *;
    `;
    const params = [
      data.questions ? JSON.stringify(data.questions) : null,
      data.total_marks,
      data.max_total_marks,
      resultId,
    ];
    const { rows } = await pool.query(sql, params);
    return rows[0] || null;
  },

  /**
   * Delete a result
   */
  async deleteResult(resultId) {
    const { rows } = await pool.query(
      `DELETE FROM evaluation_results WHERE result_id = $1 RETURNING *`,
      [resultId]
    );
    return rows[0] || null;
  },

  /**
   * Check if result already exists for a student
   */
  async existsByStudentExamSectionSubject(
    examId,
    sectionId,
    subjectId,
    studentId
  ) {
    const { rows } = await pool.query(
      `SELECT result_id FROM evaluation_results 
       WHERE exam_id = $1 AND section_id = $2 AND subject_id = $3 AND student_id = $4
       LIMIT 1`,
      [examId, sectionId, subjectId, studentId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Get summary statistics for exam/section/subject
   */
  async getStatistics(examId, sectionId, subjectId) {
    const sql = `
      SELECT 
        COUNT(*) as total_students,
        ROUND(AVG(total_marks)::numeric, 2) as average_score,
        MAX(total_marks) as highest_score,
        MIN(total_marks) as lowest_score,
        MAX(max_total_marks) as max_possible_score
      FROM evaluation_results
      WHERE exam_id = $1 AND section_id = $2 AND subject_id = $3;
    `;
    const { rows } = await pool.query(sql, [examId, sectionId, subjectId]);
    return rows[0] || null;
  },
};

module.exports = ResultModel;
