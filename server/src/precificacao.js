// Regras de preço: markup por categoria + arredondamento "de vitrine"
const { round2 } = require('./util');

const CATEGORIAS = ['armacao', 'solar', 'lente', 'lente_contato', 'acessorio', 'servico'];

const PADRAO = {
  markup_armacao: 2.5,
  markup_solar: 2.5,
  markup_lente: 2.5,
  markup_lente_contato: 2,
  markup_acessorio: 2.5,
  markup_servico: 1,
  preco_arredondamento: 'x90',
};

// Modos de arredondamento (sempre para cima, para nunca vender abaixo da margem)
//  nenhum  -> 237,43
//  inteiro -> 238,00
//  x90     -> 237,90  (termina em ,90)
//  x99     -> 237,99
//  d90     -> 239,90  (termina em 9,90)
function arredondar(valor, modo) {
  const v = round2(valor);
  if (v <= 0) return 0;
  switch (modo) {
    case 'inteiro':
      return Math.ceil(v - 0.001);
    case 'x90':
      return round2(Math.ceil(round2(v - 0.9)) + 0.9);
    case 'x99':
      return round2(Math.ceil(round2(v - 0.99)) + 0.99);
    case 'd90':
      return round2(Math.ceil(round2((v + 0.1) / 10)) * 10 - 0.1);
    default:
      return v;
  }
}

async function carregarRegras(db) {
  const { rows } = await db.query(`select chave, valor from configuracoes where chave like 'markup_%' or chave = 'preco_arredondamento'`);
  const r = { ...PADRAO };
  for (const { chave, valor } of rows) {
    if (chave === 'preco_arredondamento') r[chave] = valor || 'nenhum';
    else {
      const n = parseFloat(String(valor).replace(',', '.'));
      if (Number.isFinite(n) && n > 0) r[chave] = n;
    }
  }
  return r;
}

function precoSugerido(custo, categoria, regras, markup) {
  const m = markup || regras[`markup_${categoria}`] || regras.markup_armacao;
  if (!custo || custo <= 0) return null;
  return arredondar(custo * m, regras.preco_arredondamento);
}

// Grava a mudança de preço no histórico (chamar dentro de transação)
async function registrarPreco(db, antes, depois, motivo, usuarioId) {
  const mudouVenda = round2(antes.preco_venda) !== round2(depois.preco_venda);
  const mudouPromo = (antes.preco_promocional ?? null) !== (depois.preco_promocional ?? null);
  const mudouCusto = round2(antes.preco_custo) !== round2(depois.preco_custo);
  if (!mudouVenda && !mudouPromo && !mudouCusto) return;
  await db.query(
    `insert into precos_historico
       (produto_id, custo_anterior, custo_novo, venda_anterior, venda_nova, promocional_anterior, promocional_novo, motivo, usuario_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      antes.id,
      antes.preco_custo,
      depois.preco_custo,
      antes.preco_venda,
      depois.preco_venda,
      antes.preco_promocional ?? null,
      depois.preco_promocional ?? null,
      motivo,
      usuarioId ?? null,
    ]
  );
}

module.exports = { CATEGORIAS, PADRAO, arredondar, carregarRegras, precoSugerido, registrarPreco };
