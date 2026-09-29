// Mesmas regras de preço do servidor (src/precificacao.js), para mostrar a sugestão na hora
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const ARREDONDAMENTOS = {
  nenhum: 'Sem arredondar (237,43)',
  inteiro: 'Real inteiro (238,00)',
  x90: 'Terminar em ,90 (237,90)',
  x99: 'Terminar em ,99 (237,99)',
  d90: 'Terminar em 9,90 (239,90)',
};

export function arredondar(valor, modo) {
  const v = r2(valor);
  if (v <= 0) return 0;
  switch (modo) {
    case 'inteiro':
      return Math.ceil(v - 0.001);
    case 'x90':
      return r2(Math.ceil(r2(v - 0.9)) + 0.9);
    case 'x99':
      return r2(Math.ceil(r2(v - 0.99)) + 0.99);
    case 'd90':
      return r2(Math.ceil(r2((v + 0.1) / 10)) * 10 - 0.1);
    default:
      return v;
  }
}

export function markupDe(config, categoria) {
  const n = parseFloat(String(config?.[`markup_${categoria}`] ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function precoSugerido(custo, categoria, config) {
  const m = markupDe(config, categoria);
  const c = Number(custo);
  if (!m || !c || c <= 0) return null;
  return arredondar(c * m, config?.preco_arredondamento || 'nenhum');
}

// Margem sobre o preço de venda, em %
export function margem(custo, venda) {
  const v = Number(venda);
  if (!v) return null;
  return Math.round((1 - Number(custo || 0) / v) * 100);
}
