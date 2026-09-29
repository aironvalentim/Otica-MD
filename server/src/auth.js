const jwt = require('jsonwebtoken');
const { HttpError } = require('./util');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.warn('[aviso] JWT_SECRET ausente ou curto demais. Defina um valor longo no .env.');
}

function assinarToken(usuario) {
  return jwt.sign({ id: usuario.id, nome: usuario.nome, papel: usuario.papel }, SECRET || 'dev-secret-inseguro', {
    expiresIn: '12h',
  });
}

function autenticar(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Faça login para continuar'));
  try {
    req.usuario = jwt.verify(token, SECRET || 'dev-secret-inseguro');
    next();
  } catch {
    next(new HttpError(401, 'Sessão expirada. Faça login novamente'));
  }
}

function somenteAdmin(req, _res, next) {
  if (req.usuario?.papel !== 'admin') return next(new HttpError(403, 'Apenas administradores podem fazer isso'));
  next();
}

module.exports = { assinarToken, autenticar, somenteAdmin };
