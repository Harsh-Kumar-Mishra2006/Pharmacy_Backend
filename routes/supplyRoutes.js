const express = require('express');
const router = express.Router();
const {
  addSupply,
  getSupplies,
  getSupplyById,
  updateSupply,
  deleteSupply,
  approveSupply,
  rejectSupply,
  receiveSupply,
  getSupplierSummary,
  getSuppliesBySupplier,
  getSupplyStats
} = require('../controllers/supplyController');
const { protect, isAdmin, isSupplier, isSupplierOrAdmin } = require('../middlewares/authMiddleware');

router.use(protect);

// Supplier routes
router.post('/', isSupplier, addSupply);
router.put('/:id', isSupplier, updateSupply);
router.delete('/:id', isSupplierOrAdmin, deleteSupply);
router.get('/supplier-summary', isSupplier, getSupplierSummary);

// Admin routes
router.get('/statistics', isAdmin, getSupplyStats);
router.get('/supplier/:supplierId', isAdmin, getSuppliesBySupplier);
router.put('/:id/approve', isAdmin, approveSupply);
router.put('/:id/reject', isAdmin, rejectSupply);
router.put('/:id/receive', isAdmin, receiveSupply);

// Shared
router.get('/', getSupplies);
router.get('/:id', getSupplyById);

module.exports = router;