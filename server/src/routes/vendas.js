const router = require('express').Router();
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zIdOpt, zMoney, zTextOpt, zDateOpt, round2, hoje, HttpError } = require('../util');
const { registrarMovimentacao } = require('./estoque');
const { exigirCaixaAberto, lancar } = require('./caixa');
const { exigir } = require('../auth');
const { registrar } = require('../auditoria');

const FORMAS = ['dinheiro', 'pix', 'debito', 'credito', 'crediario'];

// Soma meses mantendo o dia (31/jan + 1 mês = 28 ou 29/fev)
function somarMeses(iso, meses) {
  const [a, m, d] = iso.split('-').map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

const schemaVenda = z.object({
  cliente_id: zIdOpt,
  receita_id: zIdOpt,
  desconto: zMoney.default(0),
  observacoes: zTextOpt,
  itens: z
    .array(
      z.object({
        produto_id: zIdOpt,
        descricao: zTextOpt,
        quantidade: z.coerce.number().int().positive(),
        preco_unitario: zMoney,
      })
    )
    .min(1, 'Adicione pelo menos um item'),
  pagamentos: z
    .array(
      z.object({
        forma: z.enum(FORMAS),
        valor: zMoney.refine((v) => v > 0, 'Valor do pagamento deve ser maior que zero'),
        parcelas: z.coerce.number().int().min(1).max(24).default(1),
        primeiro_vencimento: zDateOpt,
      })
    )
    .min(1, 'Informe a forma de pagamento'),
  ordem_servico: z
    .object({
      laboratorio_id: zIdOpt,
      tipo_lente: zTextOpt,
      tratamentos: zTextOpt,
      previsao_entrega: zDateOpt,
      descricao: zTextOpt,
    })
    .nullable()
    .optional(),
});

router.post(
  '/',
  exigir('vendas.criar'),
  ah(async (req, res) => {
    const d = parse(schemaVenda, req.body);
    const usa = (f) => d.pagamentos.some((p) => p.forma === f);
    if ((usa('crediario') || d.ordem_servico) && !d.cliente_id) {
      throw new HttpError(400, 'Selecione o cliente para vender no crediário ou abrir ordem de serviço');
    }

    const venda = await transaction(async (client) => {
      const caixa = await exigirCaixaAberto(client);

      // Monta itens a partir do cadastro (preço informado pode ter sido ajustado no PDV)
      const itens = [];
      let valorTabela = 0; // soma pelo preço de etiqueta (base do limite de desconto)
      let descontoNosItens = 0; // preço reduzido item a item no PDV
      for (const item of d.itens) {
        let descricao = item.descricao;
        let custo = 0;
        let precoTabela = item.preco_unitario;
        if (item.produto_id) {
          const { rows } = await client.query(
            'select nome, cor, preco_custo, preco_venda, preco_promocional, ativo from produtos where id = $1',
            [item.produto_id]
          );
          if (!rows[0]) throw new HttpError(404, `Produto ${item.produto_id} não encontrado`);
          descricao = descricao || [rows[0].nome, rows[0].cor].filter(Boolean).join(' - ');
          custo = rows[0].preco_custo;
          precoTabela = rows[0].preco_promocional > 0 ? rows[0].preco_promocional : rows[0].preco_venda;
        }
        if (!descricao) throw new HttpError(400, 'Item avulso precisa de descrição');
        valorTabela += item.quantidade * precoTabela;
        descontoNosItens += Math.max(0, precoTabela - item.preco_unitario) * item.quantidade;
        itens.push({ ...item, descricao, custo, total: round2(item.quantidade * item.preco_unitario) });
      }

      const subtotal = round2(itens.reduce((s, i) => s + i.total, 0));
      if (d.desconto > subtotal) throw new HttpError(400, 'Desconto maior que o valor da venda');

      // Limite de desconto do perfil (desconto no total + preço reduzido nos itens)
      const descontoTotal = round2(d.desconto + descontoNosItens);
      const pctDesconto = valorTabela > 0 ? (descontoTotal / valorTabela) * 100 : 0;
      const limite = Number(req.usuario.desconto_max_pct);
      if (pctDesconto > limite + 0.001) {
        throw new HttpError(
          403,
          `Desconto de ${pctDesconto.toFixed(1).replace('.', ',')}% acima do seu limite de ${String(limite).replace('.', ',')}%. Peça a um gerente para finalizar esta venda`
        );
      }
      const total = round2(subtotal - d.desconto);
      const pago = round2(d.pagamentos.reduce((s, p) => s + p.valor, 0));
      if (Math.abs(pago - total) > 0.009) {
        throw new HttpError(400, `A soma dos pagamentos (R$ ${pago.toFixed(2)}) difere do total (R$ ${total.toFixed(2)})`);
      }

      const { rows: vRows } = await client.query(
        `insert into vendas (cliente_id, receita_id, vendedor_id, caixa_id, subtotal, desconto, total, observacoes)
         values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
        [d.cliente_id ?? null, d.receita_id ?? null, req.usuario.id, caixa.id, subtotal, d.desconto, total, d.observacoes ?? null]
      );
      const v = vRows[0];

      for (const i of itens) {
        await client.query(
          `insert into venda_itens (venda_id, produto_id, descricao, quantidade, preco_unitario, custo_unitario, total)
           values ($1,$2,$3,$4,$5,$6,$7)`,
          [v.id, i.produto_id ?? null, i.descricao, i.quantidade, i.preco_unitario, i.custo, i.total]
        );
        if (i.produto_id) {
          await registrarMovimentacao(client, {
            produto_id: i.produto_id,
            tipo: 'saida',
            motivo: 'venda',
            quantidade: i.quantidade,
            venda_id: v.id,
            observacao: `Venda #${v.id}`,
            usuario_id: req.usuario.id,
          });
        }
      }

      const dataHoje = hoje();
      for (const p of d.pagamentos) {
        await client.query('insert into venda_pagamentos (venda_id, forma, valor, parcelas) values ($1,$2,$3,$4)', [
          v.id,
          p.forma,
          p.valor,
          p.parcelas,
        ]);
        if (p.forma === 'crediario') {
          // Divide em parcelas; a última absorve a diferença de centavos
          const base = Math.floor((p.valor / p.parcelas) * 100) / 100;
          const primeiro = p.primeiro_vencimento || somarMeses(dataHoje, 1);
          for (let n = 1; n <= p.parcelas; n++) {
            const valor = n === p.parcelas ? round2(p.valor - base * (p.parcelas - 1)) : base;
            await client.query(
              `insert into crediario_parcelas (venda_id, cliente_id, numero, total_parcelas, valor, vencimento)
               values ($1,$2,$3,$4,$5,$6)`,
              [v.id, d.cliente_id, n, p.parcelas, valor, somarMeses(primeiro, n - 1)]
            );
          }
        } else {
          await lancar(client, caixa.id, {
            tipo: 'venda',
            forma_pagamento: p.forma,
            valor: p.valor,
            descricao: `Venda #${v.id}${p.forma === 'credito' && p.parcelas > 1 ? ` (${p.parcelas}x)` : ''}`,
            venda_id: v.id,
            usuario_id: req.usuario.id,
          });
        }
      }

      if (d.ordem_servico) {
        const os = d.ordem_servico;
        const { rows: osRows } = await client.query(
          `insert into ordens_servico (venda_id, cliente_id, receita_id, laboratorio_id, descricao, tipo_lente, tratamentos, previsao_entrega)
           values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [
            v.id,
            d.cliente_id,
            d.receita_id ?? null,
            os.laboratorio_id ?? null,
            os.descricao || itens.map((i) => i.descricao).join(', '),
            os.tipo_lente ?? null,
            os.tratamentos ?? null,
            os.previsao_entrega ?? null,
          ]
        );
        await client.query('insert into os_historico (os_id, status, observacao, usuario_id) values ($1,$2,$3,$4)', [
          osRows[0].id,
          'aberta',
          `Aberta pela venda #${v.id}`,
          req.usuario.id,
        ]);
        v.os_id = osRows[0].id;
      }
      await registrar(client, req, 'venda_criada', {
        entidade: 'venda',
        entidadeId: v.id,
        detalhes: {
          total,
          desconto: descontoTotal,
          desconto_pct: Math.round(pctDesconto * 10) / 10,
          formas: d.pagamentos.map((p) => p.forma),
        },
      });
      return v;
    });

    res.status(201).json(venda);
  })
);

