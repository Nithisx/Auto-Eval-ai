// controllers/classesController.js
const { validationResult } = require('express-validator');
const pool = require('../Config/Config');
const ClassesModel = require('../Model/Class');

const classesController = {
  async createClass(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, grade = null, sections = [] } = req.body;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const existing = await ClassesModel.findClassByName(name);
        if (existing) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Class with this name already exists' });
        }

        const createdClass = await ClassesModel.createClass({ name, grade }, client);

        const createdSections = [];
        for (const secName of sections) {
          if (!secName || !String(secName).trim()) continue;
          const exists = await ClassesModel.sectionExistsInClass(createdClass.class_id, secName);
          if (exists) continue;
          const sec = await ClassesModel.createSection({ class_id: createdClass.class_id, name: secName }, client);
          createdSections.push(sec);
        }

        await client.query('COMMIT');

        res.status(201).json({
          class: createdClass,
          sections: createdSections
        });
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

  async createSection(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { classId } = req.params;
      const { name } = req.body;

      const exists = await ClassesModel.classExists(classId);
      if (!exists) return res.status(404).json({ error: 'Class not found' });

      const sectionExists = await ClassesModel.sectionExistsInClass(classId, name);
      if (sectionExists) return res.status(409).json({ error: 'Section already exists in this class' });

      const section = await ClassesModel.createSection({ class_id: classId, name });
      res.status(201).json({ section });
    } catch (err) {
      next(err);
    }
  },

  async getClasses(req, res, next) {
    try {
      const classes = await ClassesModel.getAllClassesWithSections();
      res.json({ classes });
    } catch (err) {
      next(err);
    }
  },

  async getSections(req, res, next) {
    try {
      const { classId } = req.params;
      const exists = await ClassesModel.classExists(classId);
      if (!exists) return res.status(404).json({ error: 'Class not found' });
      const sections = await ClassesModel.getSectionsByClass(classId);
      res.json({ sections });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = classesController;
