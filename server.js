const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const medicineRoutes = require('./routes/medicineRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes'); 
const supplyRoutes = require('./routes/supplyRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://pharmacy-frontend-lp3h.onrender.com'
  ],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/supplies', supplyRoutes);
// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Pharmacy API is running!',
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: err.message
  });
});

// Start server
const startServer = async () => {
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    await sequelize.sync({ alter: true });
    console.log('📦 Database synced');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 Auth routes: http://localhost:${PORT}/api/auth`);
    console.log(`💊 Medicine routes: http://localhost:${PORT}/api/medicines`);
  });
};

startServer();