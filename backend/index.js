import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import { getPool } from './lib/db.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Probar conexión al iniciar
(async () => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    console.log('Conexión a MySQL/MariaDB OK');
  } catch (e) {
    console.error(' Error conectando a la BD:', e.message);
  }
})();

// ✅ Ruta base para test
app.get('/', (_req, res) => res.send('API OK ✅'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', authRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Servidor en http://localhost:${port}`);
});
