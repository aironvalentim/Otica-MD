const router = require('express').Router();
const { query } = require('../db');
const { ah } = require('../util');

router.get(
  '/',
  ah(async (req, res) => {
    const [vendas, serie, os, cred, estoque, agend, lembretes, top, caixa] = await Promise.all([
      query(
        `select
           coalesce(sum(total) filter (where criado_em::date = current_date), 0) as hoje_total,
           count(*) filter (where criado_em::date = current_date)::int as hoje_qtd,
           coalesce(sum(total) filter (where criado_em >= date_trunc('month', now())), 0) as mes_total,
           count(*) filter (where criado_em >= date_trunc('month', now()))::int as mes_qtd,
           coalesce(sum(total) filter (where criado_em >= date_trunc('month', now()) - interval '1 month'
                                         and criado_em < date_trunc('month', now()) - interval '1 month' + (now() - date_trunc('month', now()))), 0) as mes_anterior_parcial
         from vendas where status = 'concluida'`
      ),
      query(
        `select d::date as dia, coalesce(sum(v.total), 0) as total, count(v.id)::int as qtd
           from generate_series(current_date - 29, current_date, interval '1 day') d
           left join vendas v on v.criado_em::date = d::date and v.status = 'concluida'
          group by d order by d`
      ),
      query(
        `select status, count(*)::int as qtd,
                count(*) filter (where previsao_entrega < current_date)::int as atrasadas
           from ordens_servico where status in ('aberta','enviada_laboratorio','em_montagem','pronta') group by status`
      ),
      query(
        `select coalesce(sum(valor) filter (where vencimento < current_date), 0) as atrasado,
                count(*) filter (where vencimento < current_date)::int as parcelas_atrasadas,
                coalesce(sum(valor) filter (where vencimento between current_date and current_date + 7), 0) as vence_semana,
                coalesce(sum(valor), 0) as a_receber
           from crediario_parcelas where status = 'aberta'`
      ),
      query(
        `select id, nome, cor, sku, estoque_atual, estoque_minimo from produtos
          where ativo and controla_estoque and estoque_atual <= estoque_minimo
          order by estoque_atual, nome limit 10`
      ),
      query(`select count(*)::int as novos from agendamentos where status = 'novo'`),
      query(
        `select count(*)::int as qtd from (
           select distinct on (cliente_id) cliente_id, data_receita from receitas order by cliente_id, data_receita desc
         ) r where r.data_receita <= current_date - 365`
      ),
      query(
        `select vi.descricao, sum(vi.quantidade)::int as qtd, sum(vi.total) as total,
                sum(vi.total - vi.custo_unitario * vi.quantidade) as margem
           from venda_itens vi join vendas v on v.id = vi.venda_id
          where v.status = 'concluida' and v.criado_em >= date_trunc('month', now())
          group by vi.descricao order by total desc limit 5`
      ),
      query(`select id, aberto_em from caixas where fechado_em is null`),
    ]);

    const m = vendas.rows[0];
    const custoMes = await query(
      `select coalesce(sum(vi.custo_unitario * vi.quantidade), 0) as custo
         from venda_itens vi join vendas v on v.id = vi.venda_id
        where v.status = 'concluida' and v.criado_em >= date_trunc('month', now())`
    );
    const pode = req.pode;
    const financeiro = pode('relatorios.financeiro');
    res.json({
      pode_financeiro: financeiro,
      vendas: !financeiro ? null : {
        ...m,
        ticket_medio_mes: m.mes_qtd ? m.mes_total / m.mes_qtd : 0,
        margem_bruta_mes: m.mes_total - custoMes.rows[0].custo,
      },
      serie_30_dias: financeiro ? serie.rows : null,
      os_por_status: pode('os.gerenciar') ? os.rows : null,
      crediario: financeiro || pode('crediario.receber') ? cred.rows[0] : null,
      estoque_baixo: pode('estoque.movimentar') || pode('produtos.editar') ? estoque.rows : null,
      agendamentos_novos: pode('agendamentos.gerenciar') ? agend.rows[0].novos : null,
      lembretes_troca: pode('clientes.gerenciar') ? lembretes.rows[0].qtd : null,
      mais_vendidos_mes: financeiro ? top.rows : null,
      caixa_aberto: caixa.rows[0] || null,
    });
  })
);

module.exports = router;
