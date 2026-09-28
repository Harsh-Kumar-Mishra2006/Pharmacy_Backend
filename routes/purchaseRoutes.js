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
const {
  protect,
  isAdmin,
  optionalProtect,   // ← add this
} = require('../middlewares/authMiddleware');
const { upload } = require('../config/multer');

// Public — but capture the user if a token is present
router.post('/', optionalProtect, createPurchase);

// Screenshot upload — multipart/form-data, field name: "screenshot"
router.post(
  '/:id/upload-screenshot',
  upload.single('screenshot'),
  uploadPaymentScreenshot,
);

// Auth required
router.get('/my-purchases', protect, getMyPurchases);
router.put('/:id/cancel', protect, cancelPurchase);

// Admin
router.get('/admin/all', protect, isAdmin, getAllPurchases);
router.get('/admin/pending-verifications', protect, isAdmin, getPendingVerifications);
router.get('/admin/statistics', protect, isAdmin, getPurchaseStats);
router.put('/admin/:id/verify-payment', protect, isAdmin, verifyPayment);

// Public single — MUST be last
router.get('/:id', getPurchaseById);

module.exports = router;