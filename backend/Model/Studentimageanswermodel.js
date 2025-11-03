// models/studentImageAnswerModel.js
const pool = require("../Config/Config");

const StudentImageAnswerModel = {
  // Create a new student image answer entry
  async createStudentImageAnswer(
    {
      section_id,
      exam_id,
      subject_id,
      student_id,
      question_id = null,
      image_paths,
      original_filenames,
      file_sizes,
      mime_types,
      status = "submitted",
    },
    client = pool
  ) {
    const sql = `
      INSERT INTO student_image_answers (
        section_id, exam_id, subject_id, student_id, question_id,
        image_paths, original_filenames, file_sizes, mime_types, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      section_id,
      exam_id,
      subject_id,
      student_id,
      question_id,
      image_paths,
      original_filenames,
      file_sizes,
      mime_types,
      status,
    ];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  // Get student image answers by various filters
  async getStudentImageAnswers(filters = {}, client = pool) {
    let sql = `
      SELECT sia.*, 
             u.full_name as student_name,
             u.email as student_email,
             e.title as exam_title,
             s.name as subject_name,
             sec.name as section_name,
             grader.full_name as grader_name
      FROM student_image_answers sia
      JOIN students st ON sia.student_id = st.student_id
      JOIN users u ON st.user_id = u.user_id
      JOIN exams e ON sia.exam_id = e.exam_id
      JOIN subjects s ON sia.subject_id = s.subject_id
      JOIN sections sec ON sia.section_id = sec.section_id
      LEFT JOIN users grader ON sia.graded_by = grader.user_id
    `;

    const conditions = [];
    const values = [];
    let paramCount = 0;

    if (filters.section_id) {
      paramCount++;
      conditions.push(`sia.section_id = $${paramCount}`);
      values.push(filters.section_id);
    }

    if (filters.exam_id) {
      paramCount++;
      conditions.push(`sia.exam_id = $${paramCount}`);
      values.push(filters.exam_id);
    }

    if (filters.subject_id) {
      paramCount++;
      conditions.push(`sia.subject_id = $${paramCount}`);
      values.push(filters.subject_id);
    }

    if (filters.student_id) {
      paramCount++;
      conditions.push(`sia.student_id = $${paramCount}`);
      values.push(filters.student_id);
    }

    if (filters.question_id) {
      paramCount++;
      conditions.push(`sia.question_id = $${paramCount}`);
      values.push(filters.question_id);
    }

    if (filters.status) {
      paramCount++;
      conditions.push(`sia.status = $${paramCount}`);
      values.push(filters.status);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY sia.created_at DESC";

    const { rows } = await client.query(sql, values);
    return rows;
  },

  // Get a specific student image answer by ID
  async getStudentImageAnswerById(image_answer_id, client = pool) {
    const sql = `
      SELECT sia.*, 
             u.full_name as student_name,
             u.email as student_email,
             e.title as exam_title,
             s.name as subject_name,
             sec.name as section_name,
             grader.full_name as grader_name
      FROM student_image_answers sia
      JOIN students st ON sia.student_id = st.student_id
      JOIN users u ON st.user_id = u.user_id
      JOIN exams e ON sia.exam_id = e.exam_id
      JOIN subjects s ON sia.subject_id = s.subject_id
      JOIN sections sec ON sia.section_id = sec.section_id
      LEFT JOIN users grader ON sia.graded_by = grader.user_id
      WHERE sia.image_answer_id = $1;
    `;
    const { rows } = await client.query(sql, [image_answer_id]);
    return rows[0];
  },

  // Update student image answer (mainly for grading)
  async updateStudentImageAnswer(
    image_answer_id,
    { status, marks_obtained, teacher_feedback, graded_by },
    client = pool
  ) {
    const sql = `
      UPDATE student_image_answers 
      SET status = $2,
          marks_obtained = $3,
          teacher_feedback = $4,
          graded_by = $5,
          graded_at = CASE WHEN $2 = 'graded' THEN now() ELSE graded_at END,
          updated_at = now()
      WHERE image_answer_id = $1
      RETURNING *;
    `;
    const values = [
      image_answer_id,
      status,
      marks_obtained,
      teacher_feedback,
      graded_by,
    ];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  // Delete student image answer
  async deleteStudentImageAnswer(image_answer_id, client = pool) {
    const sql = `DELETE FROM student_image_answers WHERE image_answer_id = $1 RETURNING *;`;
    const { rows } = await client.query(sql, [image_answer_id]);
    return rows[0];
  },

  // Get statistics for a specific exam
  async getExamStatistics(exam_id, client = pool) {
    const sql = `
      SELECT 
        COUNT(*) as total_submissions,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted_count,
        COUNT(CASE WHEN status = 'graded' THEN 1 END) as graded_count,
        COUNT(CASE WHEN status = 'reviewed' THEN 1 END) as reviewed_count,
        AVG(marks_obtained) as average_marks,
        MAX(marks_obtained) as highest_marks,
        MIN(marks_obtained) as lowest_marks
      FROM student_image_answers 
      WHERE exam_id = $1;
    `;
    const { rows } = await client.query(sql, [exam_id]);
    return rows[0];
  },

  // Check if student has already submitted for specific exam/subject
  async checkExistingSubmission(
    section_id,
    exam_id,
    subject_id,
    student_id,
    client = pool
  ) {
    const sql = `
      SELECT image_answer_id, status, created_at
      FROM student_image_answers 
      WHERE section_id = $1 AND exam_id = $2 AND subject_id = $3 AND student_id = $4;
    `;
    const { rows } = await client.query(sql, [
      section_id,
      exam_id,
      subject_id,
      student_id,
    ]);
    return rows[0];
  },
};

module.exports = StudentImageAnswerModel;
