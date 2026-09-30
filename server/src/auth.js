const jwt = require('jsonwebtoken');
const { HttpError } = require('./util');
const { query } = require('./db');
const { pode } = require('./permissoes');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) {
  console.warn('[aviso] JWT_SECRET ausente ou curto demais. Defina um valor longo no .env.');
}
const segredo = () => SECRET || 'dev-secret-inseguro';

function assinarToken(usuario) {
  // O token guarda só a identidade; o perfil e as permissões são lidos do banco a cada requisição,
  // então mudanças de perfil ou desativação valem na hora.
  return jwt.sign({ id: usuario.id }, segredo(), { expiresIn: '12h' });
}

// Dados do usuário + perfil, no formato usado pela API e pelo painel
async function carregarUsuario(id) {
  const { rows } = await query(
    `select u.id, u.nome, u.email, u.ativo, p.id as perfil_id, p.nome as perfil_nome,
            p.permissoes, p.desconto_max_pct, p.sistema as perfil_sistema
       from usuarios u left join perfis p on p.id = u.perfil_id
      where u.id = $1`,
    [id]
  );
  const u = rows[0];
  if (!u || !u.ativo) return null;
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil_id ? { id: u.perfil_id, nome: u.perfil_nome, sistema: u.perfil_sistema } : null,
    permissoes: u.permissoes || [],
    desconto_max_pct: u.desconto_max_pct ?? 0,
  };
}

// Campos que só quem tem "custos.ver" recebe
const CAMPOS_CUSTO = new Set([
  'preco_custo',
  'custo_unitario',
  'custo',
  'custo_anterior',
  'custo_novo',
  'valor_custo',
  'margem',
  'margem_bruta_mes',
  'margem_depois',
]);

function semCustos(valor) {
  if (Array.isArray(valor)) return valor.map(semCustos);
  if (valor && typeof valor === 'object' && !(valor instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(valor)) if (!CAMPOS_CUSTO.has(k)) out[k] = semCustos(v);
    return out;
  }
  return valor;
}

async function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Faça login para continuar'));
  let payload;
  try {
    payload = jwt.verify(token, segredo());
  } catch {
    return next(new HttpError(401, 'Sessão expirada. Faça login novamente'));
  }
  try {
    const usuario = await carregarUsuario(payload.id);
    if (!usuario) return next(new HttpError(401, 'Usuário desativado. Fale com o administrador'));
    req.usuario = usuario;
    req.pode = (chave) => pode(usuario, chave);
    // Remove custo e margem de qualquer resposta para quem não pode vê-los
    if (!req.pode('custos.ver')) {
      const json = res.json.bind(res);
      res.json = (corpo) => json(semCustos(corpo));
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Exige pelo menos uma das permissões informadas
function exigir(...chaves) {
  return (req, _res, next) => {
    if (chaves.some((c) => req.pode(c))) return next();
    next(new HttpError(403, 'Seu perfil não tem acesso a esta função'));
  };
}

module.exports = { assinarToken, autenticar, exigir, carregarUsuario, semCustos };
