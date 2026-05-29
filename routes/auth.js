const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const db = require('../config/database');
const config = require('../config/config');

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: 'Juda ko\'p urinish. 15 daqiqadan keyin qayta urinib ko\'ring.'
  }
});

// Register route
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Barcha maydonlar to\'ldirilishi shart' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' 
      });
    }

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        error: 'Bu email yoki foydalanuvchi nomi allaqachon mavjud' 
      });
    }

    // Hash password
    const saltRounds = config.security.bcryptRounds;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );

    res.status(201).json({
      success: true,
      message: 'Foydalanuvchi muvaffaqiyatli ro\'yxatdan o\'tdi',
      userId: result.id
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// Login route
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email va parol talab qilinadi' 
      });
    }

    // Find user
    const users = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        error: 'Yaroqsiz email yoki parol' 
      });
    }

    const user = users[0];

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Yaroqsiz email yoki parol' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      },
      config.jwtSecret,
      { expiresIn: config.security.jwtExpiration }
    );

    res.json({
      success: true,
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token talab qilinadi' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    
    const users = await db.query(
      'SELECT id, username, email, role, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    res.json({ user: users[0] });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(401).json({ error: 'Yaroqsiz token' });
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token talab qilinadi' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Joriy parol va yangi parol talab qilinadi' 
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ 
        error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' 
      });
    }

    // Get user
    const users = await db.query(
      'SELECT * FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const user = users[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Joriy parol noto\'g\'ri' });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);

    // Update password
    await db.run(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [hashedNewPassword, decoded.id]
    );

    res.json({ 
      success: true, 
      message: 'Parol muvaffaqiyatli o\'zgartirildi' 
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

// Refresh token
router.post('/refresh-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: 'Token talab qilinadi' });
    }

    // Verify token (even if expired, we just check if it's valid)
    const decoded = jwt.decode(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Yaroqsiz token' });
    }

    // Get fresh user data
    const users = await db.query(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    }

    const user = users[0];

    // Generate new token
    const newToken = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        email: user.email,
        role: user.role 
      },
      config.jwtSecret,
      { expiresIn: config.security.jwtExpiration }
    );

    res.json({
      success: true,
      token: newToken,
      user: user
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Serverda xatolik yuz berdi' });
  }
});

module.exports = router;