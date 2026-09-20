const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    purchase_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'purchases',
        key: 'id'
      }
    },
    
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    
    payment_method: {
      type: DataTypes.ENUM('qr_code', 'cash', 'card', 'online'),
      defaultValue: 'qr_code'
    },
    
    // QR Payment Details
    qr_code_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        upi_id: null,
        merchant_name: null,
        amount: null,
        reference: null
      }
    },
    
    // Payment Status
    status: {
      type: DataTypes.ENUM('pending', 'paid', 'verified', 'failed', 'refunded'),
      defaultValue: 'pending'
    },
    
    // Payment Screenshot
    screenshot_url: {
      type: DataTypes.STRING,
      allowNull: true
    },
    screenshot_uploaded_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // Verification
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    verified_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verification_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Transaction
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true
    },
    payment_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    
    // User who made payment
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  });

  // Instance Methods
  Payment.prototype.isPending = function() {
    return this.status === 'pending';
  };

  Payment.prototype.isVerified = function() {
    return this.status === 'verified';
  };

  // Static Methods
  Payment.getPendingVerifications = async function() {
    return await this.findAll({
      where: { status: 'paid' },
      order: [['created_at', 'ASC']]
    });
  };

  return Payment;
};