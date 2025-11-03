// controllers/answersController.js
const fs = require('fs');
const path = require('path');
const pool = require('../Config/Config');
const UploadsModel = require('../Model/Uploads');
const ClassesModel = require('../Model/Class'); // for checks
const { BASE_UPLOAD_DIR } = require('../Middleware/Uploadmiddleware');

const answersController = {
  // POST /api/sections/:sectionId/students/:studentId/exams/:examId/subjects/:subjectId/answers
  async uploadAnswerSheet(req, res, next) {
    // files are in req.files (array)
    try {
      // Basic validations done by route (we assume authMiddleware ran)
      const { sectionId, studentId, examId, subjectId } = req.params;
      const uploader = req.user; // { user_id, role, ... }

      // validate section exists and get class_id
      const section = await ClassesModel.getSectionById(sectionId);
      if (!section) return res.status(404).json({ error: 'Section not found' });

      // role checks: principal always ok; teacher must be assigned to this class+section
      if (uploader.role === 'teacher') {
        const assigned = await ClassesModel.isTeacherAssigned(uploader.user_id, section.class_id, sectionId);
        if (!assigned) return res.status(403).json({ error: 'Forbidden: you are not assigned to this section' });
      } else if (uploader.role !== 'principal' && uploader.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden: only principal/assigned teacher can upload answer sheets' });
      }

      // ensure files present
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded. Use field name "files"' });
      }

      const client = await pool.connect();
      const createdUploads = [];
      try {
        await client.query('BEGIN');

        // Create a unique upload group id (we will create a DB upload entry per received file)
        // For nicer organization, create a folder named by timestamp+uploader
        const uploadGroupDirName = `${Date.now()}-${uploader.user_id}`;
        const uploadGroupDir = path.join(BASE_UPLOAD_DIR, uploadGroupDirName);
        fs.mkdirSync(uploadGroupDir, { recursive: true });

        // Move files from BASE_UPLOAD_DIR to this grouped folder
        // Note: multer already saved files to BASE_UPLOAD_DIR with names, so move them
        let pageNumber = 1;
        for (const f of req.files) {
          const originalPath = f.path;
          const destPath = path.join(uploadGroupDir, f.filename);
          fs.renameSync(originalPath, destPath);

          // Determine file_type
          const ext = path.extname(f.filename).toLowerCase();
          const mime = f.mimetype;
          let file_type = 'answer_image';
          if (mime === 'application/pdf' || ext === '.pdf') file_type = 'answer_pdf';

          // create upload record (exam_id is optional but useful)
          const uploadRow = await UploadsModel.createUpload({
            uploader_id: uploader.user_id,
            exam_id: examId,
            file_name: f.originalname,
            storage_path: destPath, // store absolute or relative path depending on your convention
            file_type
          }, client);

          // create uploaded_pages entry. We treat each uploaded file as a page (page_number increments)
          const pageRow = await UploadsModel.createUploadedPage({
            upload_id: uploadRow.upload_id,
            page_number: pageNumber,
            storage_path: destPath,
            ocr_text: null
          }, client);

          createdUploads.push({ upload: uploadRow, page: pageRow });
          pageNumber += 1;
        }

        await client.query('COMMIT');

        return res.status(201).json({
          message: 'Files uploaded',
          uploads: createdUploads
        });
      } catch (err) {
        await client.query('ROLLBACK');
        // attempt cleanup of moved files (best effort)
        try {
          if (fs.existsSync(uploadGroupDir)) fs.rmSync(uploadGroupDir, { recursive: true, force: true });
        } catch (e) { /* ignore */ }
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      next(err);
    }
  }
};

module.exports = answersController;
