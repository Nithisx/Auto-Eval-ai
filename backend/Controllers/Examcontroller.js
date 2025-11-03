// controllers/examsController.js
const { validationResult } = require('express-validator');
const pool = require('../Config/Config');
const ExamsModel = require('../Model/Exammodel');
const SubjectsModel = require('../Model/Subjectsmodel');
const ClassesModel = require('../Model/Class');

const examsController = {
  // Create an exam for a section. Accepts subjects by name or subject_ids.
  // POST /api/sections/:sectionId/exams
  async createExam(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { sectionId } = req.params;
      const { title, description = null, start_time = null, end_time = null, subjects = [], subject_ids = [] } = req.body;

      // section must exist
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // create exam
        const exam = await ExamsModel.createExam({
          title,
          description,
          class_id: section.class_id,
          section_id: sectionId,
          created_by: req.user.user_id,
          start_time,
          end_time
        }, client);

        // build subject ids array:
        const createdSubjectIds = [];

        // 1) subject names provided -> upsert each subject and get ids
        for (const name of subjects || []) {
          if (!name || !String(name).trim()) continue;
          const subj = await SubjectsModel.createSubjectIfNotExists(String(name).trim(), client);
          createdSubjectIds.push(subj.subject_id);
        }

        // 2) subject_ids provided directly -> validate they exist
        for (const sid of subject_ids || []) {
          const found = await SubjectsModel.findById(sid);
          if (found) createdSubjectIds.push(found.subject_id);
        }

        // de-duplicate
        const uniqueIds = [...new Set(createdSubjectIds)];

        // associate to exam
        await ExamsModel.addSubjectsToExam(exam.exam_id, uniqueIds, client);

        await client.query('COMMIT');

        // fetch subjects attached
        const attachedSubjects = await SubjectsModel.getSubjectsByExam(exam.exam_id);

        res.status(201).json({ exam, subjects: attachedSubjects });
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

  // Add subjects to an existing exam
  // POST /api/exams/:examId/subjects
  async addSubjects(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { examId } = req.params;
      const { subjects = [], subject_ids = [] } = req.body;

      const exam = await ExamsModel.findById(examId);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const createdSubjectIds = [];
        for (const name of subjects || []) {
          if (!name || !String(name).trim()) continue;
          const subj = await SubjectsModel.createSubjectIfNotExists(String(name).trim(), client);
          createdSubjectIds.push(subj.subject_id);
        }
        for (const sid of subject_ids || []) {
          const found = await SubjectsModel.findById(sid);
          if (found) createdSubjectIds.push(found.subject_id);
        }

        const uniqueIds = [...new Set(createdSubjectIds)];
        await ExamsModel.addSubjectsToExam(examId, uniqueIds, client);

        await client.query('COMMIT');

        const attached = await SubjectsModel.getSubjectsByExam(examId);
        res.status(200).json({ subjects: attached });
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

  // GET /api/sections/:sectionId/exams
  async getExamsBySection(req, res, next) {
    try {
      const { sectionId } = req.params;
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      const exams = await ExamsModel.getExamsBySection(sectionId);

      // attach subjects for each exam (optional: batch for efficiency)
      const result = [];
      for (const ex of exams) {
        const subjects = await SubjectsModel.getSubjectsByExam(ex.exam_id);
        result.push({ exam: ex, subjects });
      }

      res.json({ exams: result });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/exams/:examId/subjects
  async getSubjectsByExam(req, res, next) {
    try {
      const { examId } = req.params;
      const exam = await ExamsModel.findById(examId);
      if (!exam) return res.status(404).json({ error: 'Exam not found' });
      const subjects = await SubjectsModel.getSubjectsByExam(examId);
      res.json({ exam, subjects });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = examsController;
