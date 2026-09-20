const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Medicine = sequelize.define('Medicine', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // Basic Information
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 200]
      }
    },
    generic_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    brand_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    
    // Medical Details
    medical_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        usage: null,
        dosage: null,
        indications: [],
        contraindications: [],
        side_effects: [],
        precautions: [],
        interactions: [],
        pregnancy_category: null,
        lactation: null,
        pediatric_use: null,
        geriatric_use: null,
        overdosage: null,
        storage: null,
        manufacturer: null,
        country_of_origin: null
      }
    },
    
    // Other Details
    other_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        description: null,
        composition: [],
        form: null, // tablet, capsule, syrup, injection, etc.
        strength: null,
        pack_size: null,
        unit: null,
        shelf_life: null,
        product_code: null,
        barcode: null,
        manufacturer_details: null,
        distributor: null
      }
    },
    
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        tags: [],
        keywords: [],
        is_prescription_required: false,
        is_controlled_substance: false,
        schedule_type: null,
        cold_chain_required: false,
        hazardous: false,
        requires_medical_approval: false,
        rating: null,
        reviews_count: 0
      }
    },
    
    // Quantity & Stock
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    min_quantity_alert: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      validate: {
        min: 0
      }
    },
    max_quantity: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    
    // Pricing (Basic)
    unit_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
      validate: {
        min: 0
      }
    },
    purchase_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0
      }
    },
    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100
      }
    },
    
    // Status
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'inactive'),
      allowNull: false,
      defaultValue: 'pending'
    },
    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    approval_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Images
    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },
    
    // Timestamps for approval
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejected_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Supplier reference
    supplier_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    
    // Tracking
    last_restocked_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    hooks: {
      beforeCreate: (medicine) => {
        // Auto-generate product code if not provided
        if (!medicine.other_details?.product_code) {
          const prefix = medicine.category?.substring(0, 3).toUpperCase() || 'MED';
          const timestamp = Date.now().toString().slice(-6);
          medicine.other_details = {
            ...medicine.other_details,
            product_code: `${prefix}-${timestamp}`
          };
        }
      }
    }
  });

  // Instance Methods
  Medicine.prototype.isLowStock = function() {
    return this.quantity <= this.min_quantity_alert;
  };

  Medicine.prototype.isOutOfStock = function() {
    return this.quantity === 0;
  };

  Medicine.prototype.canBePurchased = function(quantity) {
    return this.is_available && this.quantity >= quantity && this.status === 'approved';
  };

  // Static Methods
  Medicine.findByCategory = async function(category) {
    return await this.findAll({ 
      where: { 
        category,
        status: 'approved'
      } 
    });
  };

  Medicine.findBySupplier = async function(supplierId) {
    return await this.findAll({ 
      where: { 
        supplier_id: supplierId 
      } 
    });
  };

  // backend/models/Medicine.js
Medicine.getLowStockItems = async function() {
  const { Op } = require('sequelize');
  const sequelize = this.sequelize;
  return await this.findAll({
    where: {
      status: 'approved',
      [Op.and]: sequelize.where(
        sequelize.col('quantity'),
        Op.lte,
        sequelize.col('min_quantity_alert')
      )
    }
  });
};

  Medicine.getOutOfStockItems = async function() {
    return await this.findAll({
      where: {
        status: 'approved',
        quantity: 0
      }
    });
  };

  Medicine.search = async function(searchTerm) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        status: 'approved',
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { generic_name: { [Op.iLike]: `%${searchTerm}%` } },
          { brand_name: { [Op.iLike]: `%${searchTerm}%` } },
          { category: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      }
    });
  };

  return Medicine;
};