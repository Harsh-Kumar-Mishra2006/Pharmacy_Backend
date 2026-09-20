//index.js
const { sequelize } = require('../config/database');
const User = require('./user')(sequelize);
const Medicine = require('./medicine')(sequelize);
const Purchase = require('./Purchase')(sequelize);
const Payment = require('./Payment')(sequelize);

// User Associations
User.hasMany(Medicine, {
  foreignKey: 'supplier_id',
  as: 'medicines'
});
Medicine.belongsTo(User, {
  foreignKey: 'supplier_id',
  as: 'supplier'
});

// Medicine -> Purchase
Medicine.hasMany(Purchase, {
  foreignKey: 'medicine_id',
  as: 'purchases'
});
Purchase.belongsTo(Medicine, {
  foreignKey: 'medicine_id',
  as: 'medicine'
});

// User -> Purchase
User.hasMany(Purchase, {
  foreignKey: 'user_id',
  as: 'purchases'
});
Purchase.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'customer'
});

// Purchase -> Payment
Purchase.hasOne(Payment, {
  foreignKey: 'purchase_id',
  as: 'payment'
});
Payment.belongsTo(Purchase, {
  foreignKey: 'purchase_id',
  as: 'purchase'
});

// User -> Payment
User.hasMany(Payment, {
  foreignKey: 'user_id',
  as: 'payments'
});
Payment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// Admin verification
User.hasMany(Purchase, {
  foreignKey: 'payment_verified_by',
  as: 'verified_purchases'
});
Purchase.belongsTo(User, {
  foreignKey: 'payment_verified_by',
  as: 'verifier'
});

// Medicine self references for approval (already in Medicine model)
Medicine.belongsTo(User, {
  foreignKey: 'approved_by',
  as: 'approver'
});
Medicine.belongsTo(User, {
  foreignKey: 'rejected_by',
  as: 'rejector'
});

const db = {
  sequelize,
  User,
  Medicine,
  Purchase,
  Payment
};

module.exports = db;