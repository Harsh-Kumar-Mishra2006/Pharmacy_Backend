const { Supply, Medicine, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// @desc   Supplier adds a supply for an existing medicine
// @route  POST /api/supplies
// @access Private/Supplier
exports.addSupply = async (req, res) => {
  try {
    const { medicine_id, quantity, unit_price, notes, expiry_date } = req.body;

    if (!medicine_id || quantity === undefined || unit_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide medicine_id, quantity and unit_price'
      });
    }

    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found in catalog' });
    }

    const supply = await Supply.create({
      medicine_id,
      supplier_id: req.user.id,
      quantity,
      unit_price,
      notes: notes || null,
      expiry_date: expiry_date || null,
      status: 'pending'
    });

    const result = await Supply.findByPk(supply.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Supply submitted successfully, pending admin approval',
      data: result
    });
  } catch (error) {
    console.error('Add supply error:', error);
    res.status(500).json({ success: false, message: 'Error adding supply', error: error.message });
  }
};

// @desc   List supplies (filtered by role)
// @route  GET /api/supplies
// @access Private
exports.getSupplies = async (req, res) => {
  try {
    const { status, medicine_id, supplier_id, page = 1, limit = 20 } = req.query;
    const where = {};

    if (req.user.role === 'supplier') {
      where.supplier_id = req.user.id;
    } else if (req.user.role === 'admin') {
      if (supplier_id) where.supplier_id = supplier_id;
    }

    if (status) where.status = status;
    if (medicine_id) where.medicine_id = medicine_id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Supply.findAndCountAll({
      where,
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] }
      ],
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
    console.error('Get supplies error:', error);
    res.status(500).json({ success: false, message: 'Error fetching supplies', error: error.message });
  }
};

// @desc   Get single supply
// @route  GET /api/supplies/:id
// @access Private
exports.getSupplyById = async (req, res) => {
  try {
    const supply = await Supply.findByPk(req.params.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone', 'address'] }
      ]
    });

    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    if (req.user.role === 'supplier' && supply.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: supply });
  } catch (error) {
    console.error('Get supply error:', error);
    res.status(500).json({ success: false, message: 'Error fetching supply', error: error.message });
  }
};

// @desc   Supplier updates own supply (only if pending)
// @route  PUT /api/supplies/:id
// @access Private/Supplier
exports.updateSupply = async (req, res) => {
  try {
    const supply = await Supply.findByPk(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    if (supply.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (supply.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only pending supplies can be updated' });
    }

    const { quantity, unit_price, notes, expiry_date } = req.body;
    await supply.update({
      quantity: quantity ?? supply.quantity,
      unit_price: unit_price ?? supply.unit_price,
      notes: notes ?? supply.notes,
      expiry_date: expiry_date ?? supply.expiry_date
    });

    const updated = await Supply.findByPk(supply.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    res.status(200).json({ success: true, message: 'Supply updated successfully', data: updated });
  } catch (error) {
    console.error('Update supply error:', error);
    res.status(500).json({ success: false, message: 'Error updating supply', error: error.message });
  }
};

// @desc   Supplier deletes own pending supply
// @route  DELETE /api/supplies/:id
// @access Private/Supplier
exports.deleteSupply = async (req, res) => {
  try {
    const supply = await Supply.findByPk(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    if (supply.supplier_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (supply.status !== 'pending' && req.user.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Only pending supplies can be deleted' });
    }

    await supply.destroy();
    res.status(200).json({ success: true, message: 'Supply deleted successfully' });
  } catch (error) {
    console.error('Delete supply error:', error);
    res.status(500).json({ success: false, message: 'Error deleting supply', error: error.message });
  }
};

// @desc   Admin approves supply
// @route  PUT /api/supplies/:id/approve
// @access Private/Admin
exports.approveSupply = async (req, res) => {
  try {
    const supply = await Supply.findByPk(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    if (supply.status === 'approved' || supply.status === 'received') {
      return res.status(400).json({ success: false, message: 'Supply already approved/received' });
    }

    await supply.update({
      status: 'approved',
      approved_at: new Date(),
      approved_by: req.user.id,
      approval_notes: req.body.approval_notes || 'Approved by admin'
    });

    const updated = await Supply.findByPk(supply.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'approver', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(200).json({ success: true, message: 'Supply approved successfully', data: updated });
  } catch (error) {
    console.error('Approve supply error:', error);
    res.status(500).json({ success: false, message: 'Error approving supply', error: error.message });
  }
};

// @desc   Admin rejects supply
// @route  PUT /api/supplies/:id/reject
// @access Private/Admin
exports.rejectSupply = async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    if (!rejection_reason) {
      return res.status(400).json({ success: false, message: 'Please provide rejection reason' });
    }

    const supply = await Supply.findByPk(req.params.id);
    if (!supply) {
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    await supply.update({
      status: 'rejected',
      rejected_at: new Date(),
      rejected_by: req.user.id,
      approval_notes: rejection_reason
    });

    const updated = await Supply.findByPk(supply.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'rejector', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(200).json({ success: true, message: 'Supply rejected', data: updated });
  } catch (error) {
    console.error('Reject supply error:', error);
    res.status(500).json({ success: false, message: 'Error rejecting supply', error: error.message });
  }
};

// @desc   Admin marks supply as received (stock added to medicine)
// @route  PUT /api/supplies/:id/receive
// @access Private/Admin
exports.receiveSupply = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const supply = await Supply.findByPk(req.params.id, { transaction: t });
    if (!supply) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Supply not found' });
    }

    if (supply.status !== 'approved') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Only approved supplies can be received' });
    }

    await supply.update({
      status: 'received',
      received_at: new Date()
    }, { transaction: t });

    // If you want a medicine stock field, you can increment here:
    // await Medicine.increment('quantity', { by: supply.quantity, where: { id: supply.medicine_id }, transaction: t });

    await t.commit();

    const updated = await Supply.findByPk(supply.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] }
      ]
    });

    res.status(200).json({ success: true, message: 'Supply received', data: updated });
  } catch (error) {
    await t.rollback();
    console.error('Receive supply error:', error);
    res.status(500).json({ success: false, message: 'Error receiving supply', error: error.message });
  }
};

