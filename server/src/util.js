const { z } = require('zod');

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Envolve handlers async para que erros cheguem ao middleware de erro
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Valida req.body (ou outro objeto) com um schema zod
function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ campo: i.path.join('.'), erro: i.message }));
    throw new HttpError(400, 'Dados inválidos', details);
  }
  return result.data;
}

function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Data de hoje (AAAA-MM-DD) no fuso de Pernambuco
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(new Date());

// Helpers zod reutilizáveis
const zId = z.coerce.number().int().positive();
// Converte '' (campo de formulário vazio) em null antes de validar
const vazio = (schema) => z.preprocess((v) => (v === '' ? null : v), schema);

const zIdOpt = vazio(z.coerce.number().int().positive().nullable().optional());
const zMoney = z.coerce.number().min(0).transform(round2);
const zTextOpt = z.string().trim().max(2000).nullable().optional().transform((v) => (v === '' ? null : v));
const zDateOpt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD')
  .nullable()
  .optional()
  .or(z.literal('').transform(() => null));

// Monta cláusula SET dinâmica para updates parciais
function buildUpdate(data, allowed) {
  const sets = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      values.push(key === 'imagens' ? JSON.stringify(data[key]) : data[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }
  return { sets, values };
}

module.exports = { HttpError, ah, parse, slugify, round2, hoje, vazio, zId, zIdOpt, zMoney, zTextOpt, zDateOpt, buildUpdate, z };
