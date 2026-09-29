const router = require('express').Router();
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zIdOpt, zMoney, zTextOpt, round2, HttpError } = require('../util');

/**
 * Registra uma movimentação e atualiza o estoque do produto.
 * Deve ser chamada dentro de uma transação (client).
 *  - entrada: soma a quantidade; se vier custo, recalcula o custo médio ponderado
 *  - saida:   subtrai a quantidade; bloqueia estoque negativo
 *  - ajuste:  define o estoque para `novo_estoque` (inventário)
 */
async function registrarMovimentacao(client, mov) {
  const { rows } = await client.query('select id, nome, estoque_atual, preco_custo, controla_estoque from produtos where id = $1 for update', [
    mov.produto_id,
  ]);
  const p = rows[0];
  if (!p) throw new HttpError(404, `Produto ${mov.produto_id} não encontrado`);
  if (!p.controla_estoque) return null;

  const anterior = p.estoque_atual;
  let posterior;
  let quantidade = mov.quantidade;
  let tipo = mov.tipo;

  if (tipo === 'entrada') {
    posterior = anterior + quantidade;
  } else if (tipo === 'saida') {
    posterior = anterior - quantidade;
    if (posterior < 0) {
      throw new HttpError(409, `Estoque insuficiente de "${p.nome}": disponível ${anterior}, pedido ${quantidade}`);
    }
  } else if (tipo === 'ajuste') {
    posterior = mov.novo_estoque;
    quantidade = Math.abs(posterior - anterior);
    if (quantidade === 0) return null;
  } else {
    throw new HttpError(400, 'Tipo de movimentação inválido');
  }

  let novoCusto = p.preco_custo;
  if (tipo === 'entrada' && mov.custo_unitario != null && mov.custo_unitario > 0) {
    const base = Math.max(anterior, 0);
    novoCusto = base + quantidade > 0 ? round2((base * p.preco_custo + quantidade * mov.custo_unitario) / (base + quantidade)) : mov.custo_unitario;
  }

  await client.query('update produtos set estoque_atual = $1, preco_custo = $2, atualizado_em = now() where id = $3', [posterior, novoCusto, p.id]);

  const { rows: movRows } = await client.query(
    `insert into movimentacoes_estoque
       (produto_id, tipo, motivo, quantidade, custo_unitario, estoque_anterior, estoque_posterior, fornecedor_id, venda_id, documento, observacao, usuario_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
    [
      p.id,
      tipo,
      mov.motivo,
      quantidade,
      mov.custo_unitario ?? null,
      anterior,
      posterior,
      mov.fornecedor_id ?? null,
      mov.venda_id ?? null,
      mov.documento ?? null,
      mov.observacao ?? null,
      mov.usuario_id ?? null,
    ]
  );
  return movRows[0];
}

router.get(
  '/movimentacoes',
  ah(async (req, res) => {
    const { produto_id, tipo, de, ate } = req.query;
    const where = [];
    const params = [];
    if (produto_id) {
      params.push(produto_id);
      where.push(`m.produto_id = $${params.length}`);
    }
    if (tipo) {
      params.push(tipo);
      where.push(`m.tipo = $${params.length}`);
    }
    if (de) {
      params.push(de);
      where.push(`m.criado_em >= $${params.length}::date`);
    }
    if (ate) {
      params.push(ate);
      where.push(`m.criado_em < ($${params.length}::date + 1)`);
    }
    const { rows } = await query(
      `select m.*, p.nome as produto_nome, p.sku, f.nome as fornecedor_nome, u.nome as usuario_nome
         from movimentacoes_estoque m
         join produtos p on p.id = m.produto_id
         left join fornecedores f on f.id = m.fornecedor_id
         left join usuarios u on u.id = m.usuario_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by m.criado_em desc, m.id desc
        limit 500`,
      params
    );
    res.json(rows);
  })
);

const MOTIVOS_ENTRADA = ['compra', 'devolucao_cliente', 'inventario', 'outro'];
const MOTIVOS_SAIDA = ['devolucao_fornecedor', 'perda', 'uso_interno', 'outro'];

const schemaMov = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('entrada'),
    produto_id: zId,
    motivo: z.enum(MOTIVOS_ENTRADA),
    quantidade: z.coerce.number().int().positive(),
    custo_unitario: zMoney.nullable().optional(),
    fornecedor_id: zIdOpt,
    documento: zTextOpt,
    observacao: zTextOpt,
  }),
  z.object({
    tipo: z.literal('saida'),
    produto_id: zId,
    motivo: z.enum(MOTIVOS_SAIDA),
    quantidade: z.coerce.number().int().positive(),
    fornecedor_id: zIdOpt,
    documento: zTextOpt,
    observacao: zTextOpt,
  }),
  z.object({
    tipo: z.literal('ajuste'),
    produto_id: zId,
    novo_estoque: z.coerce.number().int().min(0),
    observacao: zTextOpt,
  }),
]);

router.post(
  '/movimentacoes',
  ah(async (req, res) => {
    const d = parse(schemaMov, req.body);
    const mov = await transaction((client) =>
      registrarMovimentacao(client, {
        ...d,
        motivo: d.tipo === 'ajuste' ? 'inventario' : d.motivo,
        usuario_id: req.usuario.id,
      })
    );
    if (!mov) return res.json({ aviso: 'Nenhuma alteração (produto sem controle de estoque ou quantidade igual)' });
    res.status(201).json(mov);
  })
);

// Entrada de nota de compra com vários itens de uma vez
router.post(
  '/entrada-lote',
  ah(async (req, res) => {
    const d = parse(
      z.object({
        fornecedor_id: zIdOpt,
        documento: zTextOpt,
        observacao: zTextOpt,
        itens: z
          .array(z.object({ produto_id: zId, quantidade: z.coerce.number().int().positive(), custo_unitario: zMoney.nullable().optional() }))
          .min(1),
      }),
      req.body
    );
    const movs = await transaction(async (client) => {
      const out = [];
      for (const item of d.itens) {
        out.push(
          await registrarMovimentacao(client, {
            ...item,
            tipo: 'entrada',
            motivo: 'compra',
            fornecedor_id: d.fornecedor_id,
            documento: d.documento,
            observacao: d.observacao,
            usuario_id: req.usuario.id,
          })
        );
      }
      return out.filter(Boolean);
    });
    res.status(201).json(movs);
  })
);

// Valor do estoque (custo e venda) por categoria
router.get(
  '/resumo',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select categoria,
              count(*)::int as produtos,
              coalesce(sum(estoque_atual),0)::int as unidades,
              coalesce(sum(estoque_atual * preco_custo),0) as valor_custo,
              coalesce(sum(estoque_atual * coalesce(preco_promocional, preco_venda)),0) as valor_venda
         from produtos where ativo and controla_estoque
        group by categoria order by categoria`
    );
    res.json(rows);
  })
);

module.exports = router;
module.exports.registrarMovimentacao = registrarMovimentacao;
