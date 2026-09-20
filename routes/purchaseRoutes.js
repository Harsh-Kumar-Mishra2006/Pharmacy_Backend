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
  getPurchaseStats
} = require('../controllers/purchaseController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

// Public routes (No auth required)
router.post('/', createPurchase);
router.post('/:id/upload-screenshot', uploadPaymentScreenshot);
router.get('/:id', getPurchaseById);

// Protected routes (User)
router.get('/my-purchases', protect, getMyPurchases);
router.put('/:id/cancel', protect, cancelPurchase);

// Admin only routes
router.get('/admin/all', protect, isAdmin, getAllPurchases);
router.get('/admin/pending-verifications', protect, isAdmin, getPendingVerifications);
router.get('/admin/statistics', protect, isAdmin, getPurchaseStats);
router.put('/admin/:id/verify-payment', protect, isAdmin, verifyPayment);

module.exports = router;