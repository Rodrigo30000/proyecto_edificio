// backend/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import { stripeWebhook } from './routes/stripeWebhook.js';
import { getPool } from './lib/db.js';

const app = express();

// CORS (puedes dejar fijo o leer de .env)
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

// ⚠️ Webhook Stripe: DEBE ir antes de express.json()
app.post('/api/finanzas/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// El resto en JSON
app.use(express.json());
//para pdf
import path from 'path';
import fs from 'fs';

const receiptsDir = path.resolve('./receipts');
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

app.get('/api/finanzas/recibo/:sid', (req, res) => {
  const file = path.join(receiptsDir, `recibo_${req.params.sid}.pdf`);
  if (!fs.existsSync(file)) return res.status(404).send('No existe el recibo');
  res.sendFile(file);
});
//fin de para pdf
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

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rutas de negocio
app.use('/api', authRoutes);
app.use('/api', financeRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Servidor en http://localhost:${port}`);
});
