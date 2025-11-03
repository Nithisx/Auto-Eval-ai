// models/uploadsModel.js
const pool = require('../Config/Config');

const UploadsModel = {
  async createUpload({ uploader_id, exam_id = null, file_name, storage_path, file_type }, client = pool) {
    const sql = `
      INSERT INTO uploads (uploader_id, exam_id, filename, storage_path, file_type)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING upload_id, uploader_id, exam_id, filename, storage_path, file_type, uploaded_at;
    `;
    const values = [uploader_id, exam_id, file_name, storage_path, file_type];
    const { rows } = await client.query(sql, values);
    return rows[0];
  },

  async createUploadedPage({ upload_id, page_number, storage_path, ocr_text = null }, client = pool) {
    const sql = `
      INSERT INTO uploaded_pages (upload_id, page_number, storage_path, ocr_text)
      VALUES ($1, $2, $3, $4)
      RETURNING page_id, upload_id, page_number, storage_path, ocr_text, created_at;
    `;
    const values = [upload_id, page_number, storage_path, ocr_text];
    const { rows } = await client.query(sql, values);
    return rows[0];
  }
};

module.exports = UploadsModel;
