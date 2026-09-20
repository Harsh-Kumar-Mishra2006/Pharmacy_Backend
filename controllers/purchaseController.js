const { Purchase, Medicine, Payment, User } = require('../models');
const { Op } = require('sequelize');

// @desc    Create new purchase
// @route   POST /api/purchases
// @access  Public (with optional user login)
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
      notes
    } = req.body;

    // Validate required fields
    if (!medicine_id || !quantity || !customer_name || !customer_email || 
        !customer_phone || !customer_address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Get medicine details
    const medicine = await Medicine.findByPk(medicine_id);
    if (!medicine) {
      return res.status(404).json({
        success: false,
        message: 'Medicine not found'
      });
    }

    // Check availability
    if (medicine.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'This medicine is not available for purchase'
      });
    }

    if (medicine.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Only ${medicine.quantity} units available`,
        available_quantity: medicine.quantity
      });
    }

    // Calculate total
    const total_amount = medicine.unit_price * quantity;

    // Create purchase
    const purchase = await Purchase.create({
      medicine_id,
      medicine_name: medicine.name,
      medicine_price: medicine.unit_price,
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
      payment_status: 'pending'
    });

    // Create payment record
    const payment = await Payment.create({
      purchase_id: purchase.id,
      amount: total_amount,
      payment_method: 'qr_code',
      status: 'pending',
      user_id: req.user ? req.user.id : null,
      qr_code_data: {
        upi_id: process.env.UPI_ID || 'pharmacy@upi',
        merchant_name: process.env.MERCHANT_NAME || 'Pharmacy Store',
        amount: total_amount,
        reference: purchase.purchase_number
      }
    });

    // Get complete purchase details
    const completePurchase = await Purchase.findByPk(purchase.id, {
      include: [
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'category', 'unit_price', 'quantity']
        },
        {
          model: Payment,
          as: 'payment'
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Purchase created successfully. Please complete the payment.',
      data: completePurchase,
      payment_qr: {
        upi_id: process.env.UPI_ID || 'pharmacy@upi',
        amount: total_amount,
        reference: purchase.purchase_number
      }
    });
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating purchase',
      error: error.message
    });
  }
};

// @desc    Upload payment screenshot
// @route   POST /api/purchases/:id/upload-screenshot
// @access  Public
exports.uploadPaymentScreenshot = async (req, res) => {
  try {
    const { id } = req.params;
    const { screenshot_url, transaction_id } = req.body;

    if (!screenshot_url) {
      return res.status(400).json({
        success: false,
        message: 'Please provide screenshot URL'
      });
    }

    const purchase = await Purchase.findByPk(id, {
      include: [
        {
          model: Payment,
          as: 'payment'
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    if (purchase.payment_status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified'
      });
    }

    // Update payment
    await purchase.payment.update({
      screenshot_url,
      screenshot_uploaded_at: new Date(),
      status: 'paid',
      transaction_id: transaction_id || null,
      payment_date: new Date()
    });

    // Update purchase
    await purchase.update({
      payment_status: 'paid',
      status: 'confirmed'
    });

    const updatedPurchase = await Purchase.findByPk(id, {
      include: [
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'quantity']
        },
        {
          model: Payment,
          as: 'payment'
        }
      ]
    });

    res.status(200).json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Waiting for admin verification.',
      data: updatedPurchase
    });
  } catch (error) {
    console.error('Upload screenshot error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading screenshot',
      error: error.message
    });
  }
};

// @desc    Verify payment (Admin)
// @route   PUT /api/purchases/:id/verify-payment
// @access  Private/Admin
exports.verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_notes } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [
        {
          model: Medicine,
          as: 'medicine'
        },
        {
          model: Payment,
          as: 'payment'
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    if (purchase.payment_status === 'verified') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified'
      });
    }

    if (purchase.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment not yet submitted for verification'
      });
    }

    // Start transaction to update medicine quantity
    const transaction = await sequelize.transaction();

    try {
      // Update purchase
      await purchase.update({
        payment_status: 'verified',
        status: 'processing',
        payment_verified_at: new Date(),
        payment_verified_by: req.user.id,
        payment_verification_notes: verification_notes || 'Payment verified'
      }, { transaction });

      // Update payment
      await purchase.payment.update({
        status: 'verified',
        verified_at: new Date(),
        verified_by: req.user.id,
        verification_notes: verification_notes || 'Payment verified'
      }, { transaction });

      // Deduct medicine quantity
      const medicine = await Medicine.findByPk(purchase.medicine_id, { transaction });
      if (medicine) {
        const newQuantity = medicine.quantity - purchase.quantity;
        await medicine.update({
          quantity: newQuantity,
          is_available: newQuantity > 0
        }, { transaction });
      }

      await transaction.commit();

      const verifiedPurchase = await Purchase.findByPk(id, {
        include: [
          {
            model: Medicine,
            as: 'medicine',
            attributes: ['id', 'name', 'quantity']
          },
          {
            model: Payment,
            as: 'payment'
          },
          {
            model: User,
            as: 'verifier',
            attributes: ['id', 'name', 'email']
          }
        ]
      });

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully. Medicine quantity updated.',
        data: verifiedPurchase
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment',
      error: error.message
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
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'category', 'unit_price']
        },
        {
          model: Payment,
          as: 'payment'
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases
    });
  } catch (error) {
    console.error('Get my purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: error.message
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
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'category', 'unit_price', 'quantity']
        },
        {
          model: Payment,
          as: 'payment'
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: User,
          as: 'verifier',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    res.status(200).json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchase',
      error: error.message
    });
  }
};

// @desc    Get all purchases (Admin)
// @route   GET /api/purchases
// @access  Private/Admin
exports.getAllPurchases = async (req, res) => {
  try {
    const { 
      status, 
      payment_status,
      start_date,
      end_date,
      page = 1,
      limit = 20
    } = req.query;

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
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'category']
        },
        {
          model: Payment,
          as: 'payment'
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email']
        }
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
    console.error('Get all purchases error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching purchases',
      error: error.message
    });
  }
};

// @desc    Get pending payment verifications (Admin)
// @route   GET /api/purchases/pending-verifications
// @access  Private/Admin
exports.getPendingVerifications = async (req, res) => {
  try {
    const purchases = await Purchase.findAll({
      where: {
        payment_status: 'paid',
        status: 'confirmed'
      },
      include: [
        {
          model: Medicine,
          as: 'medicine',
          attributes: ['id', 'name', 'category']
        },
        {
          model: Payment,
          as: 'payment'
        },
        {
          model: User,
          as: 'customer',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases
    });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending verifications',
      error: error.message
    });
  }
};

// @desc    Cancel purchase
// @route   PUT /api/purchases/:id/cancel
// @access  Private (User/Admin)
exports.cancelPurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const purchase = await Purchase.findByPk(id, {
      include: [
        {
          model: Payment,
          as: 'payment'
        }
      ]
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        message: 'Purchase not found'
      });
    }

    // Check if can be cancelled
    if (!purchase.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'This purchase cannot be cancelled at this stage'
      });
    }

    // If payment was verified, restore medicine quantity
    if (purchase.payment_status === 'verified') {
      const medicine = await Medicine.findByPk(purchase.medicine_id);
      if (medicine) {
        await medicine.update({
          quantity: medicine.quantity + purchase.quantity,
          is_available: true
        });
      }
    }

    await purchase.update({
      status: 'cancelled',
      cancelled_at: new Date(),
      cancellation_reason: cancellation_reason || 'Cancelled by user'
    });

    await purchase.payment.update({
      status: 'refunded'
    });

    res.status(200).json({
      success: true,
      message: 'Purchase cancelled successfully',
      data: purchase
    });
  } catch (error) {
    console.error('Cancel purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling purchase',
      error: error.message
    });
  }
};

// @desc    Get purchase statistics (Admin)
// @route   GET /api/purchases/statistics
// @access  Private/Admin
exports.getPurchaseStats = async (req, res) => {
  try {
    const totalPurchases = await Purchase.count();
    const pendingPayments = await Purchase.count({
      where: { payment_status: 'pending' }
    });
    const paidPayments = await Purchase.count({
      where: { payment_status: 'paid' }
    });
    const verifiedPayments = await Purchase.count({
      where: { payment_status: 'verified' }
    });
    
    const pendingVerification = await Purchase.count({
      where: {
        payment_status: 'paid',
        status: 'confirmed'
      }
    });

    // Total revenue
    const revenueResult = await Purchase.findAll({
      attributes: [
        [sequelize.fn('SUM', sequelize.col('total_amount')), 'total_revenue']
      ],
      where: {
        payment_status: 'verified'
      }
    });
    const totalRevenue = revenueResult[0].dataValues.total_revenue || 0;

    // Today's purchases
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayPurchases = await Purchase.count({
      where: {
        purchased_at: {
          [Op.gte]: today
        }
      }
    });

    // Monthly purchases
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyPurchases = await Purchase.count({
      where: {
        purchased_at: {
          [Op.gte]: startOfMonth
        }
      }
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
        monthly_purchases: monthlyPurchases
      }
    });
  } catch (error) {
    console.error('Get purchase stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
      error: error.message
    });
  }
};