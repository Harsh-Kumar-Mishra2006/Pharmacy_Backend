const jwt = require('jsonwebtoken');
const User = require('../models/user')(require('../config/database').sequelize);

// Verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!req.user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token'
    });
  }
};

// Check specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Check if user is admin
const isAdmin = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};


// Check if user is supplier or admin
const isSupplierOrAdmin = async (req, res, next) => {
  if (!['supplier', 'admin'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Supplier or Admin access required'
    });
  }
  next();
};

// Check if user owns the resource (for suppliers)
const isResourceOwner = (model) => {
  return async (req, res, next) => {
    const resource = await model.findByPk(req.params.id);
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Admin can access any, supplier only their own
    if (req.user.role === 'admin') {
      req.resource = resource;
      return next();
    }
    
    if (req.user.role === 'supplier' && resource.supplier_id === req.user.id) {
      req.resource = resource;
      return next();
    }
    
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource'
    });
  };
};

const isSupplier = (req, res, next) => {
  if (req.user && req.user.role === 'supplier') return next();
  return res.status(403).json({ success: false, message: 'Supplier access only' });
};

module.exports = {
  protect,
  authorize,
  isAdmin,
  isSupplierOrAdmin,
  isResourceOwner,
  isSupplier
};
