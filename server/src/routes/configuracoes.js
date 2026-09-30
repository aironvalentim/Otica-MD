const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z } = require('../util');
const { exigir } = require('../auth');
const { registrar } = require('../auditoria');

router.get(
  '/',
  ah(async (_req, res) => {
    const { rows } = await query('select chave, valor from configuracoes order by chave');
    res.json(Object.fromEntries(rows.map((r) => [r.chave, r.valor])));
  })
);

router.put(
  '/',
  exigir('config.loja'),
  ah(async (req, res) => {
    const d = parse(z.record(z.string().regex(/^[a-z_]+$/), z.string().max(500)), req.body);
    for (const [chave, valor] of Object.entries(d)) {
      await query(
        'insert into configuracoes (chave, valor) values ($1,$2) on conflict (chave) do update set valor = excluded.valor',
        [chave, valor]
      );
    }
    await registrar({ query }, req, 'configuracoes_alteradas', { detalhes: d });
    res.json({ ok: true });
  })
);

module.exports = router;
