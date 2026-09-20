// config/database.js
const { Sequelize } = require('sequelize');
const dns = require('dns');
require('dotenv').config();

// Force IPv4 globally
dns.setDefaultResultOrder('ipv4first');

// DISABLE SSL VALIDATION FOR SUPABASE
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let sequelize;

if (process.env.SUPABASE_DATABASE_URL) {
  console.log(' Connecting to Supabase Cloud...');
  
  let connectionUrl = process.env.SUPABASE_DATABASE_URL;
  
  // Remove any existing sslmode and add ours
  connectionUrl = connectionUrl.replace(/\?.*$/, '');
  connectionUrl += '?sslmode=require';
  
  // Add family=4 if not present
  if (!connectionUrl.includes('family=4')) {
    connectionUrl += '&family=4';
  }
  
  sequelize = new Sequelize(connectionUrl, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: {
      ssl: false, // COMPLETELY DISABLE SSL
      // OR use these options:
      // ssl: {
      //   require: false,
      //   rejectUnauthorized: false
      // }
    },
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    },
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /ETIMEDOUT/,
        /ENETUNREACH/,
        /ENOTFOUND/
      ]
    }
  });
} else {
  // Local development
  console.log(' Connecting to Local PostgreSQL...');
  sequelize = new Sequelize(
    process.env.DB_DATABASE || 'finance_tracker',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: console.log,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      },
      define: {
        timestamps: true,
        underscored: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
      }
    }
  );
}

const testConnection = async (retries = 3) => {
  console.log('🔌 Connecting to database...');
  
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.authenticate();
      console.log(' Database connection established successfully.');
      
      const [result] = await sequelize.query('SELECT version()');
      console.log(' PostgreSQL version:', result[0].version.split(',')[0]);
      
      return true;
    } catch (error) {
      console.error(` Connection attempt ${i + 1} failed:`, error.message);
      
      if (error.message.includes('self-signed certificate')) {
        console.error(' SSL certificate issue - disabling SSL...');
        // Try to force disable SSL in the connection
        try {
          const url = new URL(process.env.SUPABASE_DATABASE_URL);
          // Reconnect without SSL
          await sequelize.close();
          sequelize = new Sequelize(`postgresql://${url.username}:${url.password}@${url.hostname}:${url.port || 5432}/postgres`, {
            dialect: 'postgres',
            dialectOptions: {
              ssl: false
            },
            logging: false
          });
          await sequelize.authenticate();
          console.log(' Connection successful without SSL!');
          return true;
        } catch (fallbackError) {
          console.error(' Fallback connection also failed:', fallbackError.message);
        }
      }
      
      if (i < retries - 1) {
        const waitTime = (i + 1) * 2000;
        console.log(` Retrying in ${waitTime/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error(' All connection attempts failed.');
  return false;
};

module.exports = {
  sequelize,
  testConnection
};