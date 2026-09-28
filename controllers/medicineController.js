// controllers/medicineController.js
const { Medicine, User, Supply, sequelize } = require('../models');
const { Op, fn, col } = require('sequelize');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/uploadToCloudinary');

// ------------------------------------------------------------------
// @desc   Admin creates medicine metadata (with optional image upload)
// @route  POST /api/medicines
// @access Private/Admin
// Accepts: multipart/form-data with up to 5 images (field name: "images")
//          OR JSON body with images: [url1, url2, ...]
// ------------------------------------------------------------------
exports.addMedicine = async (req, res) => {
  try {
    const {
      name, generic_name, brand_name, category,
      medical_details, other_details, metadata,
    } = req.body;

    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and category',
      });
    }

    // ---- Resolve images from files or JSON body ----
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map((f) =>
          uploadToCloudinary(f.buffer, { folder: 'pharmacy/medicines' })
        )
      );
      imageUrls = uploads.map((u) => u.secure_url);
    } else if (Array.isArray(req.body.images)) {
      imageUrls = req.body.images.filter(Boolean);
    } else if (typeof req.body.images === 'string' && req.body.images) {
      // form-data may send a JSON-stringified array
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) imageUrls = parsed.filter(Boolean);
      } catch {
        imageUrls = [req.body.images];
      }
    }

    // JSONB fields may arrive as strings in multipart/form-data — parse safely
    const parseJson = (v, fallback = {}) => {
      if (v == null) return fallback;
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch { return fallback; }
    };

    const medicine = await Medicine.create({
      name,
      generic_name,
      brand_name,
      category,
      medical_details: parseJson(medical_details),
      other_details: parseJson(other_details),
      metadata: parseJson(metadata),
      images: imageUrls,
      created_by: req.user.id,
    });

    const result = await Medicine.findByPk(medicine.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    res.status(201).json({
      success: true,
      message: 'Medicine created successfully',
      data: result,
    });
  } catch (error) {
    console.error('Add medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding medicine',
      error: error.message,
    });
  }
};

// ------------------------------------------------------------------
// @desc   Admin updates medicine metadata (with optional image replace)
// @route  PUT /api/medicines/:id
// @access Private/Admin
// Accepts: multipart/form-data with new images (field: "images")
//          If "replace_images=true" is sent, old Cloudinary files are deleted
// ------------------------------------------------------------------
exports.updateMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    const payload = { ...req.body };

    const parseJson = (v, fallback) => {
      if (v == null) return fallback;
      if (typeof v === 'object') return v;
      try { return JSON.parse(v); } catch { return fallback; }
    };

    if (payload.medical_details) payload.medical_details = parseJson(payload.medical_details, medicine.medical_details);
    if (payload.other_details) payload.other_details = parseJson(payload.other_details, medicine.other_details);
    if (payload.metadata) payload.metadata = parseJson(payload.metadata, medicine.metadata);

    // New images uploaded?
    if (req.files && req.files.length > 0) {
      const uploads = await Promise.all(
        req.files.map((f) => uploadToCloudinary(f.buffer, { folder: 'pharmacy/medicines' }))
      );
      const newUrls = uploads.map((u) => u.secure_url);

      const replace = String(req.body.replace_images).toLowerCase() === 'true';
      if (replace) {
        // Delete old Cloudinary files (best-effort — extracts public_id from URL)
        const oldIds = (medicine.images || [])
          .map((url) => {
            const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            return m ? m[1] : null;
          })
          .filter(Boolean);
        await Promise.all(oldIds.map((id) => deleteFromCloudinary(id)));
        payload.images = newUrls;
      } else {
        payload.images = [...(medicine.images || []), ...newUrls];
      }
    }

    await medicine.update(payload);

    const updated = await Medicine.findByPk(medicine.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
    });

    res.status(200).json({
      success: true,
      message: 'Medicine updated successfully',
      data: updated,
    });
  } catch (error) {
    console.error('Update medicine error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating medicine',
      error: error.message,
    });
  }
};

// ------------------------------------------------------------------
// Rest of the controller unchanged — but fixing the pagination bug
// ------------------------------------------------------------------

exports.getMedicines = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const where = {};

    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { generic_name: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
        { category: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Medicine.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ success: false, message: 'Error fetching medicines', error: error.message });
  }
};

