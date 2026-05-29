const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../config/database');

// Configure multer for service image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/services/';
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

// Get all services (public)
router.get('/services', async (req, res) => {
  try {
    const { category, active_only = 'true' } = req.query;
    
    let query = 'SELECT * FROM services WHERE 1=1';
    const params = [];
    
    if (active_only === 'true') {
      query += ' AND is_active = 1';
    }
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const services = await db.query(query, params);
    
    // Parse JSON fields
    const servicesWithFeatures = services.map(service => ({
      ...service,
      features: JSON.parse(service.features || '[]')
    }));
    
    res.json(servicesWithFeatures);
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Xizmatlar ma\'lumotlarini olishda xatolik' });
  }
});

// Get service categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'web-development', name: 'Web Dasturlash', icon: 'fas fa-code' },
      { id: 'mobile-development', name: 'Mobil Ilovalar', icon: 'fas fa-mobile-alt' },
      { id: 'design', name: 'Dizayn', icon: 'fas fa-paint-brush' },
      { id: 'marketing', name: 'Digital Marketing', icon: 'fas fa-chart-line' },
      { id: 'consulting', name: 'Konsalting', icon: 'fas fa-handshake' },
      { id: 'other', name: 'Boshqa', icon: 'fas fa-cogs' }
    ];
    
    res.json(categories);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Kategoriyalarni olishda xatolik' });
  }
});

// Get single service
router.get('/services/:id', async (req, res) => {
  try {
    const services = await db.query(
      'SELECT * FROM services WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    
    if (services.length === 0) {
      return res.status(404).json({ error: 'Xizmat topilmadi' });
    }
    
    const service = services[0];
    service.features = JSON.parse(service.features || '[]');
    
    res.json(service);
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Xizmat ma\'lumotlarini olishda xatolik' });
  }
});

// Create new service (admin only)
router.post('/services', verifyToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { name, description, price, features, category } = req.body;
    
    if (!name || !description || !price) {
      return res.status(400).json({ 
        error: 'Nom, tavsif va narx majburiy' 
      });
    }
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/services/${req.file.filename}`;
    }
    
    // Parse features array
    let featuresArray = [];
    if (features) {
      try {
        featuresArray = Array.isArray(features) ? features : JSON.parse(features);
      } catch (e) {
        featuresArray = features.split(',').map(feature => feature.trim());
      }
    }
    
    const result = await db.run(`
      INSERT INTO services (
        name, description, price, image_url, features, category, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [
      name, 
      description, 
      parseFloat(price), 
      imageUrl, 
      JSON.stringify(featuresArray),
      category || 'other'
    ]);
    
    res.status(201).json({
      success: true,
      id: result.id,
      message: 'Xizmat yaratildi'
    });
    
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({ error: 'Xizmat yaratishda xatolik: ' + error.message });
  }
});

// Update service (admin only)
router.put('/services/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { name, description, price, features, category, is_active } = req.body;
    const serviceId = req.params.id;
    
    // Check if service exists
    const existingServices = await db.query(
      'SELECT * FROM services WHERE id = ?',
      [serviceId]
    );
    
    if (existingServices.length === 0) {
      return res.status(404).json({ error: 'Xizmat topilmadi' });
    }
    
    const existingService = existingServices[0];
    
    // Handle image upload
    let imageUrl = existingService.image_url;
    if (req.file) {
      // Delete old image if exists
      if (existingService.image_url) {
        const oldImagePath = path.join(__dirname, '..', 'public', existingService.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/uploads/services/${req.file.filename}`;
    }
    
    // Parse features array
    let featuresArray = JSON.parse(existingService.features || '[]');
    if (features) {
      try {
        featuresArray = Array.isArray(features) ? features : JSON.parse(features);
      } catch (e) {
        featuresArray = features.split(',').map(feature => feature.trim());
      }
    }
    
    await db.run(`
      UPDATE services 
      SET name = ?, description = ?, price = ?, image_url = ?, 
          features = ?, category = ?, is_active = ?
      WHERE id = ?
    `, [
      name || existingService.name,
      description || existingService.description,
      price !== undefined ? parseFloat(price) : existingService.price,
      imageUrl,
      JSON.stringify(featuresArray),
      category || existingService.category,
      is_active !== undefined ? parseInt(is_active) : existingService.is_active,
      serviceId
    ]);
    
    res.json({
      success: true,
      message: 'Xizmat yangilandi'
    });
    
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({ error: 'Xizmat yangilashda xatolik: ' + error.message });
  }
});

// Delete service (admin only)
router.delete('/services/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const serviceId = req.params.id;
    
    // Get service to delete image
    const services = await db.query(
      'SELECT * FROM services WHERE id = ?',
      [serviceId]
    );
    
    if (services.length === 0) {
      return res.status(404).json({ error: 'Xizmat topilmadi' });
    }
    
    const service = services[0];
    
    // Delete image file if exists
    if (service.image_url) {
      const imagePath = path.join(__dirname, '..', 'public', service.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete from database
    await db.run('DELETE FROM services WHERE id = ?', [serviceId]);
    
    res.json({
      success: true,
      message: 'Xizmat o\'chirildi'
    });
    
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ error: 'Xizmat o\'chirishda xatolik' });
  }
});

// Create service order
router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { serviceId, message, contactInfo } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({ error: 'Xizmat ID talab qilinadi' });
    }
    
    // Get service details
    const services = await db.query(
      'SELECT * FROM services WHERE id = ? AND is_active = 1',
      [serviceId]
    );
    
    if (services.length === 0) {
      return res.status(404).json({ error: 'Xizmat topilmadi' });
    }
    
    const service = services[0];
    
    // Create service order
    const result = await db.run(`
      INSERT INTO service_orders (
        user_id, service_id, amount, status, message, contact_info, created_at
      ) VALUES (?, ?, ?, 'pending', ?, ?, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      serviceId,
      service.price,
      message || '',
      JSON.stringify(contactInfo || {})
    ]);
    
    res.status(201).json({
      success: true,
      orderId: result.id,
      message: 'Buyurtma yaratildi'
    });
    
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Buyurtma yaratishda xatolik' });
  }
});

