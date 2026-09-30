// Teste de ponta a ponta da API. Uso: API rodando + `node test/fluxo.test.js`
const assert = require('assert');
const BASE = process.env.API_URL || 'http://localhost:3001/api';
let token;
async function api(method, path, body, esperado) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json();
  if (esperado && r.status !== esperado) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data)}`);
  return { status: r.status, data };
}
(async () => {
  assert.equal((await api('GET', '/produtos')).status, 401);
  assert.equal((await api('POST', '/auth/login', { email: 'admin@oticamd.com.br', senha: 'errada' })).status, 401);
  token = (await api('POST', '/auth/login', { email: 'admin@oticamd.com.br', senha: 'senha-teste-123' }, 200)).data.token;

  const pub = (await api('GET', '/publico/produtos?categoria=armacao', null, 200)).data;
  assert.ok(pub.length >= 3 && pub[0].preco_custo === undefined, 'público sem custo');
  const filtros = (await api('GET', '/publico/filtros', null, 200)).data;
  assert.ok(filtros.formatos.includes('gatinho'));
  const det = (await api('GET', `/publico/produtos/${pub[0].slug}`, null, 200)).data;
  assert.ok(Array.isArray(det.relacionados));
  await api('POST', '/publico/agendamentos', { nome: 'João Teste', telefone: '(81) 98888-1111', data_preferida: '2026-10-05', periodo: 'manha', site: '' }, 201);
  assert.equal((await api('POST', '/publico/agendamentos', { nome: 'Robô', telefone: '81988881111', site: 'spam' })).status, 400);

  const produtos = (await api('GET', '/produtos', null, 200)).data;
  const lume = produtos.find((p) => p.nome === 'Armação Lume');
  const lente = produtos.find((p) => p.categoria === 'lente' && p.nome.includes('Simples'));
  const estojo = produtos.find((p) => p.nome === 'Estojo rígido');
  const cliente = (await api('GET', '/clientes', null, 200)).data[0];

  // venda sem caixa aberto -> 409
  const vendaBody = {
    cliente_id: cliente.id,
    desconto: 20,
    itens: [
      { produto_id: lume.id, quantidade: 1, preco_unitario: 229.9 },
      { produto_id: lente.id, quantidade: 1, preco_unitario: 180 },
      { descricao: 'Montagem', quantidade: 1, preco_unitario: 0 },
    ],
    pagamentos: [
      { forma: 'dinheiro', valor: 89.9 },
      { forma: 'crediario', valor: 300, parcelas: 3, primeiro_vencimento: '2026-01-31' },
    ],
    ordem_servico: { tipo_lente: 'Visão simples', tratamentos: 'Antirreflexo', previsao_entrega: '2026-10-10' },
  };
  assert.equal((await api('POST', '/vendas', vendaBody)).status, 409);
  await api('POST', '/caixa/abrir', { valor_abertura: 100 }, 201);
  assert.equal((await api('POST', '/caixa/abrir', { valor_abertura: 100 })).status, 409);

  // receita
  const rec = (await api('POST', '/receitas', { cliente_id: cliente.id, od_esferico: '-1.25', od_cilindrico: '-0.50', od_eixo: 180, oe_esferico: -1, od_adicao: '', oe_dnp: 31.5 }, 201)).data;
  assert.equal((await api('POST', '/receitas', { cliente_id: cliente.id, od_esferico: -1.3 })).status, 400);
  vendaBody.receita_id = rec.id;

  // pagamento errado
  assert.equal((await api('POST', '/vendas', { ...vendaBody, desconto: 0 })).status, 400);
  const venda = (await api('POST', '/vendas', vendaBody, 201)).data;
  assert.equal(venda.total, 389.9);
  assert.ok(venda.os_id);
  const vDet = (await api('GET', `/vendas/${venda.id}`, null, 200)).data;
  assert.deepEqual(vDet.parcelas.map((p) => [p.valor, p.vencimento]), [[100, '2026-01-31'], [100, '2026-02-28'], [100, '2026-03-31']]);
  assert.equal((await api('GET', `/produtos/${lume.id}`)).data.estoque_atual, lume.estoque_atual - 1);
  assert.equal((await api('GET', `/produtos/${lente.id}`)).data.estoque_atual, 0, 'lente sem controle');

  // estoque insuficiente
  const semEstoque = await api('POST', '/vendas', { itens: [{ produto_id: lume.id, quantidade: 999, preco_unitario: 1 }], pagamentos: [{ forma: 'pix', valor: 999 }] });
  assert.equal(semEstoque.status, 409);
  // crediário sem cliente
  assert.equal((await api('POST', '/vendas', { itens: [{ produto_id: estojo.id, quantidade: 1, preco_unitario: 25 }], pagamentos: [{ forma: 'crediario', valor: 25 }] })).status, 400);

  // venda 2 no crédito e cancelamento
  const v2 = (await api('POST', '/vendas', { itens: [{ produto_id: estojo.id, quantidade: 2, preco_unitario: 25 }], pagamentos: [{ forma: 'credito', valor: 50, parcelas: 2 }] }, 201)).data;
  assert.equal((await api('GET', `/produtos/${estojo.id}`)).data.estoque_atual, estojo.estoque_atual - 2);
  await api('POST', `/vendas/${v2.id}/cancelar`, { motivo: 'Cliente desistiu' }, 200);
  assert.equal((await api('GET', `/produtos/${estojo.id}`)).data.estoque_atual, estojo.estoque_atual);
  assert.equal((await api('POST', `/vendas/${v2.id}/cancelar`, { motivo: 'de novo' })).status, 409);

  // crediário: pagar parcela
  const parcelas = (await api('GET', `/crediario/parcelas?cliente_id=${cliente.id}`, null, 200)).data;
  assert.equal(parcelas.length, 3);
  await api('POST', `/crediario/parcelas/${parcelas[0].id}/pagar`, { forma_pagamento: 'pix' }, 200);
  assert.equal((await api('POST', `/crediario/parcelas/${parcelas[0].id}/pagar`, { forma_pagamento: 'pix' })).status, 409);
  const resumoCred = (await api('GET', '/crediario/resumo', null, 200)).data;
  assert.equal(resumoCred.a_receber, 200);

  // OS
  await api('POST', `/os/${venda.os_id}/status`, { status: 'enviada_laboratorio' }, 200);
  const os = (await api('GET', `/os/${venda.os_id}`, null, 200)).data;
  assert.equal(os.historico.length, 2);
  assert.equal(os.receita.od_esferico, -1.25);

  // estoque: entrada com custo médio, saída, ajuste
  const antes = (await api('GET', `/produtos/${lume.id}`)).data;
  await api('POST', '/estoque/movimentacoes', { tipo: 'entrada', produto_id: lume.id, motivo: 'compra', quantidade: 3, custo_unitario: 95, documento: 'NF 123' }, 201);
  const depois = (await api('GET', `/produtos/${lume.id}`)).data;
  assert.equal(depois.estoque_atual, antes.estoque_atual + 3);
  const esperado = Math.round(((antes.estoque_atual * antes.preco_custo + 3 * 95) / (antes.estoque_atual + 3)) * 100) / 100;
  assert.equal(depois.preco_custo, esperado);
  await api('POST', '/estoque/movimentacoes', { tipo: 'saida', produto_id: lume.id, motivo: 'perda', quantidade: 1 }, 201);
  await api('POST', '/estoque/movimentacoes', { tipo: 'ajuste', produto_id: lume.id, novo_estoque: 5 }, 201);
  assert.equal((await api('GET', `/produtos/${lume.id}`)).data.estoque_atual, 5);
  const movs = (await api('GET', `/estoque/movimentacoes?produto_id=${lume.id}`, null, 200)).data;
  assert.ok(movs.length >= 5);
  await api('POST', '/estoque/entrada-lote', { documento: 'NF 999', itens: [{ produto_id: estojo.id, quantidade: 10, custo_unitario: 5 }] }, 201);

  // novo produto com estoque inicial
  const novo = (await api('POST', '/produtos', { nome: 'Armação Teste', categoria: 'armacao', preco_venda: 199, preco_custo: 80, estoque_inicial: 4, publicado: true, preco_promocional: '', largura_lente: '' }, 201)).data;
  assert.equal(novo.estoque_atual, 4);
  const novo2 = (await api('POST', '/produtos', { nome: 'Armação Teste', categoria: 'armacao', preco_venda: 199 }, 201)).data;
  assert.notEqual(novo.slug, novo2.slug);
  await api('PUT', `/produtos/${novo.id}`, { preco_venda: 210, destaque: true }, 200);

  // caixa: sangria e fechamento
  await api('POST', '/caixa/lancamentos', { tipo: 'sangria', valor: 50, descricao: 'Depósito' }, 201);
  const cx = (await api('GET', '/caixa/atual', null, 200)).data;
  // 100 abertura + 89.90 venda - 50 sangria = 139.90 (crédito estornado não mexe no dinheiro)
  assert.equal(cx.dinheiro_esperado, 139.9);
  assert.equal(cx.por_forma.credito, 0);
  assert.equal(cx.por_forma.pix, 100);
  const dash = (await api('GET', '/dashboard', null, 200)).data;
  assert.equal(dash.vendas.hoje_total, 389.9);
  assert.equal(dash.agendamentos_novos, 1);
  const fech = (await api('POST', '/caixa/fechar', { valor_informado: 140 }, 200)).data;
  assert.equal(fech.diferenca, 0.1);
  assert.equal((await api('GET', '/caixa/atual', null, 200)).data, null);

  // usuários
  const perfis = (await api('GET', '/perfis', null, 200)).data;
  const vendedor = perfis.find((p) => p.nome === 'Vendedor');
  await api('POST', '/usuarios', { nome: 'Vendedora', email: 'vend@oticamd.com.br', senha: '12345678', perfil_id: vendedor.id }, 201);
  const tokAdmin = token;
  token = (await api('POST', '/auth/login', { email: 'vend@oticamd.com.br', senha: '12345678' }, 200)).data.token;
  assert.equal((await api('GET', '/usuarios')).status, 403);
  token = tokAdmin;
  await api('PUT', '/configuracoes', { loja_whatsapp: '5581912345678' }, 200);
  assert.equal((await api('GET', '/publico/config', null, 200)).data.loja_whatsapp, '5581912345678');
  console.log('OK: todos os fluxos passaram');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
