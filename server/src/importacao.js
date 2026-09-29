// Importação de produtos por planilha (.xlsx ou .csv)
const ExcelJS = require('exceljs');
const { HttpError, round2 } = require('./util');

// Colunas da planilha modelo: [chave, título, largura, exemplo]
const COLUNAS = [
  ['sku', 'Código (SKU)', 16, 'AU-01-TART'],
  ['nome', 'Nome *', 28, 'Armação Aurora'],
  ['categoria', 'Categoria *', 16, 'Armação'],
  ['marca', 'Marca', 16, 'MD Collection'],
  ['modelo', 'Modelo', 12, 'AU-01'],
  ['cor', 'Cor', 16, 'Tartaruga'],
  ['genero', 'Público', 12, 'Feminino'],
  ['formato', 'Formato', 12, 'Gatinho'],
  ['material', 'Material', 12, 'Acetato'],
  ['largura_lente', 'Lente (mm)', 10, 52],
  ['ponte', 'Ponte (mm)', 10, 18],
  ['haste', 'Haste (mm)', 10, 140],
  ['preco_custo', 'Custo (R$)', 12, 95],
  ['preco_venda', 'Preço de venda (R$)', 18, ''],
  ['preco_promocional', 'Preço promocional (R$)', 20, ''],
  ['quantidade', 'Quantidade', 11, 3],
  ['estoque_minimo', 'Estoque mínimo', 14, 1],
  ['controla_estoque', 'Controla estoque', 15, 'Sim'],
  ['publicado', 'Mostrar no site', 14, 'Sim'],
  ['destaque', 'Destaque', 10, 'Não'],
  ['descricao', 'Descrição', 40, 'Leve e confortável, pronta para lentes de grau.'],
];

const CATEGORIAS = {
  armacao: 'armacao', armacoes: 'armacao', 'armacao de grau': 'armacao', grau: 'armacao', 'oculos de grau': 'armacao',
  solar: 'solar', sol: 'solar', 'oculos de sol': 'solar',
  lente: 'lente', lentes: 'lente',
  lente_contato: 'lente_contato', 'lente de contato': 'lente_contato', 'lentes de contato': 'lente_contato', contato: 'lente_contato',
  acessorio: 'acessorio', acessorios: 'acessorio',
  servico: 'servico', servicos: 'servico',
};
const GENEROS = { feminino: 'feminino', f: 'feminino', masculino: 'masculino', m: 'masculino', unissex: 'unissex', u: 'unissex', infantil: 'infantil', kids: 'infantil' };

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Cabeçalhos aceitos (o do modelo, a chave técnica e alguns apelidos comuns)
const APELIDOS = {};
for (const [chave, titulo] of COLUNAS) {
  APELIDOS[norm(chave)] = chave;
  APELIDOS[norm(titulo).replace(/\s*\*$/, '')] = chave;
}
Object.assign(APELIDOS, {
  codigo: 'sku', 'codigo de barras': 'sku', referencia: 'sku', ref: 'sku',
  produto: 'nome', descricao_curta: 'nome',
  custo: 'preco_custo', 'preco de custo': 'preco_custo',
  preco: 'preco_venda', venda: 'preco_venda', 'preco venda': 'preco_venda',
  promocao: 'preco_promocional', promocional: 'preco_promocional',
  qtd: 'quantidade', qtde: 'quantidade', estoque: 'quantidade',
  site: 'publicado', publicar: 'publicado',
  publico: 'genero', genero: 'genero',
  lente: 'largura_lente', 'largura da lente': 'largura_lente',
});

