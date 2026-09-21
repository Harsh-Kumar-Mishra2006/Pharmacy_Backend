const { Enquiry, Medicine, Supply, User, sequelize } = require('../models');
const { Op } = require('sequelize');

// @desc    Admin creates an enquiry to a supplier for a medicine
// @route   POST /api/enquiries
// @access  Private/Admin
exports.createEnquiry = async (req, res) => {
  try {
    const {
      medicine_id,
      supplier_id,
      requested_quantity,
      target_unit_price,
      message
    } = req.body;

    if (!medicine_id || !supplier_id || !requested_quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide medicine_id, supplier_id and requested_quantity'
      });
    }

    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found in catalog' });
    }

    const supplier = await User.findByPk(supplier_id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: 'Supplier not found' });
    }
    if (supplier.role !== 'supplier') {
      return res.status(400).json({ success: false, message: 'Selected user is not a supplier' });
    }
    if (!supplier.is_active) {
      return res.status(400).json({ success: false, message: 'Supplier is inactive' });
    }

    // Prevent duplicate pending enquiry for same medicine+supplier
    const existing = await Enquiry.findOne({
      where: { medicine_id, supplier_id, status: 'pending' }
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A pending enquiry already exists for this medicine and supplier'
      });
    }

    const enquiry = await Enquiry.create({
      medicine_id,
      supplier_id,
      requested_by: req.user.id,
      requested_quantity,
      target_unit_price: target_unit_price ?? null,
      message: message || null,
      status: 'pending'
    });

    const result = await Enquiry.findByPk(enquiry.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Enquiry sent to supplier',
      data: result
    });
  } catch (error) {
    console.error('Create enquiry error:', error);
    res.status(500).json({ success: false, message: 'Error creating enquiry', error: error.message });
  }
};

// @desc    List enquiries (role-filtered)
// @route   GET /api/enquiries
// @access  Private
exports.getEnquiries = async (req, res) => {
  try {
    const { status, medicine_id, supplier_id, page = 1, limit = 20 } = req.query;
    const where = {};

    if (req.user.role === 'supplier') {
      where.supplier_id = req.user.id;
    } else if (req.user.role === 'admin') {
      if (supplier_id) where.supplier_id = supplier_id;
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (status) where.status = status;
    if (medicine_id) where.medicine_id = medicine_id;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Enquiry.findAndCountAll({
      where,
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] }
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
    console.error('Get enquiries error:', error);
    res.status(500).json({ success: false, message: 'Error fetching enquiries', error: error.message });
  }
};

// @desc    Get single enquiry
// @route   GET /api/enquiries/:id
// @access  Private
exports.getEnquiryById = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByPk(req.params.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'requester', attributes: ['id', 'name', 'email'] },
        { model: Supply, as: 'supply' }
      ]
    });

    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (req.user.role === 'supplier' && enquiry.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: enquiry });
  } catch (error) {
    console.error('Get enquiry error:', error);
    res.status(500).json({ success: false, message: 'Error fetching enquiry', error: error.message });
  }
};

// @desc    Supplier accepts enquiry → creates a Supply linked to it
// @route   PUT /api/enquiries/:id/accept
// @access  Private/Supplier
exports.acceptEnquiry = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { unit_price, notes, expiry_date, response_message } = req.body;

    if (unit_price === undefined || unit_price === null) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Please provide unit_price' });
    }

    const enquiry = await Enquiry.findByPk(req.params.id, { transaction: t });
    if (!enquiry) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (enquiry.supplier_id !== req.user.id) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (enquiry.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Enquiry is already ${enquiry.status}`
      });
    }

    // Create Supply linked to this enquiry
    const supply = await Supply.create({
      medicine_id: enquiry.medicine_id,
      supplier_id: enquiry.supplier_id,
      quantity: enquiry.requested_quantity,
      unit_price,
      notes: notes || null,
      expiry_date: expiry_date || null,
      status: 'pending'
    }, { transaction: t });

    await enquiry.update({
      status: 'accepted',
      supply_id: supply.id,
      response_message: response_message || null,
      responded_at: new Date()
    }, { transaction: t });

    await t.commit();

    const result = await Enquiry.findByPk(enquiry.id, {
      include: [
        { model: Medicine, as: 'medicine' },
        { model: User, as: 'supplier', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Supply, as: 'supply' }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Enquiry accepted, supply submitted for admin approval',
      data: result
    });
  } catch (error) {
    await t.rollback();
    console.error('Accept enquiry error:', error);
    res.status(500).json({ success: false, message: 'Error accepting enquiry', error: error.message });
  }
};

// @desc    Supplier rejects enquiry
// @route   PUT /api/enquiries/:id/reject
// @access  Private/Supplier
exports.rejectEnquiry = async (req, res) => {
  try {
    const { response_message } = req.body;
    if (!response_message) {
      return res.status(400).json({ success: false, message: 'Please provide a reason' });
    }

    const enquiry = await Enquiry.findByPk(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (enquiry.supplier_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (enquiry.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Enquiry is already ${enquiry.status}` });
    }

    await enquiry.update({
      status: 'rejected',
      response_message,
      responded_at: new Date()
    });

    res.status(200).json({ success: true, message: 'Enquiry rejected', data: enquiry });
  } catch (error) {
    console.error('Reject enquiry error:', error);
    res.status(500).json({ success: false, message: 'Error rejecting enquiry', error: error.message });
  }
};

// @desc    Admin cancels pending enquiry
// @route   PUT /api/enquiries/:id/cancel
// @access  Private/Admin
exports.cancelEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findByPk(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found' });
    }

    if (enquiry.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel enquiry with status ${enquiry.status}`
      });
    }

    await enquiry.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancelled_by: req.user.id
    });

    res.status(200).json({ success: true, message: 'Enquiry cancelled', data: enquiry });
  } catch (error) {
    console.error('Cancel enquiry error:', error);
    res.status(500).json({ success: false, message: 'Error cancelling enquiry', error: error.message });
  }
};

// @desc    Admin enquiry statistics
// @route   GET /api/enquiries/statistics
// @access  Private/Admin
exports.getEnquiryStats = async (req, res) => {
  try {
    const total = await Enquiry.count();
    const pending = await Enquiry.count({ where: { status: 'pending' } });
    const accepted = await Enquiry.count({ where: { status: 'accepted' } });
    const rejected = await Enquiry.count({ where: { status: 'rejected' } });
    const cancelled = await Enquiry.count({ where: { status: 'cancelled' } });

    res.status(200).json({
      success: true,
      data: { total, pending, accepted, rejected, cancelled }
    });
  } catch (error) {
    console.error('Enquiry stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching stats', error: error.message });
  }
};

// @desc    Supplier enquiry summary (dashboard)
// @route   GET /api/enquiries/supplier-summary
// @access  Private/Supplier
exports.getSupplierEnquirySummary = async (req, res) => {
  try {
    const supplierId = req.user.id;

    const total = await Enquiry.count({ where: { supplier_id: supplierId } });
    const pending = await Enquiry.count({ where: { supplier_id: supplierId, status: 'pending' } });
    const accepted = await Enquiry.count({ where: { supplier_id: supplierId, status: 'accepted' } });
    const rejected = await Enquiry.count({ where: { supplier_id: supplierId, status: 'rejected' } });

    res.status(200).json({
      success: true,
      data: { total, pending, accepted, rejected }
    });
  } catch (error) {
    console.error('Supplier enquiry summary error:', error);
    res.status(500).json({ success: false, message: 'Error fetching summary', error: error.message });
  }
};