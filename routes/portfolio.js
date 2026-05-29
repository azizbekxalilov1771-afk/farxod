const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../config/database');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/portfolio/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (JPEG, JPG, PNG, WebP)'), false);
    }
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token talab qilinadi' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config/config');
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Yaroqsiz token' });
  }
};

// Get all portfolio items (public)
router.get('/', async (req, res) => {
  try {
    const { category, limit = 20 } = req.query;
    
    let query = 'SELECT * FROM portfolio_items WHERE 1=1';
    const params = [];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const items = await db.query(query, params);
    
    // Parse JSON fields
    const portfolioItems = items.map(item => ({
      ...item,
      technologies: JSON.parse(item.technologies || '[]')
    }));
    
    res.json(portfolioItems);
  } catch (error) {
    console.error('Get portfolio items error:', error);
    res.status(500).json({ error: 'Portfolio ma\'lumotlarini olishda xatolik' });
  }
});

// Get portfolio categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM portfolio_items 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Kategoriyalarni olishda xatolik' });
  }
});

// Get single portfolio item
router.get('/:id', async (req, res) => {
  try {
    const items = await db.query(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [req.params.id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Portfolio loyihasi topilmadi' });
    }
    
    const item = items[0];
    item.technologies = JSON.parse(item.technologies || '[]');
    
    res.json(item);
  } catch (error) {
    console.error('Get portfolio item error:', error);
    res.status(500).json({ error: 'Portfolio ma\'lumotlarini olishda xatolik' });
  }
});

// Create new portfolio item (admin only)
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin (you can modify this logic)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { title, description, project_url, technologies, category } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ 
        error: 'Sarlavha va tavsif majburiy' 
      });
    }
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/portfolio/${req.file.filename}`;
    }
    
    // Parse technologies array
    let techArray = [];
    if (technologies) {
      try {
        techArray = Array.isArray(technologies) ? technologies : JSON.parse(technologies);
      } catch (e) {
        techArray = technologies.split(',').map(tech => tech.trim());
      }
    }
    
    const result = await db.run(`
      INSERT INTO portfolio_items (
        title, description, image_url, project_url, technologies, category
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      title, 
      description, 
      imageUrl, 
      project_url || null, 
      JSON.stringify(techArray),
      category || 'other'
    ]);
    
    res.status(201).json({
      success: true,
      id: result.id,
      message: 'Portfolio loyihasi yaratildi'
    });
    
  } catch (error) {
    console.error('Create portfolio item error:', error);
    res.status(500).json({ error: 'Portfolio yaratishda xatolik: ' + error.message });
  }
});

// Update portfolio item (admin only)
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { title, description, project_url, technologies, category } = req.body;
    const itemId = req.params.id;
    
    // Check if item exists
    const existingItems = await db.query(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [itemId]
    );
    
    if (existingItems.length === 0) {
      return res.status(404).json({ error: 'Portfolio loyihasi topilmadi' });
    }
    
    const existingItem = existingItems[0];
    
    // Handle image upload
    let imageUrl = existingItem.image_url;
    if (req.file) {
      // Delete old image if exists
      if (existingItem.image_url) {
        const oldImagePath = path.join(__dirname, '..', 'public', existingItem.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/uploads/portfolio/${req.file.filename}`;
    }
    
    // Parse technologies array
    let techArray = JSON.parse(existingItem.technologies || '[]');
    if (technologies) {
      try {
        techArray = Array.isArray(technologies) ? technologies : JSON.parse(technologies);
      } catch (e) {
        techArray = technologies.split(',').map(tech => tech.trim());
      }
    }
    
    await db.run(`
      UPDATE portfolio_items 
      SET title = ?, description = ?, image_url = ?, project_url = ?, 
          technologies = ?, category = ?
      WHERE id = ?
    `, [
      title || existingItem.title,
      description || existingItem.description,
      imageUrl,
      project_url !== undefined ? project_url : existingItem.project_url,
      JSON.stringify(techArray),
      category || existingItem.category,
      itemId
    ]);
    
    res.json({
      success: true,
      message: 'Portfolio loyihasi yangilandi'
    });
    
  } catch (error) {
    console.error('Update portfolio item error:', error);
    res.status(500).json({ error: 'Portfolio yangilashda xatolik: ' + error.message });
  }
});

// Delete portfolio item (admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const itemId = req.params.id;
    
    // Get item to delete image
    const items = await db.query(
      'SELECT * FROM portfolio_items WHERE id = ?',
      [itemId]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'Portfolio loyihasi topilmadi' });
    }
    
    const item = items[0];
    
    // Delete image file if exists
    if (item.image_url) {
      const imagePath = path.join(__dirname, '..', 'public', item.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete from database
    await db.run('DELETE FROM portfolio_items WHERE id = ?', [itemId]);
    
    res.json({
      success: true,
      message: 'Portfolio loyihasi o\'chirildi'
    });
    
  } catch (error) {
    console.error('Delete portfolio item error:', error);
    res.status(500).json({ error: 'Portfolio o\'chirishda xatolik' });
  }
});

// Get portfolio statistics (admin only)
router.get('/admin/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const totalItems = await db.query('SELECT COUNT(*) as count FROM portfolio_items');
    const categoryCounts = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM portfolio_items 
      GROUP BY category 
      ORDER BY count DESC
    `);
    
    res.json({
      totalItems: totalItems[0].count,
      categories: categoryCounts
    });
    
  } catch (error) {
    console.error('Get portfolio stats error:', error);
    res.status(500).json({ error: 'Statistikalarni olishda xatolik' });
  }
});

// Search portfolio items
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { category } = req.query;
    
    let searchQuery = `
      SELECT * FROM portfolio_items 
      WHERE (title LIKE ? OR description LIKE ? OR technologies LIKE ?)
    `;
    const searchParams = [`%${query}%`, `%${query}%`, `%${query}%`];
    
    if (category && category !== 'all') {
      searchQuery += ' AND category = ?';
      searchParams.push(category);
    }
    
    searchQuery += ' ORDER BY created_at DESC LIMIT 50';
    
    const items = await db.query(searchQuery, searchParams);
    
    const portfolioItems = items.map(item => ({
      ...item,
      technologies: JSON.parse(item.technologies || '[]')
    }));
    
    res.json(portfolioItems);
  } catch (error) {
    console.error('Search portfolio error:', error);
    res.status(500).json({ error: 'Qidirishda xatolik' });
  }
});

module.exports = router;