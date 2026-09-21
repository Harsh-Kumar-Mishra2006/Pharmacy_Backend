const { sequelize } = require('../config/database');
const User = require('./user')(sequelize);
const Medicine = require('./medicine')(sequelize);
const Supply = require('./supply')(sequelize);
const Purchase = require('./Purchase')(sequelize);
const Payment = require('./Payment')(sequelize);
const Enquiry = require('./Enquiry')(sequelize);

// --- User <-> Medicine (admin creates catalog) ---
User.hasMany(Medicine, { foreignKey: 'created_by', as: 'created_medicines' });
Medicine.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// --- Medicine <-> Supply (suppliers supply medicines) ---
Medicine.hasMany(Supply, { foreignKey: 'medicine_id', as: 'supplies' });
Supply.belongsTo(Medicine, { foreignKey: 'medicine_id', as: 'medicine' });

// --- User (supplier) <-> Supply ---
User.hasMany(Supply, { foreignKey: 'supplier_id', as: 'supplies' });
Supply.belongsTo(User, { foreignKey: 'supplier_id', as: 'supplier' });

// --- Supply approver/rejector ---
Supply.belongsTo(User, { foreignKey: 'approved_by', as: 'approver' });
Supply.belongsTo(User, { foreignKey: 'rejected_by', as: 'rejector' });

// --- Medicine -> Purchase ---
Medicine.hasMany(Purchase, { foreignKey: 'medicine_id', as: 'purchases' });
Purchase.belongsTo(Medicine, { foreignKey: 'medicine_id', as: 'medicine' });

// --- User -> Purchase ---
User.hasMany(Purchase, { foreignKey: 'user_id', as: 'purchases' });
Purchase.belongsTo(User, { foreignKey: 'user_id', as: 'customer' });

// --- Purchase -> Payment ---
Purchase.hasOne(Payment, { foreignKey: 'purchase_id', as: 'payment' });
Payment.belongsTo(Purchase, { foreignKey: 'purchase_id', as: 'purchase' });

// --- User -> Payment ---
User.hasMany(Payment, { foreignKey: 'user_id', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// --- Admin verification of payment ---
User.hasMany(Purchase, { foreignKey: 'payment_verified_by', as: 'verified_purchases' });
Purchase.belongsTo(User, { foreignKey: 'payment_verified_by', as: 'verifier' });

// --- Enquiry associations ---
Enquiry.belongsTo(Medicine, { foreignKey: 'medicine_id', as: 'medicine' });
Medicine.hasMany(Enquiry, { foreignKey: 'medicine_id', as: 'enquiries' });

Enquiry.belongsTo(User, { foreignKey: 'supplier_id', as: 'supplier' });
User.hasMany(Enquiry, { foreignKey: 'supplier_id', as: 'enquiries' });

Enquiry.belongsTo(User, { foreignKey: 'requested_by', as: 'requester' });
Enquiry.belongsTo(User, { foreignKey: 'cancelled_by', as: 'canceller' });

Enquiry.belongsTo(Supply, { foreignKey: 'supply_id', as: 'supply' });
Supply.hasOne(Enquiry, { foreignKey: 'supply_id', as: 'enquiry' });


const db = {
  sequelize,
  User,
  Medicine,
  Supply,
  Enquiry,
  Purchase,
  Payment
};

module.exports = db;