router.get(
  '/',
  exigir('vendas.ver'),
  ah(async (req, res) => {
    const { de, ate, cliente_id, status } = req.query;
    const where = [];
    const params = [];
    if (de) {
      params.push(de);
      where.push(`v.criado_em >= $${params.length}::date`);
    }
    if (ate) {
      params.push(ate);
      where.push(`v.criado_em < ($${params.length}::date + 1)`);
    }
    if (cliente_id) {
      params.push(cliente_id);
      where.push(`v.cliente_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`v.status = $${params.length}`);
    }
    const { rows } = await query(
      `select v.*, c.nome as cliente_nome, u.nome as vendedor_nome,
              (select string_agg(distinct forma, ', ') from venda_pagamentos p where p.venda_id = v.id) as formas
         from vendas v
         left join clientes c on c.id = v.cliente_id
         left join usuarios u on u.id = v.vendedor_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by v.criado_em desc limit 500`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  exigir('vendas.ver', 'vendas.criar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query(
      `select v.*, c.nome as cliente_nome, c.telefone as cliente_telefone, c.cpf as cliente_cpf, u.nome as vendedor_nome
         from vendas v left join clientes c on c.id = v.cliente_id left join usuarios u on u.id = v.vendedor_id
        where v.id = $1`,
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'Venda não encontrada');
    const [itens, pagamentos, parcelas, os] = await Promise.all([
      query('select * from venda_itens where venda_id = $1 order by id', [id]),
      query('select * from venda_pagamentos where venda_id = $1 order by id', [id]),
      query('select * from crediario_parcelas where venda_id = $1 order by numero', [id]),
      query('select id, status from ordens_servico where venda_id = $1', [id]),
    ]);
    res.json({ ...rows[0], itens: itens.rows, pagamentos: pagamentos.rows, parcelas: parcelas.rows, ordens_servico: os.rows });
  })
);

// Cancela a venda: devolve estoque, estorna no caixa aberto e cancela parcelas/OS
router.post(
  '/:id/cancelar',
  exigir('vendas.cancelar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { motivo } = parse(z.object({ motivo: z.string().trim().min(3, 'Informe o motivo do cancelamento') }), req.body);

    await transaction(async (client) => {
      const { rows } = await client.query('select * from vendas where id = $1 for update', [id]);
      const v = rows[0];
      if (!v) throw new HttpError(404, 'Venda não encontrada');
      if (v.status === 'cancelada') throw new HttpError(409, 'Venda já cancelada');
      const caixa = await exigirCaixaAberto(client);

      const { rows: itens } = await client.query('select * from venda_itens where venda_id = $1 and produto_id is not null', [id]);
      for (const i of itens) {
        await registrarMovimentacao(client, {
          produto_id: i.produto_id,
          tipo: 'entrada',
          motivo: 'cancelamento_venda',
          quantidade: i.quantidade,
          venda_id: id,
          observacao: `Cancelamento da venda #${id}: ${motivo}`,
          usuario_id: req.usuario.id,
        });
      }

      const { rows: pags } = await client.query(`select * from venda_pagamentos where venda_id = $1 and forma <> 'crediario'`, [id]);
      for (const p of pags) {
        await lancar(client, caixa.id, {
          tipo: 'estorno',
          forma_pagamento: p.forma,
          valor: -p.valor,
          descricao: `Estorno da venda #${id}`,
          venda_id: id,
          usuario_id: req.usuario.id,
        });
      }

      const { rows: pagas } = await client.query(`select * from crediario_parcelas where venda_id = $1 and status = 'paga'`, [id]);
      for (const p of pagas) {
        await lancar(client, caixa.id, {
          tipo: 'estorno',
          forma_pagamento: p.forma_pagamento || 'dinheiro',
          valor: -p.valor_pago,
          descricao: `Estorno da parcela ${p.numero}/${p.total_parcelas} da venda #${id}`,
          venda_id: id,
          parcela_id: p.id,
          usuario_id: req.usuario.id,
        });
      }
      await client.query(`update crediario_parcelas set status = 'cancelada' where venda_id = $1`, [id]);
      await client.query(`update ordens_servico set status = 'cancelada', atualizado_em = now() where venda_id = $1 and status <> 'entregue'`, [id]);
      await client.query(
        `update vendas set status = 'cancelada', cancelada_em = now(),
                observacoes = trim(both from coalesce(observacoes, '') || ' [Cancelada: ' || $2 || ']')
          where id = $1`,
        [id, motivo]
      );
      await registrar(client, req, 'venda_cancelada', { entidade: 'venda', entidadeId: id, detalhes: { total: v.total, motivo } });
    });
    res.json({ ok: true });
  })
);

module.exports = router;
module.exports.somarMeses = somarMeses;
