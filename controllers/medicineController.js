const { Medicine, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// @desc   Admin creates medicine metadata
// @route  POST /api/medicines
// @access Private/Admin
exports.addMedicine = async (req, res) => {
  try {
    const {
      name, generic_name, brand_name, category,
      medical_details, other_details, metadata, images
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and category'
      });
    }

    const medicine = await Medicine.create({
      name, generic_name, brand_name, category,
      medical_details: medical_details || {},
      other_details: other_details || {},
      metadata: metadata || {},
      images: images || [],
      created_by: req.user.id
    });

    const result = await Medicine.findByPk(medicine.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: result
    });
  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).json({ success: false, message: 'Error adding medicine', error: error.message });
  }
};

// @desc   Get all medicines (catalog)
// @route  GET /api/medicines
// @access Private
exports.getMedicines = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { generic_name: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Medicine.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ success: false, message: 'Error fetching medicines', error: error.message });
  }
};

// @desc   Get single medicine
// @route  GET /api/medicines/:id
// @access Private
exports.getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
      ]
    });

    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({ success: false, message: 'Error fetching medicine', error: error.message });
  }
};

// @desc   Admin updates medicine metadata
// @route  PUT /api/medicines/:id
// @access Private/Admin
exports.updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    await medicine.update(req.body);

    const updated = await Medicine.findByPk(medicine.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({ success: false, message: 'Error updating medicine', error: error.message });
  }
};

// @desc   Admin deletes medicine
// @route  DELETE /api/medicines/:id
// @access Private/Admin
exports.deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    await medicine.destroy();
    res.status(200).json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({ success: false, message: 'Error deleting medicine', error: error.message });
  }
};

// @desc   Admin stats for catalog
// @route  GET /api/medicines/statistics
// @access Private/Admin
exports.getMedicineStats = async (req, res) => {
  try {
    const totalMedicines = await Medicine.count();

    const categories = await Medicine.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['category']
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalMedicines,
        categories,
        category_count: categories.length
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
};