// backend/middleware/auth.js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  try {
    const hdr = req.headers['authorization'] || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'No autorizado (token faltante)' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { uid, rol, correo }
    next();
  } catch (e) {
    return res.status(401).json({ message: 'No autorizado (token inválido/expirado)' });
  }
}

export function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No autorizado' });
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ message: 'Acceso denegado (rol insuficiente)' });
    }
    next();
  };
}