// Get user orders
router.get('/orders/my', verifyToken, async (req, res) => {
  try {
    const orders = await db.query(`
      SELECT so.*, s.name as service_name, s.image_url as service_image
      FROM service_orders so
      JOIN services s ON so.service_id = s.id
      WHERE so.user_id = ?
      ORDER BY so.created_at DESC
    `, [req.user.id]);
    
    const ordersWithParsedData = orders.map(order => ({
      ...order,
      contact_info: JSON.parse(order.contact_info || '{}')
    }));
    
    res.json(ordersWithParsedData);
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Buyurtmalar ma\'lumotlarini olishda xatolik' });
  }
});

// Get all orders (admin only)
router.get('/orders', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { status, limit = 50 } = req.query;
    
    let query = `
      SELECT so.*, s.name as service_name, s.image_url as service_image,
             u.username, u.email
      FROM service_orders so
      JOIN services s ON so.service_id = s.id
      JOIN users u ON so.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND so.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY so.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const orders = await db.query(query, params);
    
    const ordersWithParsedData = orders.map(order => ({
      ...order,
      contact_info: JSON.parse(order.contact_info || '{}')
    }));
    
    res.json(ordersWithParsedData);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Buyurtmalar ma\'lumotlarini olishda xatolik' });
  }
});

// Update order status (admin only)
router.put('/orders/:id/status', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { status } = req.body;
    const orderId = req.params.id;
    
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Yaroqsiz status' });
    }
    
    await db.run(
      'UPDATE service_orders SET status = ? WHERE id = ?',
      [status, orderId]
    );
    
    res.json({
      success: true,
      message: 'Buyurtma holati yangilandi'
    });
    
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Buyurtma holatini yangilashda xatolik' });
  }
});

// Get business statistics (admin only)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const totalServices = await db.query('SELECT COUNT(*) as count FROM services');
    const activeServices = await db.query('SELECT COUNT(*) as count FROM services WHERE is_active = 1');
    const totalOrders = await db.query('SELECT COUNT(*) as count FROM service_orders');
    const pendingOrders = await db.query('SELECT COUNT(*) as count FROM service_orders WHERE status = "pending"');
    
    const ordersByStatus = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM service_orders 
      GROUP BY status
    `);
    
    const revenueStats = await db.query(`
      SELECT 
        SUM(amount) as total_revenue,
        COUNT(*) as completed_orders
      FROM service_orders 
      WHERE status = 'completed'
    `);
    
    res.json({
      totalServices: totalServices[0].count,
      activeServices: activeServices[0].count,
      totalOrders: totalOrders[0].count,
      pendingOrders: pendingOrders[0].count,
      ordersByStatus: ordersByStatus,
      totalRevenue: revenueStats[0].total_revenue || 0,
      completedOrders: revenueStats[0].completed_orders || 0
    });
    
  } catch (error) {
    console.error('Get business stats error:', error);
    res.status(500).json({ error: 'Statistikalarni olishda xatolik' });
  }
});

// Contact form submission
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message, phone } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ 
        error: 'Ism, email va xabar majburiy' 
      });
    }
    
    // Here you would typically send an email or save to database
    // For now, we'll just log it and return success
    console.log('Contact form submission:', {
      name,
      email,
      subject,
      message,
      phone,
      timestamp: new Date()
    });
    
    res.json({
      success: true,
      message: 'Xabaringiz yuborildi! Tez orada javob beramiz.'
    });
    
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Xabar yuborishda xatolik' });
  }
});

module.exports = router;