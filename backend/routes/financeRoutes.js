// backend/routes/financeRoutes.js
import express from 'express';
import Stripe from 'stripe';
import { getPool } from '../lib/db.js';
import jwt from 'jsonwebtoken';

// ⬇️ NUEVO para recibos PDF
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const router = express.Router();
const pool = getPool();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// ---- Helpers recibos ----
const RECEIPTS_DIR = path.join(process.cwd(), 'receipts');
function ensureReceiptsDir() {
  if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

async function regenerarReciboSiFalta(id_pago) {
  // Traer todos los datos necesarios del pago
  const [[row]] = await pool.query(
    `SELECT 
       p.id_pago, p.fecha_pago, p.metodo_pago, p.monto, p.id_factura,
       f.concepto, f.fecha_emision, f.fecha_vencimiento,
       d.numero AS departamento,
       u.nombre_usuario, u.correo
     FROM PAGO p
     JOIN FACTURA f    ON f.id_factura = p.id_factura
     JOIN RESIDENTE r  ON r.id_departamento = f.id_departamento
     JOIN USUARIO u    ON u.id_usuario = r.id_usuario
     JOIN DEPARTAMENTO d ON d.id_departamento = r.id_departamento
    WHERE p.id_pago = ?`,
    [id_pago]
  );
  if (!row) return null;

  ensureReceiptsDir();
  const filename = `recibo_${row.id_pago}.pdf`;
  const fullpath = path.join(RECEIPTS_DIR, filename);

  // Generar PDF
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(fullpath);
  doc.pipe(stream);

  doc.fontSize(18).text('RECIBO DE PAGO', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).text(`ID Pago: ${row.id_pago}`);
  doc.text(`Fecha de pago: ${new Date(row.fecha_pago).toLocaleString()}`);
  doc.text(`Método: ${row.metodo_pago}`);
  doc.text(`Monto: ${Number(row.monto).toFixed(2)}`);
  doc.moveDown();

  doc.text(`Factura #${row.id_factura}`);
  doc.text(`Concepto: ${row.concepto || '-'}`);
  doc.text(`Emisión: ${row.fecha_emision ? new Date(row.fecha_emision).toLocaleDateString() : '-'}`);
  doc.text(`Vencimiento: ${row.fecha_vencimiento ? new Date(row.fecha_vencimiento).toLocaleDateString() : '-'}`);
  doc.moveDown();

  doc.text(`Departamento: ${row.departamento}`);
  doc.text(`Usuario: ${row.nombre_usuario} <${row.correo}>`);
  doc.moveDown();

  doc.text('Gracias por su pago.', { align: 'center' });
  doc.end();

  await new Promise((res, rej) => {
    stream.on('finish', res);
    stream.on('error', rej);
  });

  // Guardar ruta en BD
  const relativePath = path.join('receipts', filename);
  await pool.query(`UPDATE PAGO SET recibo_pdf = ? WHERE id_pago = ?`, [relativePath, row.id_pago]);

  return fullpath;
}

// ---- Auth mínimo por Bearer ----
function requireAuth(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autorizado (token faltante)' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = payload; // { uid, rol, correo }
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido' });
  }
}

// ---- Diagnóstico: ver estado de configuración ----
router.get('/finanzas/status', (_req, res) => {
  res.json({
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    appUrl: process.env.APP_URL || null,
    currency: process.env.CURRENCY || 'usd'
  });
});

