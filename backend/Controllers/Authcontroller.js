// controllers/authController.js
const bcrypt = require('bcrypt');
const { validationResult } = require('express-validator');
const UserModel = require('../Model/Usermodel');
const { signPayload } = require('../Utils/Jwt');

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

const authController = {
  async signup(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, full_name, role } = req.body;
      // check user exists
      const existing = await UserModel.findByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await UserModel.createUser({
        email,
        passwordHash,
        full_name,
        role
      });

      // create token
      const token = signPayload({ user_id: user.user_id, role: user.role, email: user.email });

      const response = res.status(201).json({
        message: 'User created',
        user: {
          user_id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        token
      });

      console.log(response);
      
    } catch (err) {
      next(err);
    }
  },

  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = signPayload({ user_id: user.user_id, role: user.role, email: user.email });

      res.json({
        message: 'Logged in',
        user: {
          user_id: user.user_id,
          email: user.email,
          full_name: user.full_name,
          role: user.role
        },
        token
      });
    } catch (err) {
      next(err);
    }
  },

  // fetch current user (protected)
  async me(req, res, next) {
    try {
      const user = await UserModel.findById(req.user.user_id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({ user });
    } catch (err) {
      next(err);
    }
  },

  async getUserById(req, res, next) {
    try {
      const { userId } = req.params;
      const user = await UserModel.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // Return limited user info for privacy
      res.json({
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        role: user.role
      });
    } catch (err) {
      next(err);
    }
  }
};

module.exports = authController;
