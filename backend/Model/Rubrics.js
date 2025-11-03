// Model/Rubrics.js
const pool = require('../Config/Config');

const Rubrics = {
  async createRubric({ question_id, title = null, description = null, weight = 1.0, min_score = 0, max_score = null, created_by = null }, client = pool) {
    const sql = `
      INSERT INTO rubrics (question_id, title, description, weight, min_score, max_score, created_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      RETURNING rubric_id, question_id, title, description, weight, min_score, max_score, created_by, created_at;
    `;
    const values = [question_id, title, description, weight, min_score, max_score, created_by];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  async getRubricsByQuestion(question_id) {
    const { rows } = await pool.query(`SELECT * FROM rubrics WHERE question_id = $1 ORDER BY created_at`, [question_id]);
    return rows;
  }
};

module.exports = Rubrics;
