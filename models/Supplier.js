// models/Supplier.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Supplier = sequelize.define(
    'Supplier',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      // Link to the User row (role = 'supplier')
      user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
      },

      // Business details
      company_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: true, len: [2, 200] },
      },
      contact_person: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gst_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      license_number: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      // Address & contact
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      city: { type: DataTypes.STRING, allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },
      pincode: { type: DataTypes.STRING, allowNull: true },
      country: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'India',
      },

      // Extra
      website: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },

      // Who created this supplier record (the admin)
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
      },

      // Soft state
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      tableName: 'suppliers',
      underscored: true,
    },
  );

  return Supplier;
};