async function gerarModelo() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Ótica MD';
  const ws = wb.addWorksheet('Produtos', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = COLUNAS.map(([key, header, width]) => ({ key, header, width }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16202E' } };
  ws.getRow(1).height = 22;
  ws.addRow(Object.fromEntries(COLUNAS.map(([k, , , ex]) => [k, ex])));
  ws.addRow({ sku: '', nome: 'Solar Brisa', categoria: 'Óculos de sol', marca: 'MD Sun', cor: 'Preto', genero: 'Feminino', formato: 'Gatinho', material: 'Acetato', preco_custo: 70, preco_venda: 199.9, quantidade: 5, estoque_minimo: 1, controla_estoque: 'Sim', publicado: 'Sim', destaque: 'Sim' });
  ws.addRow({ nome: 'Lente Multifocal Digital', categoria: 'Lente', marca: 'Essilor', preco_custo: 280, controla_estoque: 'Não', publicado: 'Não' });

  const lista = (col, itens) => {
    const letra = ws.getColumn(col).letter;
    ws.dataValidations.add(`${letra}2:${letra}2000`, {
      type: 'list',
      allowBlank: true,
      formulae: [`"${itens.join(',')}"`],
    });
  };
  lista('categoria', ['Armação', 'Óculos de sol', 'Lente', 'Lente de contato', 'Acessório', 'Serviço']);
  lista('genero', ['Feminino', 'Masculino', 'Unissex', 'Infantil']);
  lista('formato', ['Redondo', 'Quadrado', 'Retangular', 'Gatinho', 'Aviador', 'Hexagonal', 'Oval']);
  lista('material', ['Acetato', 'Metal', 'Titânio', 'TR90', 'Misto']);
  for (const c of ['controla_estoque', 'publicado', 'destaque']) lista(c, ['Sim', 'Não']);
  for (const c of ['preco_custo', 'preco_venda', 'preco_promocional']) ws.getColumn(c).numFmt = '#,##0.00';

  const ajuda = wb.addWorksheet('Como preencher');
  ajuda.columns = [{ width: 110 }];
  [
    'COMO PREENCHER A PLANILHA DE PRODUTOS',
    '',
    '• Uma linha por produto (cada cor de armação é uma linha). Apague as linhas de exemplo antes de importar.',
    '• Obrigatórios: Nome e Categoria.',
    '• Código (SKU): se já existir no sistema, a linha ATUALIZA o produto e SOMA a quantidade ao estoque (entrada de compra).',
    '  Se ficar vazio, o sistema cria um código automático (MD00001...).',
    '• Preço de venda vazio: o sistema calcula pelo custo × markup da categoria (Configurações > Precificação).',
    '• Quantidade: unidades que estão chegando agora. Deixe 0 ou vazio para só cadastrar.',
    '• Sim/Não: aceita Sim, Não, S, N, 1, 0 ou X.',
    '• Valores podem ter vírgula: 1.234,56 ou 1234,56.',
    '• Também é possível salvar como CSV (separado por ponto e vírgula) e importar.',
  ].forEach((t, i) => {
    const r = ajuda.addRow([t]);
    if (i === 0) r.font = { bold: true, size: 13 };
  });
  return wb.xlsx.writeBuffer();
}

// --------- leitura ---------

function valorCelula(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.result !== undefined) return valorCelula(v.result); // fórmula
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text) return String(v.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return v;
}

function lerCSV(texto) {
  const primeira = texto.split(/\r?\n/)[0] || '';
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

async function lerPlanilha(buffer, nomeArquivo) {
  let linhas;
  if (/\.csv$/i.test(nomeArquivo)) {
    let texto = buffer.toString('utf8');
    if (texto.includes('�')) texto = buffer.toString('latin1'); // CSV salvo pelo Excel em ANSI
    linhas = lerCSV(texto.replace(/^﻿/, ''));
  } else {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer);
    } catch {
      throw new HttpError(400, 'Não consegui abrir o arquivo. Envie .xlsx ou .csv');
    }
    const ws = wb.getWorksheet('Produtos') || wb.worksheets[0];
    linhas = [];
    ws.eachRow({ includeEmpty: false }, (row, n) => {
      const vals = [];
      for (let c = 1; c <= ws.columnCount; c++) vals.push(valorCelula(row.getCell(c).value));
      linhas[n - 1] = vals;
    });
    linhas = linhas.map((l) => l || []);
  }
  if (!linhas.length) throw new HttpError(400, 'Planilha vazia');

  const cabecalho = linhas[0].map((h) => APELIDOS[norm(h).replace(/\s*\*$/, '')] || null);
  if (!cabecalho.includes('nome') || !cabecalho.includes('categoria')) {
    throw new HttpError(400, 'A planilha precisa das colunas "Nome" e "Categoria". Baixe o modelo para ver o formato.');
  }
  const registros = [];
  linhas.slice(1).forEach((l, i) => {
    const r = {};
    cabecalho.forEach((chave, j) => {
      if (chave) r[chave] = l[j] === undefined ? '' : l[j];
    });
    if (Object.values(r).every((v) => String(v).trim() === '')) return; // linha em branco
    registros.push({ linha: i + 2, bruto: r });
  });
  return registros;
}

// --------- conversões ---------

function numeroBR(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').replace(/R\$|\s/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function simNao(v, padrao) {
  const s = norm(v);
  if (!s) return padrao;
  if (['sim', 's', 'x', '1', 'true', 'yes'].includes(s)) return true;
  if (['nao', 'n', '0', 'false', 'no'].includes(s)) return false;
  return undefined;
}

const texto = (v) => {
  const s = String(v ?? '').trim();
  return s || null;
};

// Converte e valida uma linha; devolve { dados, erros }
function normalizar(bruto) {
  const erros = [];
  const d = {};
  d.sku = texto(bruto.sku);
  d.nome = texto(bruto.nome);
  if (!d.nome || d.nome.length < 2) erros.push('Nome vazio');
  const cat = CATEGORIAS[norm(bruto.categoria).replace(/\s+/g, ' ')];
  if (!texto(bruto.categoria)) erros.push('Categoria vazia');
  else if (!cat) erros.push(`Categoria inválida: "${bruto.categoria}"`);
  d.categoria = cat;
  for (const k of ['marca', 'modelo', 'cor', 'descricao']) d[k] = texto(bruto[k]);
  d.formato = texto(bruto.formato) ? norm(bruto.formato) : null;
  d.material = texto(bruto.material) ? (norm(bruto.material) === 'tr90' ? 'TR90' : norm(bruto.material)) : null;
  if (texto(bruto.genero)) {
    d.genero = GENEROS[norm(bruto.genero)];
    if (!d.genero) erros.push(`Público inválido: "${bruto.genero}"`);
  } else d.genero = null;

  for (const k of ['largura_lente', 'ponte', 'haste', 'quantidade', 'estoque_minimo']) {
    const n = numeroBR(bruto[k]);
    if (n === null) d[k] = null;
    else if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) erros.push(`${k.replace('_', ' ')} inválido: "${bruto[k]}"`);
    else d[k] = n;
  }
  for (const k of ['preco_custo', 'preco_venda', 'preco_promocional']) {
    const n = numeroBR(bruto[k]);
    if (n === null) d[k] = null;
    else if (Number.isNaN(n) || n < 0) erros.push(`${k.replace('_', ' ')} inválido: "${bruto[k]}"`);
    else d[k] = round2(n);
  }
  for (const [k, padrao] of [
    ['controla_estoque', undefined],
    ['publicado', undefined],
    ['destaque', undefined],
  ]) {
    const b = simNao(bruto[k], padrao);
    if (b === undefined && texto(bruto[k])) erros.push(`${k.replace('_', ' ')}: use Sim ou Não`);
    d[k] = b;
  }
  return { dados: d, erros };
}

module.exports = { COLUNAS, gerarModelo, lerPlanilha, normalizar };
