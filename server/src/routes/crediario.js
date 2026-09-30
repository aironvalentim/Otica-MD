const router = require('express').Router();
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zMoney, HttpError } = require('../util');
const { exigirCaixaAberto, lancar } = require('./caixa');
const { exigir } = require('../auth');
const { registrar } = require('../auditoria');

router.get(
  '/parcelas',
  exigir('crediario.receber', 'relatorios.financeiro'),
  ah(async (req, res) => {
    const { status = 'aberta', cliente_id, situacao } = req.query;
    const where = [];
    const params = [];
    if (status !== 'todas') {
      params.push(status);
      where.push(`p.status = $${params.length}`);
    }
    if (cliente_id) {
      params.push(cliente_id);
      where.push(`p.cliente_id = $${params.length}`);
    }
    if (situacao === 'atrasadas') where.push(`p.status = 'aberta' and p.vencimento < current_date`);
    if (situacao === 'semana') where.push(`p.status = 'aberta' and p.vencimento between current_date and current_date + 7`);
    const { rows } = await query(
      `select p.*, c.nome as cliente_nome, c.telefone as cliente_telefone,
              greatest(current_date - p.vencimento, 0) as dias_atraso
         from crediario_parcelas p join clientes c on c.id = p.cliente_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by p.vencimento, p.id limit 1000`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/resumo',
  exigir('relatorios.financeiro'),
  ah(async (_req, res) => {
    const { rows } = await query(
      `select
         coalesce(sum(valor) filter (where status = 'aberta'), 0) as a_receber,
         coalesce(sum(valor) filter (where status = 'aberta' and vencimento < current_date), 0) as atrasado,
         count(*) filter (where status = 'aberta' and vencimento < current_date)::int as parcelas_atrasadas,
         count(distinct cliente_id) filter (where status = 'aberta' and vencimento < current_date)::int as clientes_atrasados,
         coalesce(sum(valor_pago) filter (where status = 'paga' and pago_em >= date_trunc('month', now())), 0) as recebido_mes
       from crediario_parcelas`
    );
    res.json(rows[0]);
  })
);

router.post(
  '/parcelas/:id/pagar',
  exigir('crediario.receber'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(
      z.object({
        forma_pagamento: z.enum(['dinheiro', 'pix', 'debito', 'credito']),
        valor_pago: zMoney.optional(), // permite incluir juros/multa; padrão = valor da parcela
      }),
      req.body
    );
    const parcela = await transaction(async (client) => {
      const { rows } = await client.query('select * from crediario_parcelas where id = $1 for update', [id]);
      const p = rows[0];
      if (!p) throw new HttpError(404, 'Parcela não encontrada');
      if (p.status !== 'aberta') throw new HttpError(409, `Parcela já está ${p.status}`);
      const caixa = await exigirCaixaAberto(client);
      const valor = d.valor_pago ?? p.valor;
      const { rows: upd } = await client.query(
        `update crediario_parcelas set status = 'paga', pago_em = now(), valor_pago = $1, forma_pagamento = $2 where id = $3 returning *`,
        [valor, d.forma_pagamento, id]
      );
      await lancar(client, caixa.id, {
        tipo: 'recebimento_crediario',
        forma_pagamento: d.forma_pagamento,
        valor,
        descricao: `Parcela ${p.numero}/${p.total_parcelas} da venda #${p.venda_id}`,
        venda_id: p.venda_id,
        parcela_id: p.id,
        usuario_id: req.usuario.id,
      });
      await registrar(client, req, 'parcela_recebida', {
        entidade: 'venda',
        entidadeId: p.venda_id,
        detalhes: { parcela: `${p.numero}/${p.total_parcelas}`, valor, forma: d.forma_pagamento },
      });
      return upd[0];
    });
    res.json(parcela);
  })
);

module.exports = router;
