// controllers/purchaseController.js
const { Purchase, Medicine, Payment, User, Supply, sequelize } = require('../models');
const { Op } = require('sequelize');
const { uploadToCloudinary } = require('../config/uploadToCloudinary');

// ------------------------------------------------------------------
// Helper: get available stock + cheapest price for a medicine
// ------------------------------------------------------------------
async function getStockAndPrice(medicineId, transaction) {
  const supplies = await Supply.findAll({
    where: {
      medicine_id: medicineId,
      status: { [Op.in]: ['approved', 'received'] },
    },
    order: [['created_at', 'ASC']],
    transaction,
  });

  const totalQty = supplies.reduce((s, x) => s + Number(x.quantity || 0), 0);
  const minPrice = supplies.length
    ? Math.min(...supplies.map((x) => Number(x.unit_price)))
    : null;

  return { supplies, totalQty, minPrice };
}

// @desc    Create new purchase
// @route   POST /api/purchases
// @access  Public
exports.createPurchase = async (req, res) => {
  try {
    const {
      medicine_id,
      quantity,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      disease,
      symptoms,
      prescription_required,
      prescription_file,
      prescription_notes,
      delivery_instructions,
      notes,
    } = req.body;

    if (!medicine_id || !quantity || !customer_name || !customer_email ||
        !customer_phone || !customer_address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Stock + price come from approved/received supplies
    const { totalQty, minPrice } = await getStockAndPrice(medicine_id);

    if (totalQty <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This medicine is not available for purchase',
      });
    }

    if (totalQty < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${totalQty} units available`,
        available_quantity: totalQty,
      });
    }

    const unitPrice = minPrice;
    const total_amount = unitPrice * quantity;

    const purchase = await Purchase.create({
      medicine_id,
      medicine_name: medicine.name,
      medicine_price: unitPrice,
      quantity,
      total_amount,
      customer_name,
      customer_email,
      customer_phone,
      customer_address,
      disease,
      symptoms,
      prescription_required: prescription_required || false,
      prescription_file: prescription_file || null,
      prescription_notes: prescription_notes || null,
      delivery_instructions: delivery_instructions || null,
      notes: notes || null,
      user_id: req.user ? req.user.id : null,
      status: 'pending',
      payment_status: 'pending',
    });

    await Payment.create({
      purchase_id: purchase.id,
      amount: total_amount,
      payment_method: 'qr_code',
      status: 'pending',
      user_id: req.user ? req.user.id : null,
      qr_code_data: {
        upi_id: process.env.UPI_ID || 'pharmacy@upi',
        merchant_name: process.env.MERCHANT_NAME || 'Pharmacy Store',
        amount: total_amount,
        reference: purchase.purchase_number,
      },
    });

    const completePurchase = await Purchase.findByPk(purchase.id, {
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'category'] },
        { model: Payment, as: 'payment' },
      ],
    });

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully. Please complete the payment.',
      data: completePurchase,
      payment_qr: {
        upi_id: process.env.UPI_ID || 'pharmacy@upi',
        amount: total_amount,
        reference: purchase.purchase_number,
      },
    });
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase',
      error: error.message,
    });
  }
};

// controllers/purchaseController.js

exports.uploadPaymentScreenshot = async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id } = req.body || {};

    // 🔍 DEBUG — remove once uploads are working
    console.log('🔍 [upload-screenshot] incoming request', {
      purchaseId: id,
      method: req.method,
      contentType: req.headers['content-type'],
      hasFile: !!req.file,
      fileInfo: req.file
        ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
          }
        : null,
      bodyKeys: Object.keys(req.body || {}),
      bodyScreenshotUrl: req.body?.screenshot_url
        ? String(req.body.screenshot_url).slice(0, 60) + '…'
        : null,
      transactionId: transaction_id || null,
    });

    let screenshotUrl = req.body?.screenshot_url;

    if (req.file) {
      console.log('🔍 [upload-screenshot] uploading buffer to Cloudinary…');
      const uploaded = await uploadToCloudinary(req.file.buffer, {
        folder: 'pharmacy/payments',
      });
      screenshotUrl = uploaded.secure_url;
      console.log('🔍 [upload-screenshot] Cloudinary upload OK:', screenshotUrl);
    }

    if (!screenshotUrl) {
      console.log('❌ [upload-screenshot] neither file nor screenshot_url present');
      return res.status(400).json({
        success: false,
        message: 'Please provide a screenshot (file field "screenshot" or body field "screenshot_url")',
        // 🔍 DEBUG payload — remove in production
        debug: {
          contentType: req.headers['content-type'],
          hasFile: !!req.file,
          bodyKeys: Object.keys(req.body || {}),
        },
      });
    }

    const purchase = await Purchase.findByPk(id, {
      include: [{ model: Payment, as: 'payment' }],
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    if (purchase.payment_status === 'verified') {
      return res.status(400).json({ success: false, message: 'Payment already verified' });
    }

    await purchase.payment.update({
      screenshot_url: screenshotUrl,
      screenshot_uploaded_at: new Date(),
      status: 'paid',
      transaction_id: transaction_id || null,
      payment_date: new Date(),
    });

    await purchase.update({ payment_status: 'paid', status: 'confirmed' });

    const updatedPurchase = await Purchase.findByPk(id, {
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name'] },
        { model: Payment, as: 'payment' },
      ],
    });

    res.status(200).json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Waiting for admin verification.',
      data: updatedPurchase,
    });
  } catch (error) {
    console.error('❌ Upload screenshot error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading screenshot',
      error: error.message,
    });
  }
};

// @desc    Verify payment (Admin) — deducts from Supply FIFO
// @route   PUT /api/purchases/:id/verify-payment
// @access  Private/Admin
exports.verifyPayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { verification_notes } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name'] },
        { model: Payment, as: 'payment' },
      ],
      transaction: t,
    });

    if (!purchase) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    if (purchase.payment_status === 'verified') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Payment already verified' });
    }

    if (purchase.payment_status !== 'paid') {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Payment not yet submitted for verification',
      });
    }

    await purchase.update({
      payment_status: 'verified',
      status: 'processing',
      payment_verified_at: new Date(),
      payment_verified_by: req.user.id,
      payment_verification_notes: verification_notes || 'Payment verified',
    }, { transaction: t });

    await purchase.payment.update({
      status: 'verified',
      verified_at: new Date(),
      verified_by: req.user.id,
      verification_notes: verification_notes || 'Payment verified',
    }, { transaction: t });

    // ----- Deduct from supplies FIFO -----
    const supplies = await Supply.findAll({
      where: {
        medicine_id: purchase.medicine_id,
        status: { [Op.in]: ['approved', 'received'] },
      },
      order: [['created_at', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let remaining = purchase.quantity;
    for (const s of supplies) {
      if (remaining <= 0) break;
      const avail = Number(s.quantity) || 0;
      if (avail <= 0) continue;
      const deduct = Math.min(avail, remaining);
      await s.update({ quantity: avail - deduct }, { transaction: t });
      remaining -= deduct;
    }

    if (remaining > 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Not enough approved stock to fulfil this purchase',
      });
    }

    await t.commit();

    const verifiedPurchase = await Purchase.findByPk(id, {
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name'] },
        { model: Payment, as: 'payment' },
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
      ],
    });

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully. Stock updated.',
      data: verifiedPurchase,
    });
  } catch (error) {
    await t.rollback();
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message,
    });
  }
};

// @desc    Get user purchases
// @route   GET /api/purchases/my-purchases
// @access  Private
exports.getMyPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.findAll({
      where: { user_id: req.user.id },
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'category'] },
        { model: Payment, as: 'payment' },
      ],
      order: [['created_at', 'DESC']],
    });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    console.error('Get my purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: error.message,
    });
  }
};

// @desc    Get purchase by ID
// @route   GET /api/purchases/:id
// @access  Public
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchase = await Purchase.findByPk(id, {
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'category'] },
        { model: Payment, as: 'payment' },
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
        { model: User, as: 'verifier', attributes: ['id', 'name', 'email'] },
      ],
    });

    if (!purchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase',
      error: error.message,
    });
  }
};

// @desc    Get all purchases (Admin)
// @route   GET /api/purchases/admin/all
// @access  Private/Admin
exports.getAllPurchases = async (req, res) => {
  try {
    const { status, payment_status, start_date, end_date, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (payment_status) where.payment_status = payment_status;

    if (start_date || end_date) {
      where.purchased_at = {};
      if (start_date) where.purchased_at[Op.gte] = new Date(start_date);
      if (end_date) where.purchased_at[Op.lte] = new Date(end_date);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Purchase.findAndCountAll({
      where,
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'category'] },
        { model: Payment, as: 'payment' },
        { model: User, as: 'customer', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get all purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: error.message,
    });
  }
};

// @desc    Get pending payment verifications (Admin)
// @route   GET /api/purchases/admin/pending-verifications
// @access  Private/Admin
exports.getPendingVerifications = async (req, res) => {
  try {
    const purchases = await Purchase.findAll({
      where: { payment_status: 'paid', status: 'confirmed' },
      include: [
        { model: Medicine, as: 'medicine', attributes: ['id', 'name', 'category'] },
        { model: Payment, as: 'payment' },
        { model: User, as: 'customer', attributes: ['id', 'name', 'email', 'phone'] },
      ],
      order: [['created_at', 'ASC']],
    });

    res.status(200).json({ success: true, count: purchases.length, data: purchases });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending verifications',
      error: error.message,
    });
  }
};

// @desc    Cancel purchase
// @route   PUT /api/purchases/:id/cancel
// @access  Private (User/Admin)
exports.cancelPurchase = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [{ model: Payment, as: 'payment' }],
      transaction: t,
    });

    if (!purchase) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }

    if (!purchase.canBeCancelled()) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'This purchase cannot be cancelled at this stage',
      });
    }

    // Restock to the same supply set (FIFO) if payment was verified
    if (purchase.payment_status === 'verified') {
      const supplies = await Supply.findAll({
        where: {
          medicine_id: purchase.medicine_id,
          status: { [Op.in]: ['approved', 'received'] },
        },
        order: [['created_at', 'ASC']],
        transaction: t,
      });

      // Simple restock: add all quantity back to the first supply
      // (best-effort, since we didn't track which supply was consumed)
      if (supplies.length > 0) {
        await supplies[0].update(
          { quantity: Number(supplies[0].quantity) + purchase.quantity },
          { transaction: t }
        );
      }
    }

    await purchase.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: cancellation_reason || 'Cancelled by user',
    }, { transaction: t });

    await purchase.payment.update({ status: 'refunded' }, { transaction: t });

    await t.commit();

    res.status(200).json({
      success: true,
      message: 'Purchase cancelled successfully',
      data: purchase,
    });
  } catch (error) {
    await t.rollback();
    console.error('Cancel purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling purchase',
      error: error.message,
    });
  }
};

// @desc    Get purchase statistics (Admin)
// @route   GET /api/purchases/admin/statistics
// @access  Private/Admin
exports.getPurchaseStats = async (req, res) => {
  try {
    const totalPurchases = await Purchase.count();
    const pendingPayments = await Purchase.count({ where: { payment_status: 'pending' } });
    const paidPayments = await Purchase.count({ where: { payment_status: 'paid' } });
    const verifiedPayments = await Purchase.count({ where: { payment_status: 'verified' } });

    const pendingVerification = await Purchase.count({
      where: { payment_status: 'paid', status: 'confirmed' },
    });

    const revenueResult = await Purchase.findAll({
      attributes: [[sequelize.fn('SUM', sequelize.col('total_amount')), 'total_revenue']],
      where: { payment_status: 'verified' },
    });
    const totalRevenue = Number(revenueResult[0]?.dataValues?.total_revenue || 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPurchases = await Purchase.count({ where: { purchased_at: { [Op.gte]: today } } });

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyPurchases = await Purchase.count({
      where: { purchased_at: { [Op.gte]: startOfMonth } },
    });

    res.status(200).json({
      success: true,
      data: {
        total_purchases: totalPurchases,
        pending_payments: pendingPayments,
        paid_payments: paidPayments,
        verified_payments: verifiedPayments,
        pending_verification: pendingVerification,
        total_revenue: totalRevenue,
        today_purchases: todayPurchases,
        monthly_purchases: monthlyPurchases,
      },
    });
  } catch (error) {
    console.error('Get purchase stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message,
    });
  }
};