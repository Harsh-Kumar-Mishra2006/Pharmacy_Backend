// routes/purchaseRoutes.js
const express = require('express');
const router = express.Router();
const {
  createPurchase,
  uploadPaymentScreenshot,
  verifyPayment,
  getMyPurchases,
  getPurchaseById,
  getAllPurchases,
  getPendingVerifications,
  cancelPurchase,
  getPurchaseStats,
} = require('../controllers/purchaseController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

// ==================== PUBLIC ====================
router.post('/', createPurchase);
router.post('/:id/upload-screenshot', uploadPaymentScreenshot);

// ==================== AUTHENTICATED (any role) ====================
router.get('/my-purchases', protect, getMyPurchases);
router.put('/:id/cancel', protect, cancelPurchase);

// ==================== ADMIN ====================
router.get('/admin/all', protect, isAdmin, getAllPurchases);
router.get('/admin/pending-verifications', protect, isAdmin, getPendingVerifications);
router.get('/admin/statistics', protect, isAdmin, getPurchaseStats);
router.put('/admin/:id/verify-payment', protect, isAdmin, verifyPayment);

// ==================== PUBLIC SINGLE (LAST!) ====================
router.get('/:id', getPurchaseById);

module.exports = router;