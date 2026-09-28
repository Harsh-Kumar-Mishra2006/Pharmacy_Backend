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
const { upload } = require('../config/multer');

// Public
router.get('/available', getAvailableMedicines);

// Auth required
router.use(protect);

// Admin — accepts multipart/form-data with up to 5 images under field "images"
router.post('/',      isAdmin, upload.array('images', 5), addMedicine);
router.put('/:id',    isAdmin, upload.array('images', 5), updateMedicine);
router.delete('/:id', isAdmin, deleteMedicine);
router.get('/statistics', isAdmin, getMedicineStats);

// Any authenticated user
router.get('/',    getMedicines);
router.get('/:id', getMedicineById);

module.exports = router;