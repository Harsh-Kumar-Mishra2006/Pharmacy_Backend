const express = require('express');
const router = express.Router();
const {
  addMedicine,
  getMedicines,
  getAvailableMedicines,   
  getMedicineById,
  updateMedicine,
  deleteMedicine,
  getMedicineStats,
} = require('../controllers/medicineController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

// -------- PUBLIC: customers must see available stock --------
router.get('/available', getAvailableMedicines);   // <-- MUST be before /:id

// Everything below requires auth
router.use(protect);

// Admin only
router.post('/',           isAdmin, addMedicine);
router.put('/:id',         isAdmin, updateMedicine);
router.delete('/:id',      isAdmin, deleteMedicine);
router.get('/statistics',  isAdmin, getMedicineStats);

// Any authenticated user
router.get('/',     getMedicines);
router.get('/:id',  getMedicineById);   // <-- this must come AFTER /available

module.exports = router;