// ---- 1) Mis facturas (residente) ----
router.get('/finanzas/mis-facturas', requireAuth, async (req, res) => {
  try {
    const [r] = await pool.query(
      `SELECT r.id_departamento
         FROM RESIDENTE r
        WHERE r.id_usuario = ?
        LIMIT 1`,
      [req.auth.uid]
    );
    if (r.length === 0) return res.json({ facturas: [] });

    const idDepto = r[0].id_departamento;
    const [rows] = await pool.query(
      `SELECT 
         f.id_factura, f.concepto, f.monto, f.estado, f.fecha_emision, f.fecha_vencimiento,
         (SELECT MAX(p.id_pago) 
            FROM PAGO p 
           WHERE p.id_factura = f.id_factura AND p.estado='confirmado') AS id_pago_ultimo
       FROM FACTURA f
      WHERE f.id_departamento = ?
      ORDER BY f.fecha_emision DESC, f.id_factura DESC`,
      [idDepto]
    );
    res.json({ facturas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error listando facturas' });
  }
});

// ---- 2) Pago simulado (una factura) ----
router.post('/finanzas/pagar', requireAuth, async (req, res) => {
  try {
    const { id_factura } = req.body;
    if (!id_factura) return res.status(400).json({ message: 'id_factura requerido' });

    const [[row]] = await pool.query(
      `SELECT f.id_factura, f.monto, f.estado
         FROM FACTURA f
         JOIN RESIDENTE r ON r.id_departamento = f.id_departamento
        WHERE f.id_factura = ? AND r.id_usuario = ?`,
      [id_factura, req.auth.uid]
    );
    if (!row) return res.status(404).json({ message: 'Factura no encontrada' });
    if (row.estado === 'pagada') return res.status(400).json({ message: 'Ya está pagada' });

    const [ins] = await pool.query(
      `INSERT IGNORE INTO PAGO (id_factura, fecha_pago, monto, metodo_pago, estado)
       VALUES (?, NOW(), ?, 'simulado', 'confirmado')`,
      [id_factura, row.monto]
    );
    await pool.query(`UPDATE FACTURA SET estado='pagada' WHERE id_factura = ?`, [id_factura]);

    // generar recibo para pago simulado también
    try { await regenerarReciboSiFalta(ins.insertId); } catch {}

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error registrando pago' });
  }
});

// ---- 3) Stripe Checkout (varias facturas) ----
router.post('/finanzas/checkout', requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(501).json({ message: 'Stripe no configurado (faltan STRIPE_SECRET_KEY / WEBHOOK).' });
    }

    const { ids } = req.body; // array
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids[] requerido' });
    }

    const idsNum = [...new Set(ids.map(n => Number(n)).filter(Number.isFinite))];
    if (idsNum.length === 0) {
      return res.status(400).json({ message: 'ids[] inválidos' });
    }

    const placeholders = idsNum.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT f.id_factura, f.concepto, f.monto, f.estado
         FROM FACTURA f
         JOIN RESIDENTE r ON r.id_departamento = f.id_departamento
        WHERE r.id_usuario = ? AND f.id_factura IN (${placeholders})`,
      [req.auth.uid, ...idsNum]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Facturas no válidas' });

    const pendientes = rows.filter(r => r.estado !== 'pagada');
    if (pendientes.length === 0) return res.status(400).json({ message: 'Todas ya están pagadas' });

    const currency = (process.env.CURRENCY || 'usd').toLowerCase();
    const line_items = pendientes.map(f => ({
      quantity: 1,
      price_data: {
        currency,
        unit_amount: Math.round(Number(f.monto) * 100),
        product_data: {
          name: `Factura #${f.id_factura}`,
          description: f.concepto?.slice(0, 100) || 'Pago de factura',
        },
      },
    }));

    const meta = {
      user_id: String(req.auth.uid),
      invoice_ids: pendientes.map(f => f.id_factura).join(','),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      customer_email: req.auth.correo,
      success_url: `${process.env.APP_URL || 'http://localhost:5173'}/home/finanzas?ok=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:5173'}/home/finanzas?cancel=1`,
      metadata: meta,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('CHECKOUT ERROR', err);
    res.status(500).json({ message: 'No se pudo crear el checkout' });
  }
});

// ---- 4) Confirmar pago manual (sin webhook) ----
router.get('/finanzas/confirmar', requireAuth, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(501).json({ message: 'Stripe no configurado' });
    }
    const stripe = new (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ message: 'session_id requerido' });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.customer_email && session.customer_email !== req.auth.correo) {
      return res.status(403).json({ message: 'La sesión de pago no corresponde a este usuario' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: `Pago no confirmado (status: ${session.payment_status})` });
    }

    const ids = (session.metadata?.invoice_ids || '')
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(Number.isFinite);

    if (ids.length === 0) return res.status(400).json({ message: 'Sin facturas en metadata' });

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT f.id_factura, f.monto, f.estado
         FROM FACTURA f
         JOIN RESIDENTE r ON r.id_departamento = f.id_departamento
        WHERE r.id_usuario = ? AND f.id_factura IN (${placeholders})`,
      [req.auth.uid, ...ids]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Facturas no válidas' });

    const pagadas = [];
    for (const f of rows) {
      if (f.estado !== 'pagada') {
        const [ins] = await pool.query(
          `INSERT IGNORE INTO PAGO (id_factura, fecha_pago, monto, metodo_pago, estado)
           VALUES (?, NOW(), ?, 'stripe', 'confirmado')`,
          [f.id_factura, f.monto]
        );
        await pool.query(`UPDATE FACTURA SET estado='pagada' WHERE id_factura = ?`, [f.id_factura]);
        if (ins.insertId) {
          try { await regenerarReciboSiFalta(ins.insertId); } catch {}
        }
        pagadas.push(f.id_factura);
      }
    }

    return res.json({ ok: true, pagadas });
  } catch (err) {
    console.error('CONFIRMAR ERROR', err);
    return res.status(500).json({ message: 'No se pudo confirmar el pago', error: err.message || null });
  }
});

// ---- 5) Descargar recibo PDF por id_pago (regenera si falta) ----
router.get('/finanzas/recibo/:id_pago', requireAuth, async (req, res) => {
  try {
    const id_pago = parseInt(req.params.id_pago, 10);
    if (!Number.isFinite(id_pago)) return res.status(400).json({ message: 'id_pago inválido' });

    // verificar que el pago pertenece al usuario
    const [[row]] = await pool.query(
      `SELECT 
         p.recibo_pdf,
         p.id_pago
       FROM PAGO p
       JOIN FACTURA f   ON f.id_factura = p.id_factura
       JOIN RESIDENTE r ON r.id_departamento = f.id_departamento
      WHERE p.id_pago = ?
        AND r.id_usuario = ?`,
      [id_pago, req.auth.uid]
    );
    if (!row) return res.status(404).json({ message: 'Pago no encontrado' });

    // si hay archivo guardado y existe, devolver
    if (row.recibo_pdf) {
      const full = path.join(process.cwd(), row.recibo_pdf);
      if (fs.existsSync(full)) {
        res.setHeader('Content-Type', 'application/pdf');
        return res.sendFile(full);
      }
    }

    // regenerar si no existe
    const regenerated = await regenerarReciboSiFalta(id_pago);
    if (regenerated && fs.existsSync(regenerated)) {
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(regenerated);
    }

    return res.status(404).json({ message: 'No existe el recibo' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al entregar el recibo' });
  }
});

export default router;
