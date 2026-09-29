const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z, zId, zIdOpt, HttpError } = require('../util');

router.get(
  '/',
  ah(async (req, res) => {
    const params = [];
    let where = '';
    if (req.query.status) {
      params.push(req.query.status);
      where = 'where a.status = $1';
    }
    const { rows } = await query(
      `select a.*, c.nome as cliente_nome from agendamentos a left join clientes c on c.id = a.cliente_id ${where}
        order by (a.status = 'novo') desc, a.data_preferida nulls last, a.criado_em desc limit 300`,
      params
    );
    res.json(rows);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(z.object({ status: z.enum(['novo', 'confirmado', 'realizado', 'cancelado']).optional(), cliente_id: zIdOpt }), req.body);
    const { rows } = await query(
      'update agendamentos set status = coalesce($1, status), cliente_id = coalesce($2, cliente_id) where id = $3 returning *',
      [d.status ?? null, d.cliente_id ?? null, id]
    );
    if (!rows[0]) throw new HttpError(404, 'Agendamento não encontrado');
    res.json(rows[0]);
  })
);

module.exports = router;
