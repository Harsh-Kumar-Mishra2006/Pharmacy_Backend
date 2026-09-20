const { Medicine, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// @desc    Add new medicine (Supplier)
// @route   POST /api/medicines
// @access  Private/Supplier
exports.addMedicine = async (req, res) => {
  try {
    const {
      name,
      generic_name,
      brand_name,
      category,
      medical_details,
      other_details,
      metadata,
      quantity,
      min_quantity_alert,
      max_quantity,
      unit_price,
      purchase_price,
      discount_percentage,
      expiry_date,
      images
    } = req.body;

    // Validate required fields
    if (!name || !category || quantity === undefined || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, category, quantity and unit price'
      });
    }

    // Create medicine
    const medicine = await Medicine.create({
      name,
      generic_name,
      brand_name,
      category,
      medical_details: medical_details || {},
      other_details: other_details || {},
      metadata: metadata || {},
      quantity,
      min_quantity_alert: min_quantity_alert || 10,
      max_quantity: max_quantity || null,
      unit_price,
      purchase_price: purchase_price || null,
      discount_percentage: discount_percentage || 0,
      expiry_date: expiry_date || null,
      images: images || [],
      supplier_id: req.user.id,
      status: 'pending' // Needs admin approval
    });

    // Get medicine with supplier details
    const medicineWithSupplier = await Medicine.findByPk(medicine.id, {
      include: [{
        model: User,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'phone']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Medicine added successfully and pending admin approval',
      data: medicineWithSupplier
    });
  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding medicine',
      error: error.message
    });
  }
};

// @desc    Get all medicines (with filters)
// @route   GET /api/medicines
// @access  Private
exports.getMedicines = async (req, res) => {
  try {
    const { 
      category, 
      status, 
      supplier_id,
      min_price,
      max_price,
      in_stock,
      low_stock,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const where = {};
    
    // Role-based filtering
    if (req.user.role === 'supplier') {
      where.supplier_id = req.user.id;
    } else if (req.user.role === 'user') {
      where.status = 'approved';
      where.is_available = true;
    }

    // Apply filters
    if (category) where.category = category;
    if (status && req.user.role === 'admin') where.status = status;
    if (supplier_id && req.user.role === 'admin') where.supplier_id = supplier_id;
    
    // Price range
    if (min_price || max_price) {
      where.unit_price = {};
      if (min_price) where.unit_price[Op.gte] = parseFloat(min_price);
      if (max_price) where.unit_price[Op.lte] = parseFloat(max_price);
    }

    // Stock filters
    if (in_stock === 'true') {
      where.quantity = { [Op.gt]: 0 };
    }
    if (low_stock === 'true') {
  where[Op.and] = [
    ...(where[Op.and] || []),
    sequelize.where(
      sequelize.col('quantity'),
      Op.lte,
      sequelize.col('min_quantity_alert')
    ),
  ];
}

    // Search
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { generic_name: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Medicine.findAndCountAll({
      where,
      include: [{
        model: User,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'phone']
      }],
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
    res.status(500).json({
      success: false,
      message: 'Error fetching medicines',
      error: error.message
    });
  }
};

// @desc    Get single medicine
// @route   GET /api/medicines/:id
// @access  Private
exports.getMedicineById = async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findByPk(id, {
      include: [{
        model: User,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'phone', 'address']
      }]
    });

    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check access
    if (req.user.role === 'supplier' && medicine.supplier_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view this medicine'
      });
    }

    // Users can only see approved medicines
    if (req.user.role === 'user' && medicine.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'This medicine is not available yet'
      });
    }

    res.status(200).json({
      success: true,
      data: medicine
    });
  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicine',
      error: error.message
    });
  }
};

// @desc    Update medicine (Supplier/Owner)
// @route   PUT /api/medicines/:id
// @access  Private/Supplier
exports.updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check ownership
    if (req.user.role === 'supplier' && medicine.supplier_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this medicine'
      });
    }

    // If medicine is approved, updating requires re-approval
    const wasApproved = medicine.status === 'approved';
    
    // Update fields
    await medicine.update(updates);

    // If it was approved and important fields changed, reset to pending
    if (wasApproved && (updates.name || updates.category || updates.medical_details || updates.other_details)) {
      await medicine.update({
        status: 'pending',
        approved_at: null,
        approved_by: null,
        approval_notes: 'Updated by supplier, requires re-approval'
      });
    }

    const updatedMedicine = await Medicine.findByPk(id, {
      include: [{
        model: User,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'phone']
      }]
    });

    res.status(200).json({
      success: true,
      message: wasApproved ? 'Medicine updated and pending re-approval' : 'Medicine updated successfully',
      data: updatedMedicine
    });
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medicine',
      error: error.message
    });
  }
};

// @desc    Update medicine quantity (Supplier)
// @route   PATCH /api/medicines/:id/quantity
// @access  Private/Supplier
exports.updateQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, operation = 'set' } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide quantity'
      });
    }

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check ownership
    if (req.user.role === 'supplier' && medicine.supplier_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this medicine'
      });
    }

    let newQuantity;
    switch (operation) {
      case 'add':
        newQuantity = medicine.quantity + quantity;
        break;
      case 'subtract':
        newQuantity = medicine.quantity - quantity;
        if (newQuantity < 0) {
          return res.status(400).json({
            success: false,
            message: 'Insufficient stock'
          });
        }
        break;
      case 'set':
      default:
        newQuantity = quantity;
        if (newQuantity < 0) {
          return res.status(400).json({
            success: false,
            message: 'Quantity cannot be negative'
          });
        }
        break;
    }

    await medicine.update({
      quantity: newQuantity,
      last_restocked_at: operation === 'add' ? new Date() : medicine.last_restocked_at
    });

    res.status(200).json({
      success: true,
      message: `Quantity updated successfully (${operation}: ${quantity})`,
      data: {
        id: medicine.id,
        name: medicine.name,
        previous_quantity: medicine.quantity - (operation === 'add' ? quantity : 0),
        current_quantity: medicine.quantity,
        is_low_stock: medicine.isLowStock(),
        is_out_of_stock: medicine.isOutOfStock()
      }
    });
  } catch (error) {
    console.error('Update quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quantity',
      error: error.message
    });
  }
};

