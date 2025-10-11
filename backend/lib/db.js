// backend/lib/db.js
import mysql from 'mysql2/promise';

let pool;

export const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),   // ✅ Añadido: puerto desde .env
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'proyEdif',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4_general_ci'
    });

    console.log('✅ Pool de conexión MySQL creado');
  }
  return pool;
};
