// Model/Questions.js
const pool = require('../Config/Config');

const Questions = {
  async createQuestion({ exam_id, question_number, prompt, max_marks, ideal_answer = null }, client = pool) {
    const sql = `
      INSERT INTO questions (exam_id, question_number, prompt, max_marks, created_at, ideal_answer)
      VALUES ($1, $2, $3, $4, now(), $5)
      RETURNING question_id, exam_id, question_number, prompt, max_marks, ideal_answer, created_at;
    `;
    const values = [exam_id, question_number, prompt, max_marks, ideal_answer];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  async findByExamAndNumber(exam_id, question_number) {
    const { rows } = await pool.query(`SELECT * FROM questions WHERE exam_id = $1 AND question_number = $2`, [exam_id, question_number]);
    return rows[0];
  }
};

module.exports = Questions;
