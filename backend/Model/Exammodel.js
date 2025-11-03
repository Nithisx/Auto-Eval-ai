// models/examsModel.js
const pool = require('../Config/Config');


const ExamsModel = {
  async createExam({ title, description = null, class_id, section_id, created_by = null, start_time = null, end_time = null }, client = pool) {
    const sql = `
      INSERT INTO exams (title, description, class_id, section_id, created_by, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING exam_id, title, description, class_id, section_id, created_by, start_time, end_time, created_at;
    `;
    const values = [title, description, class_id, section_id, created_by, start_time, end_time];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  // associate many subject IDs to an exam (unique constraint prevents duplicates)
  async addSubjectsToExam(exam_id, subjectIds = [], client = pool) {
    if (!subjectIds || subjectIds.length === 0) return [];

    const inserted = [];
    // using a prepared statement inside transaction
    const sql = `INSERT INTO exam_subjects (exam_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id, exam_id, subject_id;`;
    for (const sid of subjectIds) {
      const { rows } = await client.query(sql, [exam_id, sid]);
      if (rows.length > 0) inserted.push(rows[0]);
    }
    return inserted;
  },

  async getExamsBySection(section_id) {
    const sql = `
      SELECT exam_id, title, description, class_id, section_id, created_by, start_time, end_time, created_at
      FROM exams
      WHERE section_id = $1
      ORDER BY created_at DESC;
    `;
    const { rows } = await pool.query(sql, [section_id]);
    return rows;
  },

  async findById(exam_id) {
    const { rows } = await pool.query(`SELECT * FROM exams WHERE exam_id = $1`, [exam_id]);
    return rows[0];
  }
};

module.exports = ExamsModel;
