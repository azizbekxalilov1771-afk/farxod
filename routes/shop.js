const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../config/database');

// Configure multer for product image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/products/';
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

// Get all products (public)
router.get('/products', async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0, sort = 'created_at DESC' } = req.query;
    
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];
    
    if (category && category !== 'all') {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // Add sorting
    const validSortOptions = {
      'name_asc': 'name ASC',
      'name_desc': 'name DESC',
      'price_asc': 'price ASC',
      'price_desc': 'price DESC',
      'created_at_desc': 'created_at DESC',
      'created_at_asc': 'created_at ASC'
    };
    
    const orderBy = validSortOptions[sort] || 'created_at DESC';
    query += ` ORDER BY ${orderBy}`;
    
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const products = await db.query(query, params);
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Mahsulotlar ma\'lumotlarini olishda xatolik' });
  }
});

// Get product categories
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'courses', name: 'Kurslar', icon: 'fas fa-graduation-cap' },
      { id: 'templates', name: 'Shablonlar', icon: 'fas fa-file-code' },
      { id: 'tools', name: 'Vositalar', icon: 'fas fa-tools' },
      { id: 'ebooks', name: 'E-kitoblar', icon: 'fas fa-book' },
      { id: 'plugins', name: 'Plaginlar', icon: 'fas fa-plug' },
      { id: 'other', name: 'Boshqa', icon: 'fas fa-box' }
    ];
    
    // Get product counts for each category
    const categoryCounts = await db.query(`
      SELECT category, COUNT(*) as count 
      FROM products 
      WHERE is_active = 1 
      GROUP BY category
    `);
    
    const categoriesWithCounts = categories.map(category => {
      const count = categoryCounts.find(c => c.category === category.id);
      return {
        ...category,
        count: count ? count.count : 0
      };
    });
    
    res.json(categoriesWithCounts);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Kategoriyalarni olishda xatolik' });
  }
});

// Get single product
router.get('/products/:id', async (req, res) => {
  try {
    const products = await db.query(
      'SELECT * FROM products WHERE id = ? AND is_active = 1',
      [req.params.id]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    res.json(products[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Mahsulot ma\'lumotlarini olishda xatolik' });
  }
});

// Create new product (admin only)
router.post('/products', verifyToken, upload.single('image'), async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { name, description, price, category, stock_quantity } = req.body;
    
    if (!name || !description || !price) {
      return res.status(400).json({ 
        error: 'Nom, tavsif va narx majburiy' 
      });
    }
    
    // Handle image upload
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    const result = await db.run(`
      INSERT INTO products (
        name, description, price, image_url, category, stock_quantity, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, 1)
    `, [
      name, 
      description, 
      parseFloat(price), 
      imageUrl, 
      category || 'other',
      parseInt(stock_quantity) || 0
    ]);
    
    res.status(201).json({
      success: true,
      id: result.id,
      message: 'Mahsulot yaratildi'
    });
    
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Mahsulot yaratishda xatolik: ' + error.message });
  }
});

