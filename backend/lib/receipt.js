// backend/lib/receipt.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const RECEIPT_DIR = path.resolve(process.cwd(), 'receipts');

export function ensureReceiptDir() {
  if (!fs.existsSync(RECEIPT_DIR)) fs.mkdirSync(RECEIPT_DIR, { recursive: true });
}

/**
 * Genera un recibo PDF para una sesión de Stripe.
 * @param {Object} p
 * @param {string} p.sessionId - ID de la sesión (cs_test_...)
 * @param {string} p.userEmail - Correo del pagador
 * @param {Array<{id_factura:number, concepto:string, monto:number}>} p.invoices
 * @param {number} p.total
 * @returns {string} ruta absoluta del PDF generado
 */
export function createReceipt({ sessionId, userEmail, invoices = [], total = 0 }) {
  ensureReceiptDir();
  const filename = `recibo_${sessionId}.pdf`.replace(/[^\w.-]+/g, '_');
  const fullPath = path.join(RECEIPT_DIR, filename);

  const doc = new PDFDocument({ margin: 50 });
  const stream = fs.createWriteStream(fullPath);
  doc.pipe(stream);

  // Encabezado
  doc.fontSize(18).text('EdificioInteligente', { align: 'right' });
  doc.fontSize(10).fillColor('#666').text('Comprobante de pago', { align: 'right' });
  doc.moveDown();

  // Datos
  doc.fillColor('#000').fontSize(14).text('Recibo de pago', { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Fecha: ${new Date().toLocaleString()}`);
  doc.text(`Sesión Stripe: ${sessionId}`);
  if (userEmail) doc.text(`Pagador: ${userEmail}`);
  doc.moveDown();

  // Detalle
  doc.fontSize(12).text('Detalle de facturas:', { underline: true });
  doc.moveDown(0.3);
  invoices.forEach((f) => {
    doc.text(`• Factura #${f.id_factura} — ${f.concepto || 'Concepto'} — Monto: ${Number(f.monto || 0).toFixed(2)}`);
  });

  doc.moveDown();
  doc.fontSize(13).text(`Total pagado: ${Number(total || 0).toFixed(2)}`, { align: 'right' });

  // Pie
  doc.moveDown(2);
  doc.fontSize(9).fillColor('#666')
    .text('Este recibo se generó automáticamente después de confirmar el pago en Stripe.', { align: 'center' });

  doc.end();

  return fullPath;
}