// @desc   Supplier summary
// @route  GET /api/supplies/supplier-summary
// @access Private/Supplier
exports.getSupplierSummary = async (req, res) => {
  try {
    const supplierId = req.user.id;

    const total = await Supply.count({ where: { supplier_id: supplierId } });
    const pending = await Supply.count({ where: { supplier_id: supplierId, status: 'pending' } });
    const approved = await Supply.count({ where: { supplier_id: supplierId, status: 'approved' } });
    const received = await Supply.count({ where: { supplier_id: supplierId, status: 'received' } });
    const rejected = await Supply.count({ where: { supplier_id: supplierId, status: 'rejected' } });

    res.status(200).json({
      success: true,
      data: { total, pending, approved, received, rejected }
    });
  } catch (error) {
    console.error('Get supplier summary error:', error);
    res.status(500).json({ success: false, message: 'Error fetching supplier summary', error: error.message });
  }
};

// @desc   Admin: get supplies for a specific supplier
// @route  GET /api/supplies/supplier/:supplierId
// @access Private/Admin
exports.getSuppliesBySupplier = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { status } = req.query;

    const where = { supplier_id: supplierId };
    if (status) where.status = status;

    const supplies = await Supply.findAll({
      where,
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ success: true, count: supplies.length, data: supplies });
  } catch (error) {
    console.error('Get supplies by supplier error:', error);
    res.status(500).json({ success: false, message: 'Error fetching supplies', error: error.message });
  }
};

// @desc   Admin supply stats
// @route  GET /api/supplies/statistics
// @access Private/Admin
exports.getSupplyStats = async (req, res) => {
  try {
    const total = await Supply.count();
    const pending = await Supply.count({ where: { status: 'pending' } });
    const approved = await Supply.count({ where: { status: 'approved' } });
    const received = await Supply.count({ where: { status: 'received' } });
    const rejected = await Supply.count({ where: { status: 'rejected' } });

    const totalValue = await Supply.sum('total_price', { where: { status: ['approved', 'received'] } });

    res.status(200).json({
      success: true,
      data: {
        total, pending, approved, received, rejected,
        total_value: totalValue || 0
      }
    });
  } catch (error) {
    console.error('Get supply stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
};