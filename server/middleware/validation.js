import { body, validationResult } from 'express-validator';

export const validateInput = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: errors.array(),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

export const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ min: 5, max: 100 })
    .withMessage('Email must be between 5 and 100 characters'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, underscores, and hyphens'),
  
  validateInput
];

export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  validateInput
];

export const validateDeck = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .withMessage('Deck name must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters')
    .trim()
    .escape(),
  
  body('main')
    .isArray({ min: 0, max: 60 })
    .withMessage('Main deck must have between 0 and 60 cards'),
  
  body('main.*')
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage('Card IDs must be between 1 and 20 characters'),
  
  body('extra')
    .isArray({ min: 0, max: 15 })
    .withMessage('Extra deck must have between 0 and 15 cards'),
  
  body('side')
    .isArray({ min: 0, max: 15 })
    .withMessage('Side deck must have between 0 and 15 cards'),
  
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean value'),
  
  validateInput
];

export const validateCardSearch = [
  body('query')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters')
    .trim()
    .escape(),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  validateInput
];

export const validateAnalytics = [
  body('deckId')
    .isMongoId()
    .withMessage('Invalid deck ID format'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  validateInput
];

// Sanitize HTML content to prevent XSS
export const sanitizeHtml = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      for (let key in obj) {
        if (typeof obj[key] === 'string') {
          // Remove potentially dangerous HTML tags and attributes
          obj[key] = obj[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
            .replace(/<[^>]*>/g, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
};

// Rate limiting for specific endpoints
export const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message, code: 'RATE_LIMIT_EXCEEDED' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};
