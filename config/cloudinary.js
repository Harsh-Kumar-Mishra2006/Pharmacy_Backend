// config/cloudinary.js
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Fail fast in production if env vars are missing
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.CLOUDINARY_CLOUD_NAME ||
   !process.env.CLOUDINARY_API_KEY ||
   !process.env.CLOUDINARY_API_SECRET)
) {
  console.error('❌ Cloudinary env vars missing — image uploads will fail');
}

module.exports = cloudinary;