// config/uploadToCloudinary.js
const cloudinary = require('./cloudinary');

/**
 * Upload a buffer OR a base64 data URL to Cloudinary.
 * @param {Buffer|string} fileOrBase64
 * @param {object} opts  { folder, resourceType }
 * @returns {Promise<{secure_url, public_id, width, height, format, bytes}>}
 */
async function uploadToCloudinary(fileOrBase64, opts = {}) {
  const {
    folder = process.env.CLOUDINARY_FOLDER || 'pharmacy',
    resourceType = 'image',
  } = opts;

  if (!fileOrBase64) throw new Error('No file provided for upload');

  let dataUri;
  if (Buffer.isBuffer(fileOrBase64)) {
    dataUri = `data:image/jpeg;base64,${fileOrBase64.toString('base64')}`;
  } else if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
    dataUri = fileOrBase64;
  } else if (typeof fileOrBase64 === 'string') {
    // Already a URL — Cloudinary can ingest remote URLs too
    dataUri = fileOrBase64;
  } else {
    throw new Error('Unsupported file format for Cloudinary upload');
  }

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: resourceType,
    // Auto quality + format keeps files small; great for cards and modals
    transformation: [
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}

/**
 * Delete a file from Cloudinary by its public_id.
 * Silently ignores errors (file may already be gone).
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn('Cloudinary delete failed for', publicId, err.message);
  }
}

module.exports = { uploadToCloudinary, deleteFromCloudinary };