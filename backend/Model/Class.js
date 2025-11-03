// models/classesModel.js
const pool = require('../Config/Config');

const ClassesModel = {
  async createClass({ name, grade = null }, client = pool) {
    const sql = `
      INSERT INTO classes (name, grade)
      VALUES ($1, $2)
      RETURNING class_id, name, grade, created_at;
    `;
    const values = [name, grade];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  async createSection({ class_id, name }, client = pool) {
    const sql = `
      INSERT INTO sections (class_id, name)
      VALUES ($1, $2)
      RETURNING section_id, class_id, name, created_at;
    `;
    const { rows } = await client.query(sql, [class_id, name]);
    return rows[0];
  },

  async getAllClassesWithSections() {
    const classesSql = `SELECT class_id, name, grade, created_at FROM classes ORDER BY name`;
    const classesRes = await pool.query(classesSql);

    const classIds = classesRes.rows.map((c) => c.class_id);
    if (classIds.length === 0) return [];

    const sectionsSql = `SELECT section_id, class_id, name, created_at FROM sections WHERE class_id = ANY($1::uuid[]) ORDER BY name`;
    const sectionsRes = await pool.query(sectionsSql, [classIds]);

    const sectionsByClass = {};
    for (const s of sectionsRes.rows) {
      sectionsByClass[s.class_id] = sectionsByClass[s.class_id] || [];
      sectionsByClass[s.class_id].push(s);
    }

    return classesRes.rows.map((c) => ({
      ...c,
      sections: sectionsByClass[c.class_id] || []
    }));
  },

  async getSectionsByClass(class_id) {
    const { rows } = await pool.query(
      `SELECT section_id, class_id, name, created_at FROM sections WHERE class_id = $1 ORDER BY name`,
      [class_id]
    );
    return rows;
  },

  async classExists(class_id) {
    const { rows } = await pool.query(`SELECT 1 FROM classes WHERE class_id = $1`, [class_id]);
    return rows.length > 0;
  },

  async findClassByName(name) {
    const { rows } = await pool.query(`SELECT * FROM classes WHERE name = $1`, [name]);
    return rows[0];
  },

  async sectionExistsInClass(class_id, sectionName) {
    const { rows } = await pool.query(`SELECT 1 FROM sections WHERE class_id = $1 AND LOWER(name)=LOWER($2)`, [class_id, sectionName]);
    return rows.length > 0;
  },

  // --- NEW: check section existence by id
  async sectionExistsById(section_id) {
    const { rows } = await pool.query(`SELECT 1 FROM sections WHERE section_id = $1`, [section_id]);
    return rows.length > 0;
  },

  // --- NEW: get section by id (returns section record including class_id)
  async getSectionById(section_id) {
    const { rows } = await pool.query(`SELECT section_id, class_id, name, created_at FROM sections WHERE section_id = $1`, [section_id]);
    return rows[0];
  }
  ,
  // Check if a teacher is assigned to a given class+section
  async isTeacherAssigned(teacher_id, class_id, section_id) {
    const { rows } = await pool.query(
      `SELECT 1 FROM teacher_assignments WHERE teacher_id = $1 AND class_id = $2 AND section_id = $3 LIMIT 1`,
      [teacher_id, class_id, section_id]
    );
    return rows.length > 0;
  },

  async assignTeacher({ teacher_id, class_id, section_id }) {
    const { rows } = await pool.query(
      `INSERT INTO teacher_assignments (teacher_id, class_id, section_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (teacher_id, class_id, section_id) DO NOTHING
       RETURNING id, teacher_id, class_id, section_id, created_at;`,
      [teacher_id, class_id, section_id]
    );
    return rows[0] || null;
  },

  async listAssignedTeachers(class_id, section_id) {
    const { rows } = await pool.query(
      `SELECT ta.teacher_id, u.full_name, u.email
       FROM teacher_assignments ta
       JOIN users u ON u.user_id = ta.teacher_id
       WHERE ta.class_id = $1 AND ta.section_id = $2
       ORDER BY u.full_name`,
      [class_id, section_id]
    );
    return rows;
  },

  async removeTeacherAssignment(teacher_id, class_id, section_id) {
    await pool.query(
      `DELETE FROM teacher_assignments WHERE teacher_id = $1 AND class_id = $2 AND section_id = $3`,
      [teacher_id, class_id, section_id]
    );
    return true;
  },

  async deleteClass(class_id) {
    // Will cascade to sections, exams, students, assignments due to FK ON DELETE CASCADE
    const { rowCount } = await pool.query(`DELETE FROM classes WHERE class_id = $1`, [class_id]);
    return rowCount > 0;
  },

  async deleteSection(section_id) {
    // Will cascade to exams, students, assignments due to FK ON DELETE CASCADE
    const { rowCount } = await pool.query(`DELETE FROM sections WHERE section_id = $1`, [section_id]);
    return rowCount > 0;
  }
};

module.exports = ClassesModel;
