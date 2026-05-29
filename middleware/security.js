const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const db = require('../config/database');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs,
    max: max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General rate limiter
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per window
  'Juda ko\'p so\'rov. 15 daqiqadan keyin qayta urinib ko\'ring.'
);

// Strict rate limiter for auth endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts per window
  'Juda ko\'p kirish urinishi. 15 daqiqadan keyin qayta urinib ko\'ring.'
);

// API rate limiter
const apiLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  200, // 200 requests per window
  'API cheklovi oshib ketdi. Biroz kuting.'
);

// File upload limiter
const uploadLimiter = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  'Fayl yuklash cheklovi oshib ketdi. 1 soatdan keyin urinib ko\'ring.'
);

// Enhanced security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdnjs.cloudflare.com", 
        "https://fonts.googleapis.com"
      ],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://js.stripe.com",
        "'unsafe-eval'" // Only for development - remove in production
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: [
        "'self'", 
        "https://api.stripe.com",
        "https://checkout.stripe.com"
      ],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
});

// JWT token verification middleware
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header talab qilinadi' });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Token talab qilinadi' });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Check if user still exists and is active
    const users = await db.query(
      'SELECT id, username, email, role FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    }

    req.user = users[0];
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Yaroqsiz token' });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token muddati tugagan' });
    }

    console.error('Token verification error:', error);
    return res.status(500).json({ error: 'Token tekshirishda xatolik' });
  }
};

// Admin role verification middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin huquqlari talab qilinadi' });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Helper function to recursively sanitize objects
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous characters
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<.*?>/g, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitize(obj[key]);
        }
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

// Request logging middleware
const logRequests = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };

    // Log suspicious requests
    if (res.statusCode >= 400) {
      console.warn('Suspicious request:', logData);
    }
    
    // Log slow requests
    if (duration > 5000) {
      console.warn('Slow request:', logData);
    }
  });

  next();
};

// File upload validation middleware
const validateFileUpload = (allowedTypes = [], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return next();
    }

    const file = req.file;

    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({
        error: `Fayl hajmi ${Math.round(maxSize / (1024 * 1024))}MB dan oshmasligi kerak`
      });
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        error: `Faqat quyidagi fayl turlari ruxsat etilgan: ${allowedTypes.join(', ')}`
      });
    }

    // Check for suspicious file extensions
    const suspiciousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.vbs', '.js'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (suspiciousExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: 'Xavfli fayl turi aniqlandi'
      });
    }

    next();
  };
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://your-domain.com' // Replace with your actual domain
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy tomonidan ruxsat etilmagan'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'Fayl hajmi juda katta'
    });
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      error: 'Juda ko\'p fayl yuklandi'
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Yaroqsiz token'
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Ma\'lumotlar yaroqsiz',
      details: err.message
    });
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json({
      error: 'Ma\'lumotlar bazasi chekloviga zid'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Ichki server xatosi' 
      : err.message
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  uploadLimiter,
  securityHeaders,
  verifyToken,
  requireAdmin,
  sanitizeInput,
  logRequests,
  validateFileUpload,
  corsOptions,
  errorHandler
};