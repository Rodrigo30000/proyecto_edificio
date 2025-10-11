// backend/routes/authRoutes.js
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPool } from '../lib/db.js';

const router = Router();
const pool = getPool();

/* =========================
   Utilidades
========================= */

// Valida reCAPTCHA solo si hay RECAPTCHA_SECRET en .env
async function verifyRecaptcha(token) {
  if (!process.env.RECAPTCHA_SECRET) return true; // en desarrollo, si no hay secret => no bloquear
  if (!token) return false;

  // Node 18+ tiene fetch global
  const params = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET,
    response: token,
  });

  try {
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// Mapea el rol que llega desde la UI al valor aceptado por la BD
function mapRolToDb(rolUi = '') {
  const r = String(rolUi).toLowerCase();
  if (r.startsWith('admin')) return 'admin';
  if (r.startsWith('residen')) return 'residente';
  if (r.startsWith('personal')) return 'personal';
  return 'residente';
}

/* =========================
   POST /api/register
   Body:
   {
     nombre, apellidoPaterno, apellidoMaterno?, correo, celular?, password,
     rol: "Residente" | "Personal" | "Administrador",
     departamento?: "P1D1" (requerido si rol=residente),
     ci?: string,                // requerido por la tabla RESIDENTE (si no llega, se genera)
     token?: string              // reCAPTCHA
   }
========================= */
router.post('/register', async (req, res) => {
  let conn;
  try {
    const {
      nombre,
      apellidoPaterno,
      apellidoMaterno = '',
      correo,
      celular = null,
      password,
      rol,
      departamento = null, // para residente, ej. "P1D1"
      ci = null,
      token = null,
    } = req.body || {};

    // reCAPTCHA (opcional)
    const okCaptcha = await verifyRecaptcha(token);
    if (!okCaptcha) return res.status(400).json({ message: 'Falló la verificación reCAPTCHA.' });

    // Validaciones mínimas
    if (!nombre || !apellidoPaterno || !correo || !password || !rol) {
      return res.status(400).json({ message: 'Faltan campos obligatorios.' });
    }

    const rolDb = mapRolToDb(rol);
    const apellido = `${apellidoPaterno ?? ''} ${apellidoMaterno ?? ''}`.trim();

    // Correo único
    const [uRows] = await pool.query('SELECT id_usuario FROM USUARIO WHERE correo = ? LIMIT 1', [correo]);
    if (uRows.length > 0) {
      return res.status(409).json({ message: 'El correo ya está registrado.' });
    }

    // Iniciar transacción
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const nombreUsuario = (correo?.split('@')[0] || nombre).slice(0, 100);

    // Crear USUARIO
    const [insUser] = await conn.query(
      `INSERT INTO USUARIO (nombre_usuario, correo, password, rol, celular)
       VALUES (?, ?, ?, ?, ?)`,
      [nombreUsuario, correo, hash, rolDb, celular]
    );
    const userId = insUser.insertId;

    if (rolDb === 'residente') {
      if (!departamento) {
        await conn.rollback();
        return res.status(400).json({ message: 'Departamento es obligatorio para residentes.' });
      }

      // Buscar o crear departamento por "numero"
      let idDepto = null;
      const [dRows] = await conn.query(
        'SELECT id_departamento FROM DEPARTAMENTO WHERE numero = ? LIMIT 1',
        [departamento]
      );
      if (dRows.length > 0) {
        idDepto = dRows[0].id_departamento;
      } else {
        const [insDep] = await conn.query(
          `INSERT INTO DEPARTAMENTO (numero, estado) VALUES (?, 'ocupado')`,
          [departamento]
        );
        idDepto = insDep.insertId;
      }

      // Tabla RESIDENTE exige CI NOT NULL
      const ciSafe = ci && String(ci).trim() ? String(ci).trim() : `GEN-${Date.now()}`;

      await conn.query(
        `INSERT INTO RESIDENTE (id_usuario, nombre, apellido, ci, id_departamento)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, nombre, apellido, ciSafe, idDepto]
      );
    }

    if (rolDb === 'personal') {
      const hoy = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      await conn.query(
        `INSERT INTO PERSONAL (id_usuario, fecha_contratacion)
         VALUES (?, ?)`,
        [userId, hoy]
      );
    }

    await conn.commit();
    return res.status(201).json({ message: 'Usuario registrado correctamente.' });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    try { if (conn) await conn.rollback(); } catch {}
    return res.status(500).json({ message: 'Error en el servidor.' });
  } finally {
    try { if (conn) conn.release(); } catch {}
  }
});

/* =========================
   POST /api/login
   Body: { username, password, token? }
   - username = correo (o nombre_usuario si quieres adaptar)
   Respuesta: { rol, token, username }
========================= */
router.post('/login', async (req, res) => {
  try {
    const { username, password, token = null } = req.body || {};

    // reCAPTCHA (opcional)
    const okCaptcha = await verifyRecaptcha(token);
    if (!okCaptcha) return res.status(400).json({ message: 'Falló la verificación reCAPTCHA.' });

    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son obligatorios.' });
    }

    // Busca por correo (puedes ampliar a nombre_usuario si lo prefieres)
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre_usuario, correo, password, rol
       FROM USUARIO
       WHERE correo = ? OR nombre_usuario = ?
       LIMIT 1`,
      [username, username]
    );

    if (rows.length === 0) return res.status(401).json({ message: 'Credenciales inválidas.' });

    const u = rows[0];

    // ✅ Soporta passwords con hash bcrypt y también texto plano (para migrar)
    let ok = false;
    if (typeof u.password === 'string' && u.password.startsWith('$2')) {
      ok = await bcrypt.compare(password, u.password);
    } else {
      ok = (password === u.password);
    }
    if (!ok) return res.status(401).json({ message: 'Credenciales inválidas.' });

    // JWT opcional
    let tokenJwt = null;
    if (process.env.JWT_SECRET) {
      tokenJwt = jwt.sign(
        { uid: u.id_usuario, rol: u.rol, correo: u.correo },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );
    }

    return res.json({
      rol: u.rol,                    // 'admin' | 'residente' | 'personal'
      token: tokenJwt,               // puede ser null si no definiste JWT_SECRET
      username: u.nombre_usuario
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    return res.status(500).json({ message: 'Error en el servidor.' });
  }
});

export default router;
