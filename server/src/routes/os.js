const router = require('express').Router();
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zIdOpt, zTextOpt, zDateOpt, buildUpdate, HttpError } = require('../util');
const { exigir } = require('../auth');

router.use(exigir('os.gerenciar'));

const STATUS = ['aberta', 'enviada_laboratorio', 'em_montagem', 'pronta', 'entregue', 'cancelada'];

router.get(
  '/',
  ah(async (req, res) => {
    const { status, cliente_id } = req.query;
    const where = [];
    const params = [];
    if (status === 'pendentes') where.push(`o.status in ('aberta','enviada_laboratorio','em_montagem','pronta')`);
    else if (status) {
      params.push(status);
      where.push(`o.status = $${params.length}`);
    }
    if (cliente_id) {
      params.push(cliente_id);
      where.push(`o.cliente_id = $${params.length}`);
    }
    const { rows } = await query(
      `select o.*, c.nome as cliente_nome, c.telefone as cliente_telefone, l.nome as laboratorio_nome,
              (o.previsao_entrega < current_date and o.status not in ('entregue','cancelada')) as atrasada
         from ordens_servico o
         join clientes c on c.id = o.cliente_id
         left join fornecedores l on l.id = o.laboratorio_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by o.previsao_entrega nulls last, o.id desc limit 500`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query(
      `select o.*, c.nome as cliente_nome, c.telefone as cliente_telefone, l.nome as laboratorio_nome
         from ordens_servico o join clientes c on c.id = o.cliente_id left join fornecedores l on l.id = o.laboratorio_id
        where o.id = $1`,
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'OS não encontrada');
    const [hist, receita] = await Promise.all([
      query(
        'select h.*, u.nome as usuario_nome from os_historico h left join usuarios u on u.id = h.usuario_id where os_id = $1 order by h.criado_em',
        [id]
      ),
      rows[0].receita_id ? query('select * from receitas where id = $1', [rows[0].receita_id]) : { rows: [] },
    ]);
    res.json({ ...rows[0], historico: hist.rows, receita: receita.rows[0] || null });
  })
);

const schema = z.object({
  cliente_id: zId,
  venda_id: zIdOpt,
  receita_id: zIdOpt,
  laboratorio_id: zIdOpt,
  descricao: zTextOpt,
  tipo_lente: zTextOpt,
  tratamentos: zTextOpt,
  previsao_entrega: zDateOpt,
  observacoes: zTextOpt,
});
const CAMPOS = Object.keys(schema.shape);

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, req.body);
    const os = await transaction(async (client) => {
      const { rows } = await client.query(
        `insert into ordens_servico (${CAMPOS.join(', ')}) values (${CAMPOS.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
        CAMPOS.map((c) => d[c] ?? null)
      );
      await client.query('insert into os_historico (os_id, status, observacao, usuario_id) values ($1,$2,$3,$4)', [
        rows[0].id,
        'aberta',
        'OS criada',
        req.usuario.id,
      ]);
      return rows[0];
    });
    res.status(201).json(os);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.omit({ cliente_id: true, venda_id: true }).partial(), req.body);
    const { sets, values } = buildUpdate(d, CAMPOS);
    if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
    values.push(id);
    const { rows } = await query(
      `update ordens_servico set ${sets.join(', ')}, atualizado_em = now() where id = $${values.length} returning *`,
      values
    );
    if (!rows[0]) throw new HttpError(404, 'OS não encontrada');
    res.json(rows[0]);
  })
);

router.post(
  '/:id/status',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(z.object({ status: z.enum(STATUS), observacao: zTextOpt }), req.body);
    const os = await transaction(async (client) => {
      const { rows } = await client.query(
        `update ordens_servico set status = $1, atualizado_em = now(),
                entregue_em = case when $1 = 'entregue' then now() else entregue_em end
          where id = $2 returning *`,
        [d.status, id]
      );
      if (!rows[0]) throw new HttpError(404, 'OS não encontrada');
      await client.query('insert into os_historico (os_id, status, observacao, usuario_id) values ($1,$2,$3,$4)', [
        id,
        d.status,
        d.observacao ?? null,
        req.usuario.id,
      ]);
      return rows[0];
    });
    res.json(os);
  })
);

module.exports = router;
