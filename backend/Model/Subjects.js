// Model/Subjects.js
const pool = require("../Config/Config");

const Subjects = {
  async createSubjectIfNotExists(name, client = pool) {
    const sql = `
      INSERT INTO subjects (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET name = subjects.name
      RETURNING subject_id, name, created_at;
    `;
    const { rows } = await client.query(sql, [name]);
    return rows[0];
  },

  async findByName(name) {
    const { rows } = await pool.query(
      `SELECT subject_id, name FROM subjects WHERE name = $1`,
      [name]
    );
    return rows[0];
  },

  async findById(subject_id) {
    const { rows } = await pool.query(
      `SELECT subject_id, name FROM subjects WHERE subject_id = $1`,
      [subject_id]
    );
    return rows[0];
  },

  async updateTeacherAnswerId(subject_id, teacher_answer_id, client = pool) {
    const sql = `
      UPDATE subjects
      SET teacher_answer_id = $1
      WHERE subject_id = $2
      RETURNING subject_id, name, teacher_answer_id;
    `;
    const { rows } = await client.query(sql, [teacher_answer_id, subject_id]);
    return rows[0];
  },
};

module.exports = Subjects;
