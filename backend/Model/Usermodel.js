// models/userModel.js
const pool = require('../Config/Config');

const UserModel = {
  async createUser({ email, passwordHash, full_name, role }) {
    const sql = `
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING user_id, email, full_name, role, created_at;
    `;
    const values = [email, passwordHash, full_name, role];
    const { rows } = await pool.query(sql, values);
    return rows[0];
  },

  async findByEmail(email) {
    const { rows } = await pool.query(
      `SELECT user_id, email, password_hash, full_name, role FROM users WHERE email=$1`,
      [email]
    );
    return rows[0];
  },

  async findById(user_id) {
    const { rows } = await pool.query(
      `SELECT user_id, email, full_name, role, created_at FROM users WHERE user_id=$1`,
      [user_id]
    );
    return rows[0];
  },

  async listByRole(role) {
    const { rows } = await pool.query(
      `SELECT user_id, email, full_name, role, created_at FROM users WHERE role = $1 ORDER BY full_name`,
      [role]
    );
    return rows;
  }
};

module.exports = UserModel;
