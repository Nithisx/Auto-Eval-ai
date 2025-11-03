// models/subjectsModel.js
const pool = require('../Config/Config');

const SubjectsModel = {
  // create subject if not exists, returns subject row
  async createSubjectIfNotExists(name, client = pool) {
    // try insert, on conflict return existing
    const sql = `
      INSERT INTO subjects (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = subjects.name
      RETURNING subject_id, name, created_at;
    `;
    const { rows } = await client.query(sql, [name]);
    return rows[0];
  },

  async findById(subject_id) {
    const { rows } = await pool.query(`SELECT subject_id, name, created_at FROM subjects WHERE subject_id = $1`, [subject_id]);
    return rows[0];
  },

  async findByName(name) {
    const { rows } = await pool.query(`SELECT subject_id, name, created_at FROM subjects WHERE name = $1`, [name]);
    return rows[0];
  },

  async getSubjectsByExam(examId) {
    const sql = `
      SELECT s.subject_id, s.name, s.created_at
      FROM exam_subjects es
      JOIN subjects s ON s.subject_id = es.subject_id
      WHERE es.exam_id = $1
      ORDER BY s.name;
    `;
    const { rows } = await pool.query(sql, [examId]);
    return rows;
  }
};

module.exports = SubjectsModel;
