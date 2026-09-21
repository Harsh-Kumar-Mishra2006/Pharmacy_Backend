const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Medicine = sequelize.define('Medicine', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true, len: [2, 200] }
    },
    generic_name: { type: DataTypes.STRING, allowNull: true },
    brand_name: { type: DataTypes.STRING, allowNull: true },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true }
    },

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

    other_details: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        description: null,
        composition: [],
        form: null,
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

    images: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: true,
      defaultValue: []
    },

    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },

    // Admin who created this medicine
    created_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    }
  }, {
    hooks: {
      beforeCreate: (medicine) => {
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

  // Static helpers
  Medicine.findByCategory = async function (category) {
    return await this.findAll({ where: { category, is_available: true } });
  };

  Medicine.search = async function (searchTerm) {
    const { Op } = require('sequelize');
    return await this.findAll({
      where: {
        is_available: true,
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