// @desc    Admin approve medicine
// @route   PUT /api/medicines/:id/approve
// @access  Private/Admin
exports.approveMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_notes } = req.body;

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    if (medicine.status === 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Medicine is already approved'
      });
    }

    await medicine.update({
      status: 'approved',
      approved_at: new Date(),
      approved_by: req.user.id,
      approval_notes: approval_notes || 'Approved by admin',
      is_available: true
    });

    const updatedMedicine = await Medicine.findByPk(id, {
      include: [
        {
          model: User,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: User,
          as: 'approver',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Medicine approved successfully',
      data: updatedMedicine
    });
  } catch (error) {
    console.error('Approve medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving medicine',
      error: error.message
    });
  }
};

// @desc    Admin reject medicine
// @route   PUT /api/medicines/:id/reject
// @access  Private/Admin
exports.rejectMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    if (!rejection_reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide rejection reason'
      });
    }

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    if (medicine.status === 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'Medicine is already rejected'
      });
    }

    await medicine.update({
      status: 'rejected',
      rejected_at: new Date(),
      rejected_by: req.user.id,
      approval_notes: rejection_reason,
      is_available: false
    });

    const updatedMedicine = await Medicine.findByPk(id, {
      include: [
        {
          model: User,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: User,
          as: 'rejector',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Medicine rejected',
      data: updatedMedicine
    });
  } catch (error) {
    console.error('Reject medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting medicine',
      error: error.message
    });
  }
};

// @desc    Delete medicine (Admin only)
// @route   DELETE /api/medicines/:id
// @access  Private/Admin
exports.deleteMedicine = async (req, res) => {
  try {
    const { id } = req.params;

    const medicine = await Medicine.findByPk(id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    await medicine.destroy();

    res.status(200).json({
      success: true,
      message: 'Medicine deleted successfully'
    });
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting medicine',
      error: error.message
    });
  }
};

// @desc    Get medicine statistics (Admin)
// @route   GET /api/medicines/statistics
// @access  Private/Admin
exports.getMedicineStats = async (req, res) => {
  try {
    const totalMedicines = await Medicine.count();
    const approvedMedicines = await Medicine.count({ where: { status: 'approved' } });
    const pendingMedicines = await Medicine.count({ where: { status: 'pending' } });
    const rejectedMedicines = await Medicine.count({ where: { status: 'rejected' } });
    const lowStockItems = await Medicine.getLowStockItems();
    const outOfStockItems = await Medicine.getOutOfStockItems();

    // Get category distribution
    const categories = await Medicine.findAll({
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: { status: 'approved' },
      group: ['category']
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalMedicines,
        approved: approvedMedicines,
        pending: pendingMedicines,
        rejected: rejectedMedicines,
        low_stock: lowStockItems.length,
        out_of_stock: outOfStockItems.length,
        categories: categories,
        category_count: categories.length
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};

// @desc    Get supplier's medicines summary
// @route   GET /api/medicines/supplier-summary
// @access  Private/Supplier
exports.getSupplierSummary = async (req, res) => {
  try {
    const supplierId = req.user.id;

    const total = await Medicine.count({ where: { supplier_id: supplierId } });
    const approved = await Medicine.count({ 
      where: { 
        supplier_id: supplierId,
        status: 'approved'
      }
    });
    const pending = await Medicine.count({ 
      where: { 
        supplier_id: supplierId,
        status: 'pending'
      }
    });
    const rejected = await Medicine.count({ 
      where: { 
        supplier_id: supplierId,
        status: 'rejected'
      }
    });

    const lowStock = await Medicine.count({
  where: {
    supplier_id: supplierId,
    status: 'approved',
    [Op.and]: sequelize.where(
      sequelize.col('quantity'),
      Op.lte,
      sequelize.col('min_quantity_alert')
    )
  }
});

    const outOfStock = await Medicine.count({
      where: {
        supplier_id: supplierId,
        status: 'approved',
        quantity: 0
      }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        approved,
        pending,
        rejected,
        low_stock: lowStock,
        out_of_stock: outOfStock,
        approval_rate: total > 0 ? Math.round((approved / total) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Get supplier summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching supplier summary',
      error: error.message
    });
  }
};

// @desc    Get medicines by supplier (Admin only)
// @route   GET /api/medicines/supplier/:supplierId
// @access  Private/Admin
exports.getMedicinesBySupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { status } = req.query;

    const where = { supplier_id: supplierId };
    if (status) where.status = status;

    const medicines = await Medicine.findAll({
      where,
      include: [{
        model: User,
        as: 'supplier',
        attributes: ['id', 'name', 'email', 'phone']
      }],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: medicines.length,
      data: medicines
    });
  } catch (error) {
    console.error('Get medicines by supplier error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching medicines',
      error: error.message
    });
  }
};