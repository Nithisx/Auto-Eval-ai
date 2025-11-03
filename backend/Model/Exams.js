// Model/Exams.js
const pool = require("../Config/Config");

const Exams = {
  async createExam(
    {
      title,
      description = null,
      class_id,
      section_id,
      created_by = null,
      start_time = null,
      end_time = null,
    },
    client = pool
  ) {
    const sql = `
      INSERT INTO exams (title, description, class_id, section_id, created_by, start_time, end_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING exam_id, title, description, class_id, section_id, created_by, start_time, end_time, created_at;
    `;
    const values = [
      title,
      description,
      class_id,
      section_id,
      created_by,
      start_time,
      end_time,
    ];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  async findByTitleAndSection(title, section_id) {
    const { rows } = await pool.query(
      `SELECT * FROM exams WHERE title = $1 AND section_id = $2`,
      [title, section_id]
    );
    return rows[0];
  },

  async getExamById(exam_id) {
    const sql = `SELECT * FROM exams WHERE exam_id = $1`;
    const { rows } = await pool.query(sql, [exam_id]);
    return rows[0];
  },
};

module.exports = Exams;
