const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getAllUsers,
  getUsersByRole,
  updateUserRole,
  toggleUserStatus,
  deleteUser,
  searchUsers,
  getAvailableSuppliers 
} = require('../controllers/authController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (all authenticated users)
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// Admin only routes
router.get('/users', protect, authorize('admin'), getAllUsers);
router.get('/users/search', protect, authorize('admin'), searchUsers);
router.get('/users/role/:role', protect, authorize('admin'), getUsersByRole);
router.put('/users/:id/role', protect, authorize('admin'), updateUserRole);
router.put('/users/:id/toggle-status', protect, authorize('admin'), toggleUserStatus);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

router.get('/suppliers', protect, isAdmin, getAvailableSuppliers);
module.exports = router;