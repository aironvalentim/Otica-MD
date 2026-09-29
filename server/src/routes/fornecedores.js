const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z, zId, zTextOpt, buildUpdate, HttpError } = require('../util');

const schema = z.object({
  nome: z.string().trim().min(2),
  tipo: z.enum(['fornecedor', 'laboratorio']).default('fornecedor'),
  cnpj: zTextOpt,
  telefone: zTextOpt,
  email: zTextOpt,
  observacoes: zTextOpt,
});
const CAMPOS = Object.keys(schema.shape);

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.tipo) {
      params.push(req.query.tipo);
      where = 'where tipo = $1';
    }
    const { rows } = await query(`select * from fornecedores ${where} order by nome`, params);
    res.json(rows);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, req.body);
    const { rows } = await query(
      `insert into fornecedores (${CAMPOS.join(', ')}) values (${CAMPOS.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
      CAMPOS.map((c) => d[c] ?? null)
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), req.body);
    const { sets, values } = buildUpdate(d, CAMPOS);
    if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
    values.push(id);
    const { rows } = await query(`update fornecedores set ${sets.join(', ')} where id = $${values.length} returning *`, values);
    if (!rows[0]) throw new HttpError(404, 'Fornecedor não encontrado');
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    await query('delete from fornecedores where id = $1', [id]);
    res.status(204).end();
  })
);

module.exports = router;
