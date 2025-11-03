// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../Controllers/Authcontroller');
const authMiddleware = require('../Middleware/Authmiddleware');

// signup
router.post(
  '/signup',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
    body('full_name').notEmpty().withMessage('Full name required'),
    body('role').isIn(['principal', 'teacher', 'student', 'admin']).withMessage('Invalid role')
  ],
  authController.signup
);

// login
router.post(
  '/login',
  [
    body('email').isEmail(),
    body('password').notEmpty()
  ],
  authController.login
);

// get current user
router.get('/me', authMiddleware, authController.me);

// get user by ID
router.get('/user/:userId', authMiddleware, authController.getUserById);

module.exports = router;
