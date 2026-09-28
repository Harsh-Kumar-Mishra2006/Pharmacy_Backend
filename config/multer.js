// config/multer.js
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    const allowed = /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/i;
    if (!allowed.test(file.mimetype)) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

module.exports = {
  upload,
  uploadSingle:       upload.single('image'),
  uploadMultiple:     upload.array('images', 5),
  uploadScreenshot:   upload.single('screenshot'),
};