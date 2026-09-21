const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Enquiry = sequelize.define('Enquiry', {
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

    requested_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },

    requested_quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 }
    },

    // Admin's target price (optional negotiation hint)
    target_unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: { min: 0 }
    },

    // Admin's message to supplier
    message: { type: DataTypes.TEXT, allowNull: true },

    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'cancelled', 'fulfilled'),
      allowNull: false,
      defaultValue: 'pending'
    },

    // Response fields
    response_message: { type: DataTypes.TEXT, allowNull: true },
    responded_at: { type: DataTypes.DATE, allowNull: true },

    // Link to created Supply when accepted
    supply_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'supplies', key: 'id' }
    },

    // Cancellation
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_by: { type: DataTypes.UUID, allowNull: true }
  });

  Enquiry.findPendingBySupplier = async function (supplierId) {
    return await this.findAll({
      where: { supplier_id: supplierId, status: 'pending' },
      order: [['created_at', 'DESC']]
    });
  };

  return Enquiry;
};