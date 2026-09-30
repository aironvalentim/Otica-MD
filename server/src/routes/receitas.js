const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z, zId, zTextOpt, zDateOpt, buildUpdate, hoje, HttpError } = require('../util');
const { exigir } = require('../auth');

router.use(exigir('clientes.gerenciar', 'vendas.criar'));

// Grau: múltiplos de 0,25 entre -30 e +30
const zGrau = z.coerce
  .number()
  .min(-30)
  .max(30)
  .refine((v) => Math.abs(Math.round(v * 4) - v * 4) < 1e-9, 'O grau deve ser múltiplo de 0,25')
  .nullable()
  .optional();
const zEixo = z.coerce.number().int().min(0).max(180).nullable().optional();
const zAdicao = z.coerce.number().min(0).max(4).nullable().optional();
const zMedida = z.coerce.number().min(0).max(99).nullable().optional();

const vazioParaNull = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === '' ? null : v]));

const schema = z.object({
  cliente_id: zId,
  medico: zTextOpt,
  crm: zTextOpt,
  data_receita: zDateOpt,
  validade: zDateOpt,
  od_esferico: zGrau,
  od_cilindrico: zGrau,
  od_eixo: zEixo,
  od_adicao: zAdicao,
  od_dnp: zMedida,
  od_altura: zMedida,
  oe_esferico: zGrau,
  oe_cilindrico: zGrau,
  oe_eixo: zEixo,
  oe_adicao: zAdicao,
  oe_dnp: zMedida,
  oe_altura: zMedida,
  observacoes: zTextOpt,
});
const CAMPOS = Object.keys(schema.shape);

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.cliente_id) {
      params.push(req.query.cliente_id);
      where = 'where r.cliente_id = $1';
    }
    const { rows } = await query(
      `select r.*, c.nome as cliente_nome from receitas r join clientes c on c.id = r.cliente_id ${where}
        order by r.data_receita desc, r.id desc limit 300`,
      params
    );
    res.json(rows);
  })
);

// Clientes cuja última receita tem mais de 1 ano: lembrete de troca de óculos
router.get(
  '/lembretes',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select distinct on (c.id) c.id as cliente_id, c.nome, c.telefone, r.id as receita_id, r.data_receita,
              (current_date - r.data_receita) as dias
         from clientes c
         join receitas r on r.cliente_id = c.id
        order by c.id, r.data_receita desc`
    );
    res.json(rows.filter((r) => r.dias >= 365).sort((a, b) => b.dias - a.dias));
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query(
      'select r.*, c.nome as cliente_nome from receitas r join clientes c on c.id = r.cliente_id where r.id = $1',
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'Receita não encontrada');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, vazioParaNull(req.body));
    if (!d.data_receita) d.data_receita = hoje();
    const { rows } = await query(
      `insert into receitas (${CAMPOS.join(', ')}) values (${CAMPOS.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
      CAMPOS.map((c) => d[c] ?? null)
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), vazioParaNull(req.body));
    const { sets, values } = buildUpdate(d, CAMPOS);
    if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
    values.push(id);
    const { rows } = await query(`update receitas set ${sets.join(', ')} where id = $${values.length} returning *`, values);
    if (!rows[0]) throw new HttpError(404, 'Receita não encontrada');
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    await query('delete from receitas where id = $1', [id]);
    res.status(204).end();
  })
);

module.exports = router;
