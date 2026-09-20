const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Purchase = sequelize.define('Purchase', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    // Purchase Reference
    purchase_number: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },

    // Customer Details
    customer_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true, len: [2, 100] }
    },
    customer_email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    customer_phone: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { is: /^[0-9]{10}$/ }
    },
    customer_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },

    // Medical Information
    disease: { type: DataTypes.STRING, allowNull: true },
    symptoms: { type: DataTypes.TEXT, allowNull: true },
    prescription_required: { type: DataTypes.BOOLEAN, defaultValue: false },
    prescription_file: { type: DataTypes.STRING, allowNull: true },
    prescription_notes: { type: DataTypes.TEXT, allowNull: true },

    // Medicine Details
    medicine_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'medicines', key: 'id' }
    },
    medicine_name: { type: DataTypes.STRING, allowNull: false },
    medicine_price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },
    total_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 }
    },

    // Payment Details
    payment_method: {
      type: DataTypes.ENUM('qr_code', 'cash', 'card', 'online'),
      defaultValue: 'qr_code'
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'verified', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    payment_screenshot: { type: DataTypes.STRING, allowNull: true },
    payment_verified_at: { type: DataTypes.DATE, allowNull: true },
    payment_verified_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    payment_verification_notes: { type: DataTypes.TEXT, allowNull: true },
    transaction_id: { type: DataTypes.STRING, allowNull: true },

    // Purchase Status
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
      defaultValue: 'pending'
    },

    // User
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },

    // Tracking
    purchased_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    confirmed_at: { type: DataTypes.DATE, allowNull: true },
    shipped_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancellation_reason: { type: DataTypes.TEXT, allowNull: true },

    // Notes
    notes: { type: DataTypes.TEXT, allowNull: true },
    delivery_instructions: { type: DataTypes.TEXT, allowNull: true }
  });

  // ✅ HOOK REGISTERED OUTSIDE define() — runs BEFORE validation
  Purchase.beforeValidate((purchase) => {
    if (!purchase.purchase_number) {
      const date = new Date();
      const year = date.getFullYear().toString().slice(-2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      purchase.purchase_number = `PH-${year}${month}${day}-${random}`;
    }
  });

  // Instance Methods
  Purchase.prototype.isPendingPayment = function () {
    return this.payment_status === 'pending';
  };

  Purchase.prototype.isPaid = function () {
    return this.payment_status === 'paid' || this.payment_status === 'verified';
  };

  Purchase.prototype.canBeCancelled = function () {
    return ['pending', 'confirmed'].includes(this.status);
  };

  // Static Methods
  Purchase.getByUser = async function (userId) {
    return await this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
  };

  Purchase.getByStatus = async function (status) {
    return await this.findAll({
      where: { status },
      order: [['created_at', 'DESC']]
    });
  };

  Purchase.getPendingVerification = async function () {
    return await this.findAll({
      where: { payment_status: 'paid', status: 'confirmed' },
      order: [['created_at', 'ASC']]
    });
  };

  return Purchase;
};