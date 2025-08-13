import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'MISSING_TOKEN'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
    
    // Add additional security checks
    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({ 
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Check if token is not expired
    if (decoded.exp && Date.now() >= decoded.exp * 1000) {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    } else {
      return res.status(500).json({ 
        error: 'Token verification failed',
        code: 'VERIFICATION_FAILED'
      });
    }
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
};

export const generateToken = (userId, email, role = 'user') => {
  return jwt.sign(
    { 
      userId, 
      email, 
      role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    },
    process.env.JWT_SECRET || 'fallback-secret-key'
  );
};
