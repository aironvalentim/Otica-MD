const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { ah, parse, z, zId, HttpError } = require('../util');
const { somenteAdmin } = require('../auth');

router.use(somenteAdmin);

router.get(
  '/',
  ah(async (_req, res) => {
    const { rows } = await query('select id, nome, email, papel, ativo, criado_em from usuarios order by nome');
    res.json(rows);
  })
);

const schema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  papel: z.enum(['admin', 'vendedor']).default('vendedor'),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').optional(),
  ativo: z.boolean().optional(),
});

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, req.body);
    if (!d.senha) throw new HttpError(400, 'Informe uma senha');
    const hash = await bcrypt.hash(d.senha, 10);
    const { rows } = await query(
      'insert into usuarios (nome, email, papel, senha_hash) values ($1,$2,$3,$4) returning id, nome, email, papel, ativo',
      [d.nome, d.email, d.papel, hash]
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), req.body);
    if (id === req.usuario.id && (d.ativo === false || d.papel === 'vendedor')) {
      throw new HttpError(400, 'Você não pode rebaixar ou desativar o próprio usuário');
    }
    const campos = [];
    const valores = [];
    for (const k of ['nome', 'email', 'papel', 'ativo']) {
      if (d[k] !== undefined) {
        valores.push(d[k]);
        campos.push(`${k} = $${valores.length}`);
      }
    }
    if (d.senha) {
      valores.push(await bcrypt.hash(d.senha, 10));
      campos.push(`senha_hash = $${valores.length}`);
    }
    if (!campos.length) throw new HttpError(400, 'Nada para atualizar');
    valores.push(id);
    const { rows } = await query(
      `update usuarios set ${campos.join(', ')} where id = $${valores.length} returning id, nome, email, papel, ativo`,
      valores
    );
    if (!rows[0]) throw new HttpError(404, 'Usuário não encontrado');
    res.json(rows[0]);
  })
);

module.exports = router;
