// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const supplyRoutes = require('./routes/supplyRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');

// Load cloudinary config early so env vars are validated on boot
require('./config/cloudinary');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://pharmacy-frontend-lp3h.onrender.com',
  ],
  credentials: true,
};

app.use(cors(corsOptions));

// JSON body limit: 1 MB is enough for customer details.
// Image uploads go through multer → Cloudinary and don't hit this parser.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/supplies', supplyRoutes);
app.use('/api/enquiries', enquiryRoutes);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'Pharmacy API is running!', version: '1.0.0' });
});

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError') {
    return res.status(413).json({
      success: false,
      message: 'Payload too large. Please upload a smaller file.',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message,
  });
});

const startServer = async () => {
  const dbConnected = await testConnection();
  if (dbConnected) {
    await sequelize.sync();
    console.log('📦 Database synced');
  }
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();