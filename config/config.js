module.exports = {
  // JWT Secret (in production, use environment variable)
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  
  // Stripe Configuration
  stripe: {
    publicKey: process.env.STRIPE_PUBLIC_KEY || 'pk_test_your_stripe_public_key',
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret'
  },
  
  // App Configuration
  app: {
    name: 'Universal Platform',
    url: process.env.APP_URL || 'http://localhost:3000',
    port: process.env.PORT || 3000
  },
  
  // File Upload Configuration
  upload: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['application/pdf'],
    uploadDir: 'uploads/'
  },
  
  // Security Configuration
  security: {
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes
    jwtExpiration: '24h'
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  }
};