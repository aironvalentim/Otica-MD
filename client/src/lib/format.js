const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const moeda = (v) => moedaFmt.format(Number(v) || 0);

// 'AAAA-MM-DD' -> 'DD/MM/AAAA' sem mexer em fuso
export function data(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [a, m, d] = s.split('-');
    return `${d}/${m}/${a}`;
  }
  return new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Recife' });
}

export const dataHora = (v) =>
  v ? new Date(v).toLocaleString('pt-BR', { timeZone: 'America/Recife', dateStyle: 'short', timeStyle: 'short' }) : '—';

export const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife' }).format(new Date());

export function telefone(v) {
  const d = String(v || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v || '—';
}

export function cpf(v) {
  const d = String(v || '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v || '—';
}

// Grau com sinal: -1.25 -> "-1,25", 2 -> "+2,00"
export function grau(v) {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  return (n > 0 ? '+' : '') + n.toFixed(2).replace('.', ',');
}

// Link de WhatsApp com mensagem pronta
export function linkWhatsApp(numero, mensagem) {
  let d = String(numero || '').replace(/\D/g, '');
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}${mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''}`;
}

export const CATEGORIAS = {
  armacao: 'Armações',
  solar: 'Óculos de sol',
  lente: 'Lentes',
  lente_contato: 'Lentes de contato',
  acessorio: 'Acessórios',
  servico: 'Serviços',
};

export const CATEGORIA_SING = {
  armacao: 'Armação',
  solar: 'Óculos de sol',
  lente: 'Lente',
  lente_contato: 'Lente de contato',
  acessorio: 'Acessório',
  servico: 'Serviço',
};

export const GENEROS = { feminino: 'Feminino', masculino: 'Masculino', unissex: 'Unissex', infantil: 'Infantil' };

export const FORMATOS = ['redondo', 'quadrado', 'retangular', 'gatinho', 'aviador', 'hexagonal', 'oval'];
export const MATERIAIS = ['acetato', 'metal', 'titânio', 'TR90', 'misto'];

export const FORMAS_PAGAMENTO = { dinheiro: 'Dinheiro', pix: 'Pix', debito: 'Débito', credito: 'Crédito', crediario: 'Crediário' };

export const STATUS_OS = {
  aberta: { label: 'Aberta', cor: 'slate' },
  enviada_laboratorio: { label: 'No laboratório', cor: 'blue' },
  em_montagem: { label: 'Em montagem', cor: 'amber' },
  pronta: { label: 'Pronta p/ retirar', cor: 'green' },
  entregue: { label: 'Entregue', cor: 'zinc' },
  cancelada: { label: 'Cancelada', cor: 'red' },
};

export const MOTIVOS_MOV = {
  compra: 'Compra',
  venda: 'Venda',
  devolucao_cliente: 'Devolução de cliente',
  devolucao_fornecedor: 'Devolução ao fornecedor',
  perda: 'Perda / quebra',
  uso_interno: 'Uso interno',
  inventario: 'Inventário',
  cancelamento_venda: 'Cancelamento de venda',
  outro: 'Outro',
};

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export const precoFinal = (p) => (p.preco_promocional != null && p.preco_promocional > 0 ? p.preco_promocional : p.preco_venda);
