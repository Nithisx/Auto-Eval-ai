// models/studentsModel.js
const pool = require("../Config/Config");

const StudentsModel = {
  // create a student row (expects user_id already created)
  async createStudent(
    {
      user_id,
      roll_number = null,
      class_id,
      section_id,
      enrollment_date = null,
    },
    client = pool
  ) {
    const sql = `
      INSERT INTO students (user_id, roll_number, class_id, section_id, enrollment_date)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING student_id, user_id, roll_number, class_id, section_id, enrollment_date;
    `;
    const values = [
      user_id,
      roll_number,
      class_id,
      section_id,
      enrollment_date,
    ];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  // get students in a section (joins to users for email/name)
  async getStudentsBySection(section_id) {
    const sql = `
      SELECT s.student_id, s.user_id, s.roll_number, s.class_id, s.section_id, s.enrollment_date,
             u.email, u.full_name
      FROM students s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.section_id = $1
      ORDER BY u.full_name;
    `;
    const { rows } = await pool.query(sql, [section_id]);
    return rows;
  },

  // update student answer id
  async updateStudentAnswerId(student_id, student_answer_id, client = pool) {
    const sql = `
      UPDATE students
      SET student_answer_id = $1
      WHERE student_id = $2
      RETURNING student_id, student_answer_id;
    `;
    const values = [student_answer_id, student_id];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },
};

module.exports = StudentsModel;
