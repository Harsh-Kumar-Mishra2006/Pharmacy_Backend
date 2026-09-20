const express = require('express');
const router = express.Router();
const {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  updateQuantity,
  approveMedicine,
  rejectMedicine,
  deleteMedicine,
  getMedicineStats,
  getSupplierSummary,
  getMedicinesBySupplier
} = require('../controllers/medicineController');
const { protect, isAdmin, isSupplierOrAdmin, isResourceOwner } = require('../middlewares/authMiddleware');
const { Medicine } = require('../models');

// Protected routes
router.use(protect);

// Supplier routes
router.post('/', isSupplierOrAdmin, addMedicine);
router.put('/:id', isSupplierOrAdmin, isResourceOwner(Medicine), updateMedicine);
router.patch('/:id/quantity', isSupplierOrAdmin, isResourceOwner(Medicine), updateQuantity);

// Admin only routes
router.get('/statistics', isAdmin, getMedicineStats);
router.get('/supplier-summary', isSupplierOrAdmin, getSupplierSummary);
router.get('/supplier/:supplierId', isAdmin, getMedicinesBySupplier);
router.put('/:id/approve', isAdmin, approveMedicine);
router.put('/:id/reject', isAdmin, rejectMedicine);
router.delete('/:id', isAdmin, deleteMedicine);

// All authenticated users (with proper filtering)
router.get('/', getMedicines);
router.get('/:id', getMedicineById);

module.exports = router;