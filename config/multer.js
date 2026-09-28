// config/multer.js
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    console.log('🔍 [multer] fileFilter invoked', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });

    const allowed = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (!allowed.test(file.mimetype)) {
      console.log('❌ [multer] rejected file type:', file.mimetype);
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

module.exports = { upload };