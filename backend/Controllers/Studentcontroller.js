// controllers/studentsController.js
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const pool = require('../Config/Config');
const ClassesModel = require('../Model/Class');
const StudentsModel = require('../Model/Studentmodel');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const studentsController = {
  // Create one or multiple students inside a section
  // Accepts either { email, password, full_name, roll_number, class_id(optional) } or { students: [ ... ] }
  async createStudents(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { sectionId } = req.params;
      const payload = req.body;

      // check section exists
      const sectionExists = await ClassesModel.sectionExistsById(sectionId);
      if (!sectionExists) return res.status(404).json({ error: 'Section not found' });

      // get section to know class_id
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      // normalize input: array of students
      const studentsInput = Array.isArray(payload.students) ? payload.students : [payload];

      const client = await pool.connect();
      const created = [];
      try {
        await client.query('BEGIN');

        for (const s of studentsInput) {
          const email = (s.email || '').toLowerCase().trim();
          const password = s.password;
          const full_name = s.full_name;
          const roll_number = s.roll_number || null;
          if (!email || !password || !full_name) {
            // rollback and return error — better to validate earlier, but we enforce here
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Each student must have email, password and full_name' });
          }

          // check if email already exists
          const maybe = await client.query(`SELECT user_id FROM users WHERE email = $1`, [email]);
          if (maybe.rows.length > 0) {
            // Skip or return error — we'll return conflict error
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `User with email ${email} already exists` });
          }

          // hash password
          const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

          // create user record
          const insertUserSql = `
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES ($1, $2, $3, 'student')
            RETURNING user_id, email, full_name;
          `;
          const userRes = await client.query(insertUserSql, [email, passwordHash, full_name]);
          const user = userRes.rows[0];

          // create student record linking to class and section
          const studentRow = await StudentsModel.createStudent({
            user_id: user.user_id,
            roll_number,
            class_id: section.class_id,
            section_id: sectionId,
            enrollment_date: s.enrollment_date || new Date()
          }, client);

          created.push({
            student_id: studentRow.student_id,
            user_id: user.user_id,
            email: user.email,
            full_name: user.full_name,
            roll_number: studentRow.roll_number
          });
        }

        await client.query('COMMIT');
        res.status(201).json({ created });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  },

  // fetch students in a section
  async getStudentsInSection(req, res, next) {
    try {
      const { sectionId } = req.params;
      const sectionExists = await ClassesModel.sectionExistsById(sectionId);
      if (!sectionExists) return res.status(404).json({ error: 'Section not found' });

      const students = await StudentsModel.getStudentsBySection(sectionId);
      res.json({ students });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = studentsController;
