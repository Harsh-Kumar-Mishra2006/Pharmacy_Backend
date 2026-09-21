const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supply = sequelize.define('Supply', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },

    medicine_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'medicines', key: 'id' }
    },

    supplier_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },

    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: { min: 0 }
    },

    total_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0 }
    },

    // Supplier notes
    notes: { type: DataTypes.TEXT, allowNull: true },

    // Approval workflow
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'received'),
      allowNull: false,
      defaultValue: 'pending'
    },

    approval_notes: { type: DataTypes.TEXT, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    approved_by: { type: DataTypes.UUID, allowNull: true },
    rejected_at: { type: DataTypes.DATE, allowNull: true },
    rejected_by: { type: DataTypes.UUID, allowNull: true },
    received_at: { type: DataTypes.DATE, allowNull: true },

    expiry_date: { type: DataTypes.DATE, allowNull: true }
  }, {
    hooks: {
      beforeValidate: (supply) => {
        if (supply.quantity && supply.unit_price) {
          supply.total_price = Number(supply.quantity) * Number(supply.unit_price);
        }
      }
    }
  });

  return Supply;
};