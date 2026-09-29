// Teste de importação, preço sugerido, reajuste em massa e busca por código.
// Uso: API rodando + `node test/precos.test.js`
const assert = require('assert');
const ExcelJS = require('exceljs');
const BASE = process.env.API_URL || 'http://localhost:3001/api';
let token;
async function api(method, path, body, esperado) {
  const isForm = body instanceof FormData;
  const r = await fetch(BASE + path, {
    method,
    headers: { ...(isForm ? {} : { 'Content-Type': 'application/json' }), Authorization: `Bearer ${token}` },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const tipo = r.headers.get('content-type') || '';
  const data = tipo.includes('json') ? await r.json() : await r.arrayBuffer();
  if (esperado && r.status !== esperado) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data).slice(0, 500)}`);
  return { status: r.status, data };
}
const form = (buf, nome) => {
  const fd = new FormData();
  fd.append('arquivo', new Blob([buf]), nome);
  return fd;
};
(async () => {
  token = (await api('POST', '/auth/login', { email: 'admin@oticamd.com.br', senha: 'senha-teste-123' }, 200)).data.token;

  // regras: markup 2.5 armação, arredondamento x90
  await api('PUT', '/configuracoes', { markup_armacao: '2.5', markup_solar: '2', preco_arredondamento: 'x90' }, 200);
  const sug = (await api('GET', '/produtos/preco-sugerido?custo=95&categoria=armacao', null, 200)).data;
  assert.equal(sug.preco, 237.9);

  // cadastro sem preço de venda usa a sugestão e gera SKU
  const p = (await api('POST', '/produtos', { nome: 'Armação Sugestão', categoria: 'armacao', preco_custo: 100 }, 201)).data;
  assert.equal(p.preco_venda, 250.9);
  assert.match(p.sku, /^MD\d{5}$/);
  assert.equal((await api('POST', '/produtos', { nome: 'Sem preço', categoria: 'armacao' })).status, 400);

  // busca por código
  assert.equal((await api('GET', `/produtos/codigo/${p.sku.toLowerCase()}`, null, 200)).data.id, p.id);
  assert.equal((await api('GET', '/produtos/codigo/NAOEXISTE')).status, 404);

  // modelo da planilha
  const modelo = (await api('GET', '/produtos/importacao/modelo', null, 200)).data;
  const wbM = new ExcelJS.Workbook();
  await wbM.xlsx.load(modelo);
  assert.ok(wbM.getWorksheet('Produtos').getRow(1).getCell(2).value.startsWith('Nome'));

  // planilha: 1 atualização (SKU existente, entrada de 4), 2 novos, 1 erro
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Produtos');
  ws.addRow(['Código (SKU)', 'Nome *', 'Categoria *', 'Cor', 'Formato', 'Custo (R$)', 'Preço de venda (R$)', 'Quantidade', 'Mostrar no site']);
  ws.addRow([p.sku, 'Armação Sugestão', 'Armação', 'Preto', 'Redondo', 110, '', 4, 'Sim']);
  ws.addRow(['IMP-001', 'Armação Importada', 'armação', 'Azul', 'Quadrado', '80,00', '', 2, 'sim']);
  ws.addRow(['', 'Solar Importado', 'Óculos de sol', 'Preto', 'Aviador', 60, '199,90', 3, 'Não']);
  ws.addRow(['IMP-003', 'X', 'Chapéu', '', '', 'abc', '', -1, 'talvez']);
  const buf = await wb.xlsx.writeBuffer();

  const sim = (await api('POST', '/produtos/importacao?simular=1', form(buf, 'teste.xlsx'), 200)).data;
  assert.deepEqual(sim.total, { novos: 2, atualizar: 1, erros: 1, unidades: 9 });
  assert.equal(sim.linhas[1].venda, 200.9); // 80 × 2,5 = 200 -> 200,90
  assert.ok(sim.linhas[1].sugerido);
  assert.ok(sim.linhas[3].erros.length >= 3);
  // importação real recusa enquanto houver erro
  assert.equal((await api('POST', '/produtos/importacao', form(buf, 'teste.xlsx'))).status, 400);

  ws.spliceRows(5, 1);
  const buf2 = await wb.xlsx.writeBuffer();
  const imp = (await api('POST', '/produtos/importacao', form(buf2, 'teste.xlsx'), 200)).data;
  assert.equal(imp.total.novos, 2);
  const atualizado = (await api('GET', `/produtos/${p.id}`, null, 200)).data;
  assert.equal(atualizado.estoque_atual, 4);
  assert.equal(atualizado.cor, 'Preto');
  assert.equal(atualizado.publicado, true);
  assert.equal(atualizado.preco_custo, 110); // custo médio: 0 un. a 100 + 4 a 110 -> 110
  const importado = (await api('GET', '/produtos/codigo/IMP-001', null, 200)).data;
  assert.equal(importado.estoque_atual, 2);
  assert.equal(importado.preco_venda, 200.9);
  const solar = (await api('GET', '/produtos?busca=Solar%20Importado', null, 200)).data[0];
  assert.match(solar.sku, /^MD/);
  assert.equal(solar.preco_venda, 199.9);

  // CSV com ponto e vírgula
  const csv = 'Nome;Categoria;Custo;Quantidade\n"Estojo, couro";Acessório;12,50;10\n';
  const impCsv = (await api('POST', '/produtos/importacao', form(Buffer.from(csv), 'lista.csv'), 200)).data;
  assert.equal(impCsv.total.novos, 1);
  const estojo = (await api('GET', '/produtos?busca=Estojo%2C%20couro', null, 200)).data[0];
  assert.equal(estojo.preco_venda, 31.9); // 12,50 × 2,5 = 31,25 -> 31,90

  // reajuste: prévia não altera
  const prev = (await api('POST', '/produtos/reajuste', { filtro: { ids: [importado.id, solar.id] }, acao: 'aumentar_pct', valor: 10 }, 200)).data;
  assert.equal(prev.total, 2);
  assert.equal((await api('GET', `/produtos/${importado.id}`)).data.preco_venda, 200.9);
  const apl = (await api('POST', '/produtos/reajuste', { filtro: { ids: [importado.id, solar.id] }, acao: 'aumentar_pct', valor: 10, simular: false }, 200)).data;
  assert.equal(apl.total, 2);
  assert.equal((await api('GET', `/produtos/${importado.id}`)).data.preco_venda, 221.9); // 220,99 -> 221,90

  // promoção 20% em sol e remoção
  await api('POST', '/produtos/reajuste', { filtro: { ids: [solar.id] }, acao: 'promocao_pct', valor: 20, arredondamento: 'nenhum', simular: false }, 200);
  const s2 = (await api('GET', `/produtos/${solar.id}`)).data;
  assert.equal(s2.preco_promocional, Math.round(s2.preco_venda * 0.8 * 100) / 100);
  await api('POST', '/produtos/reajuste', { filtro: { ids: [solar.id] }, acao: 'remover_promocao', simular: false }, 200);
  assert.equal((await api('GET', `/produtos/${solar.id}`)).data.preco_promocional, null);

  // markup da categoria
  const mk = (await api('POST', '/produtos/reajuste', { filtro: { ids: [importado.id] }, acao: 'aplicar_markup', simular: true }, 200)).data;
  assert.equal(mk.itens[0].venda_depois, 200.9);

  // histórico de preços
  const hist = (await api('GET', `/produtos/${importado.id}/precos`, null, 200)).data;
  assert.equal(hist[0].motivo, 'Reajuste +10%');
  assert.equal(hist[0].venda_anterior, 200.9);

  // validações
  assert.equal((await api('POST', '/produtos/reajuste', { acao: 'reduzir_pct', valor: 150 })).status, 400);
  assert.equal((await api('POST', '/produtos/importacao', form(Buffer.from('a;b\n1;2'), 'x.csv'))).status, 400);
  console.log('OK: importação, preço sugerido, reajuste e código de barras passaram');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
