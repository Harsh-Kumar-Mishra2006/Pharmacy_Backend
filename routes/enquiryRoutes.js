const express = require('express');
const router = express.Router();
const {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  acceptEnquiry,
  rejectEnquiry,
  cancelEnquiry,
  getEnquiryStats,
  getSupplierEnquirySummary
} = require('../controllers/enquiryController');
const { protect, isAdmin, isSupplier } = require('../middlewares/authMiddleware');

router.use(protect);

// Admin
router.post('/', isAdmin, createEnquiry);
router.get('/statistics', isAdmin, getEnquiryStats);
router.put('/:id/cancel', isAdmin, cancelEnquiry);

// Supplier
router.get('/supplier-summary', isSupplier, getSupplierEnquirySummary);
router.put('/:id/accept', isSupplier, acceptEnquiry);
router.put('/:id/reject', isSupplier, rejectEnquiry);

// Shared
router.get('/', getEnquiries);
router.get('/:id', getEnquiryById);

module.exports = router;