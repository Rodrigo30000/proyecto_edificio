// backend/routes/stripeWebhook.js
import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';
import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'url';
import { getPool } from '../lib/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const pool = getPool();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RECEIPTS_DIR = path.join(process.cwd(), 'receipts'); // carpeta en /backend/receipts

function ensureReceiptsDir() {
  if (!fs.existsSync(RECEIPTS_DIR)) fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
}

async function generarReciboPDF(id_pago) {
  ensureReceiptsDir();

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

  if (!row) throw new Error('Pago no encontrado para generar recibo');

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

  // Guardar ruta relativa en la BD
  await pool.query(`UPDATE PAGO SET recibo_pdf = ? WHERE id_pago = ?`, [path.join('receipts', filename), row.id_pago]);

  return fullpath;
}

// Usado por index.js: app.post('/api/finanzas/stripe/webhook', express.raw(...), stripeWebhook)
export async function stripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body, // raw body (NO JSON)
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verify failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const ids = (meta.invoice_ids || '')
      .split(',')
      .map(s => parseInt(s, 10))
      .filter(n => Number.isFinite(n));

    if (ids.length > 0) {
      try {
        // Leer montos de esas facturas
        const [fac] = await pool.query(
          `SELECT id_factura, monto
             FROM FACTURA
            WHERE id_factura IN (${ids.map(() => '?').join(',')})`,
          ids
        );

        for (const f of fac) {
          // Insertar pago
          const [ins] = await pool.query(
            `INSERT INTO PAGO (id_factura, fecha_pago, monto, metodo_pago, estado)
             VALUES (?, NOW(), ?, 'stripe', 'confirmado')`,
            [f.id_factura, f.monto]
          );

          // Marcar factura pagada
          await pool.query(`UPDATE FACTURA SET estado = 'pagada' WHERE id_factura = ?`, [f.id_factura]);

          // Generar recibo PDF
          const id_pago = ins.insertId;
          if (id_pago) {
            try {
              await generarReciboPDF(id_pago);
            } catch (e) {
              console.error('No se pudo generar el PDF del recibo', e);
            }
          }
        }
      } catch (e) {
        console.error('Error aplicando pagos del webhook', e);
      }
    }
  }

  res.json({ received: true });
}
