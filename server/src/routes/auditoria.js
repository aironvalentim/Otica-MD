const router = require('express').Router();
const { query } = require('../db');
const { ah } = require('../util');
const { exigir } = require('../auth');

router.use(exigir('auditoria.ver'));

// Quem aparece no log (para o filtro), inclusive usuários já desativados
router.get(
  '/usuarios',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select distinct on (usuario_id) usuario_id as id, usuario_nome as nome
         from auditoria where usuario_id is not null order by usuario_id, criado_em desc`
    );
    res.json(rows.sort((a, b) => a.nome.localeCompare(b.nome)));
  })
);

router.get(
  '/',
  ah(async (req, res) => {
    const { usuario_id, acao, de, ate, busca } = req.query;
    const where = [];
    const params = [];
    const add = (sql, v) => where.push(sql.replace('?', `$${params.push(v)}`));
    if (usuario_id) add('a.usuario_id = ?', usuario_id);
    if (acao) add('a.acao = ?', acao);
    if (de) add('a.criado_em >= ?::date', de);
    if (ate) add('a.criado_em < (?::date + 1)', ate);
    if (busca) {
      const n = params.push(`%${busca}%`);
      where.push(`(a.detalhes::text ilike $${n} or a.usuario_nome ilike $${n} or a.acao ilike $${n})`);
    }
    const { rows } = await query(
      `select a.* from auditoria a ${where.length ? 'where ' + where.join(' and ') : ''}
        order by a.criado_em desc, a.id desc limit 500`,
      params
    );
    res.json(rows);
  })
);

module.exports = router;
