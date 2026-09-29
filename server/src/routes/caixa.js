const router = require('express').Router();
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zMoney, zTextOpt, round2, HttpError } = require('../util');

// Retorna o caixa aberto (travado para a transação) ou lança erro
async function exigirCaixaAberto(client) {
  const { rows } = await client.query('select * from caixas where fechado_em is null for update');
  if (!rows[0]) throw new HttpError(409, 'Abra o caixa antes de registrar vendas ou recebimentos');
  return rows[0];
}

async function lancar(client, caixaId, l) {
  await client.query(
    `insert into caixa_lancamentos (caixa_id, tipo, forma_pagamento, valor, descricao, venda_id, parcela_id, usuario_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [caixaId, l.tipo, l.forma_pagamento, round2(l.valor), l.descricao ?? null, l.venda_id ?? null, l.parcela_id ?? null, l.usuario_id ?? null]
  );
}

async function resumoCaixa(db, caixa) {
  const { rows: lanc } = await db.query(
    `select l.*, u.nome as usuario_nome from caixa_lancamentos l left join usuarios u on u.id = l.usuario_id
      where l.caixa_id = $1 order by l.criado_em desc, l.id desc`,
    [caixa.id]
  );
  const porForma = { dinheiro: 0, pix: 0, debito: 0, credito: 0 };
  for (const l of lanc) {
    if (porForma[l.forma_pagamento] !== undefined) porForma[l.forma_pagamento] = round2(porForma[l.forma_pagamento] + l.valor);
  }
  const vendas = lanc.filter((l) => l.tipo === 'venda').reduce((s, l) => s + l.valor, 0);
  return {
    ...caixa,
    lancamentos: lanc,
    por_forma: porForma,
    total_vendas: round2(vendas),
    dinheiro_esperado: round2(caixa.valor_abertura + porForma.dinheiro),
  };
}

router.get(
  '/atual',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select c.*, u.nome as aberto_por_nome from caixas c left join usuarios u on u.id = c.aberto_por where c.fechado_em is null`
    );
    if (!rows[0]) return res.json(null);
    res.json(await resumoCaixa({ query }, rows[0]));
  })
);

router.get(
  '/',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select c.*, a.nome as aberto_por_nome, f.nome as fechado_por_nome,
              (select coalesce(sum(valor),0) from caixa_lancamentos l where l.caixa_id = c.id and l.tipo = 'venda') as total_vendas
         from caixas c
         left join usuarios a on a.id = c.aberto_por
         left join usuarios f on f.id = c.fechado_por
        order by c.aberto_em desc limit 60`
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query('select * from caixas where id = $1', [id]);
    if (!rows[0]) throw new HttpError(404, 'Caixa não encontrado');
    res.json(await resumoCaixa({ query }, rows[0]));
  })
);

router.post(
  '/abrir',
  ah(async (req, res) => {
    const d = parse(z.object({ valor_abertura: zMoney.default(0), observacoes: zTextOpt }), req.body);
    const { rows: aberto } = await query('select id from caixas where fechado_em is null');
    if (aberto[0]) throw new HttpError(409, 'Já existe um caixa aberto');
    const { rows } = await query('insert into caixas (aberto_por, valor_abertura, observacoes) values ($1,$2,$3) returning *', [
      req.usuario.id,
      d.valor_abertura,
      d.observacoes ?? null,
    ]);
    res.status(201).json(rows[0]);
  })
);

// Suprimento (entrada de troco) e sangria (retirada de dinheiro)
router.post(
  '/lancamentos',
  ah(async (req, res) => {
    const d = parse(
      z.object({ tipo: z.enum(['suprimento', 'sangria']), valor: zMoney.refine((v) => v > 0, 'Valor deve ser maior que zero'), descricao: zTextOpt }),
      req.body
    );
    await transaction(async (client) => {
      const caixa = await exigirCaixaAberto(client);
      await lancar(client, caixa.id, {
        tipo: d.tipo,
        forma_pagamento: 'dinheiro',
        valor: d.tipo === 'sangria' ? -d.valor : d.valor,
        descricao: d.descricao,
        usuario_id: req.usuario.id,
      });
    });
    res.status(201).json({ ok: true });
  })
);

router.post(
  '/fechar',
  ah(async (req, res) => {
    const d = parse(z.object({ valor_informado: zMoney, observacoes: zTextOpt }), req.body);
    const fechado = await transaction(async (client) => {
      const caixa = await exigirCaixaAberto(client);
      const resumo = await resumoCaixa(client, caixa);
      const { rows } = await client.query(
        `update caixas set fechado_em = now(), fechado_por = $1, valor_fechamento_informado = $2, valor_fechamento_calculado = $3,
                observacoes = coalesce($4, observacoes)
          where id = $5 returning *`,
        [req.usuario.id, d.valor_informado, resumo.dinheiro_esperado, d.observacoes ?? null, caixa.id]
      );
      return { ...rows[0], diferenca: round2(d.valor_informado - resumo.dinheiro_esperado) };
    });
    res.json(fechado);
  })
);

module.exports = router;
module.exports.exigirCaixaAberto = exigirCaixaAberto;
module.exports.lancar = lancar;
