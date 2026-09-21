const express = require('express');
const router = express.Router();
const {
  addMedicine,
  getMedicines,
  getMedicineById,
  updateMedicine,
  deleteMedicine,
  getMedicineStats
} = require('../controllers/medicineController');
const { protect, isAdmin } = require('../middlewares/authMiddleware');

router.use(protect);

// Admin only
router.post('/', isAdmin, addMedicine);
router.put('/:id', isAdmin, updateMedicine);
router.delete('/:id', isAdmin, deleteMedicine);
router.get('/statistics', isAdmin, getMedicineStats);

// Any authenticated user (supplier can browse catalog to pick medicine to supply)
router.get('/', getMedicines);
router.get('/:id', getMedicineById);

module.exports = router;