// Update product (admin only)
router.put('/products/:id', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const { name, description, price, category, stock_quantity, is_active } = req.body;
    const productId = req.params.id;
    
    // Check if product exists
    const existingProducts = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );
    
    if (existingProducts.length === 0) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const existingProduct = existingProducts[0];
    
    // Handle image upload
    let imageUrl = existingProduct.image_url;
    if (req.file) {
      // Delete old image if exists
      if (existingProduct.image_url) {
        const oldImagePath = path.join(__dirname, '..', 'public', existingProduct.image_url);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }
      imageUrl = `/uploads/products/${req.file.filename}`;
    }
    
    await db.run(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, image_url = ?, 
          category = ?, stock_quantity = ?, is_active = ?
      WHERE id = ?
    `, [
      name || existingProduct.name,
      description || existingProduct.description,
      price !== undefined ? parseFloat(price) : existingProduct.price,
      imageUrl,
      category || existingProduct.category,
      stock_quantity !== undefined ? parseInt(stock_quantity) : existingProduct.stock_quantity,
      is_active !== undefined ? parseInt(is_active) : existingProduct.is_active,
      productId
    ]);
    
    res.json({
      success: true,
      message: 'Mahsulot yangilandi'
    });
    
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Mahsulot yangilashda xatolik: ' + error.message });
  }
});

// Delete product (admin only)
router.delete('/products/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const productId = req.params.id;
    
    // Get product to delete image
    const products = await db.query(
      'SELECT * FROM products WHERE id = ?',
      [productId]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const product = products[0];
    
    // Delete image file if exists
    if (product.image_url) {
      const imagePath = path.join(__dirname, '..', 'public', product.image_url);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete from database
    await db.run('DELETE FROM products WHERE id = ?', [productId]);
    
    res.json({
      success: true,
      message: 'Mahsulot o\'chirildi'
    });
    
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Mahsulot o\'chirishda xatolik' });
  }
});

// Shopping cart routes

// Add to cart
router.post('/cart/add', verifyToken, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    
    if (!productId) {
      return res.status(400).json({ error: 'Mahsulot ID talab qilinadi' });
    }
    
    // Check if product exists and is active
    const products = await db.query(
      'SELECT * FROM products WHERE id = ? AND is_active = 1',
      [productId]
    );
    
    if (products.length === 0) {
      return res.status(404).json({ error: 'Mahsulot topilmadi' });
    }
    
    const product = products[0];
    
    // Check stock availability
    if (product.stock_quantity < quantity) {
      return res.status(400).json({ error: 'Yetarli miqdorda mahsulot yo\'q' });
    }
    
    // For now, we'll use session-based cart (in production, you might want database-based cart)
    res.json({
      success: true,
      message: 'Mahsulot savatga qo\'shildi',
      product: product,
      quantity: quantity
    });
    
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: 'Savatga qo\'shishda xatolik' });
  }
});

// Get cart items (placeholder - in real app, this would fetch from database or session)
router.get('/cart', verifyToken, async (req, res) => {
  try {
    // Placeholder cart items
    res.json({
      items: [],
      total: 0,
      itemCount: 0
    });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: 'Savat ma\'lumotlarini olishda xatolik' });
  }
});

// Create order
router.post('/orders', verifyToken, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod } = req.body;
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Savat bo\'sh' });
    }
    
    let totalAmount = 0;
    const orderItems = [];
    
    // Validate items and calculate total
    for (const item of items) {
      const products = await db.query(
        'SELECT * FROM products WHERE id = ? AND is_active = 1',
        [item.productId]
      );
      
      if (products.length === 0) {
        return res.status(400).json({ error: `Mahsulot topilmadi: ${item.productId}` });
      }
      
      const product = products[0];
      const quantity = item.quantity || 1;
      
      if (product.stock_quantity < quantity) {
        return res.status(400).json({ 
          error: `Yetarli miqdorda mahsulot yo'q: ${product.name}` 
        });
      }
      
      const itemTotal = product.price * quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        total: itemTotal,
        image_url: product.image_url
      });
    }
    
    // Create order
    const result = await db.run(`
      INSERT INTO orders (
        user_id, total_amount, status, items, created_at
      ) VALUES (?, ?, 'pending', ?, CURRENT_TIMESTAMP)
    `, [
      req.user.id,
      totalAmount,
      JSON.stringify({
        items: orderItems,
        shippingAddress: shippingAddress,
        paymentMethod: paymentMethod
      })
    ]);
    
    res.status(201).json({
      success: true,
      orderId: result.id,
      totalAmount: totalAmount,
      items: orderItems,
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
    const orders = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items || '{}')
    }));
    
    res.json(ordersWithParsedItems);
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
      SELECT o.*, u.username, u.email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const orders = await db.query(query, params);
    
    const ordersWithParsedItems = orders.map(order => ({
      ...order,
      items: JSON.parse(order.items || '{}')
    }));
    
    res.json(ordersWithParsedItems);
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
    
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Yaroqsiz status' });
    }
    
    await db.run(
      'UPDATE orders SET status = ? WHERE id = ?',
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

// Get shop statistics (admin only)
router.get('/stats', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    
    const totalProducts = await db.query('SELECT COUNT(*) as count FROM products');
    const activeProducts = await db.query('SELECT COUNT(*) as count FROM products WHERE is_active = 1');
    const totalOrders = await db.query('SELECT COUNT(*) as count FROM orders');
    const pendingOrders = await db.query('SELECT COUNT(*) as count FROM orders WHERE status = "pending"');
    
    const ordersByStatus = await db.query(`
      SELECT status, COUNT(*) as count 
      FROM orders 
      GROUP BY status
    `);
    
    const revenueStats = await db.query(`
      SELECT 
        SUM(total_amount) as total_revenue,
        COUNT(*) as completed_orders
      FROM orders 
      WHERE status = 'delivered'
    `);
    
    const topProducts = await db.query(`
      SELECT p.name, p.price, COUNT(o.id) as order_count
      FROM products p
      LEFT JOIN orders o ON JSON_EXTRACT(o.items, '$.items[*].id') LIKE CONCAT('%', p.id, '%')
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY order_count DESC
      LIMIT 5
    `);
    
    res.json({
      totalProducts: totalProducts[0].count,
      activeProducts: activeProducts[0].count,
      totalOrders: totalOrders[0].count,
      pendingOrders: pendingOrders[0].count,
      ordersByStatus: ordersByStatus,
      totalRevenue: revenueStats[0].total_revenue || 0,
      completedOrders: revenueStats[0].completed_orders || 0,
      topProducts: topProducts
    });
    
  } catch (error) {
    console.error('Get shop stats error:', error);
    res.status(500).json({ error: 'Statistikalarni olishda xatolik' });
  }
});

// Search products
router.get('/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const { category, limit = 20 } = req.query;
    
    let searchQuery = `
      SELECT * FROM products 
      WHERE is_active = 1 AND (name LIKE ? OR description LIKE ?)
    `;
    const searchParams = [`%${query}%`, `%${query}%`];
    
    if (category && category !== 'all') {
      searchQuery += ' AND category = ?';
      searchParams.push(category);
    }
    
    searchQuery += ' ORDER BY created_at DESC LIMIT ?';
    searchParams.push(parseInt(limit));
    
    const products = await db.query(searchQuery, searchParams);
    
    res.json(products);
  } catch (error) {
    console.error('Search products error:', error);
    res.status(500).json({ error: 'Qidirishda xatolik' });
  }
});

module.exports = router;