exports.getMedicineById = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
    });
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }
    res.status(200).json({ success: true, data: medicine });
  } catch (error) {
    console.error('Get medicine error:', error);
    res.status(500).json({ success: false, message: 'Error fetching medicine', error: error.message });
  }
};

exports.deleteMedicine = async (req, res) => {
  try {
    const medicine = await Medicine.findByPk(req.params.id);
    if (!medicine) {
      return res.status(404).json({ success: false, message: 'Medicine not found' });
    }

    // Best-effort Cloudinary cleanup
    const ids = (medicine.images || [])
      .map((url) => {
        const m = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
        return m ? m[1] : null;
      })
      .filter(Boolean);
    await Promise.all(ids.map((id) => deleteFromCloudinary(id)));

    await medicine.destroy();
    res.status(200).json({ success: true, message: 'Medicine deleted successfully' });
  } catch (error) {
    console.error('Delete medicine error:', error);
    res.status(500).json({ success: false, message: 'Error deleting medicine', error: error.message });
  }
};

exports.getMedicineStats = async (req, res) => {
  try {
    const totalMedicines = await Medicine.count();

    const categories = await Medicine.findAll({
      attributes: ['category', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['category'],
    });

    res.status(200).json({
      success: true,
      data: { total: totalMedicines, categories, category_count: categories.length },
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics', error: error.message });
  }
};

// ------------------------------------------------------------------
// @desc   Customer-visible medicines (aggregated stock from supplies)
// @route  GET /api/medicines/available
// @access Public
// ------------------------------------------------------------------
exports.getAvailableMedicines = async (req, res) => {
  try {
    const { category, search, in_stock, limit = 100, page = 1 } = req.query;

    const medicineWhere = {};
    if (category) medicineWhere.category = category;
    if (search) {
      medicineWhere[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { generic_name: { [Op.iLike]: `%${search}%` } },
        { brand_name: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const supplyWhere = { status: { [Op.in]: ['approved', 'received'] } };

    const parsedLimit = Math.min(parseInt(limit, 10) || 100, 200);
    const parsedPage  = Math.max(parseInt(page, 10) || 1, 1);
    const offset      = (parsedPage - 1) * parsedLimit;

    const { count, rows } = await Medicine.findAndCountAll({
      where: medicineWhere,
      include: [
        {
          model: Supply,
          as: 'supplies',
          where: supplyWhere,
          required: true,
          attributes: [],
        },
      ],
      attributes: {
        include: [
          [fn('COALESCE', fn('SUM', col('supplies.quantity')), 0), 'total_quantity'],
          [fn('MIN', col('supplies.unit_price')), 'min_price'],
          [fn('MAX', col('supplies.unit_price')), 'max_price'],
        ],
      },
      group: ['Medicine.id'],
      order: [['name', 'ASC']],
      limit: parsedLimit,
      offset,
      subQuery: false,
      distinct: true,
    });

    const data = rows.map((m) => {
      const plain = m.get({ plain: true });
      const qty = Number(plain.total_quantity) || 0;
      return {
        id: plain.id,
        name: plain.name,
        generic_name: plain.generic_name,
        brand_name: plain.brand_name,
        category: plain.category,
        images: plain.images || [],
        medical_details: plain.medical_details || {},
        other_details: plain.other_details || {},
        metadata: plain.metadata || {},
        total_quantity: qty,
        min_price: plain.min_price != null ? Number(plain.min_price) : null,
        max_price: plain.max_price != null ? Number(plain.max_price) : null,
        in_stock: qty > 0,
      };
    });

    const finalData =
      in_stock === 'true'  ? data.filter((m) => m.in_stock)   :
      in_stock === 'false' ? data.filter((m) => !m.in_stock)  :
                             data;

    // Sequelize returns an ARRAY for count when group is used
    const totalCount = Array.isArray(count) ? count.length : count;

    res.status(200).json({
      success: true,
      count: finalData.length,
      data: finalData,
      pagination: {
        total: totalCount,
        page: parsedPage,
        pages: Math.ceil(totalCount / parsedLimit),
        limit: parsedLimit,
      },
    });
  } catch (error) {
    console.error('Get available medicines error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available medicines',
      error: error.message,
    });
  }
};