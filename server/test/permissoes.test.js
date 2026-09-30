// Teste de perfis, permissões e auditoria. Uso: API rodando + `node test/permissoes.test.js`
const assert = require('assert');
const BASE = process.env.API_URL || 'http://localhost:3001/api';
async function api(token, method, path, body, esperado) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = r.status === 204 ? null : await r.json();
  if (esperado && r.status !== esperado) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(data).slice(0, 400)}`);
  return { status: r.status, data };
}
const login = async (email, senha) => (await api(null, 'POST', '/auth/login', { email, senha }, 200)).data;

(async () => {
  const adm = (await login('admin@oticamd.com.br', 'senha-teste-123')).token;
  const me = (await api(adm, 'GET', '/auth/me', null, 200)).data;
  assert.ok(me.permissoes.includes('*'), 'admin tem acesso total');

  // Catálogo e perfis padrão
  const catalogo = (await api(adm, 'GET', '/perfis/permissoes', null, 200)).data;
  assert.ok(catalogo.length >= 4 && catalogo.every((g) => g.itens.length));
  const perfis = (await api(adm, 'GET', '/perfis', null, 200)).data;
  const admPerfil = perfis.find((p) => p.sistema);
  assert.equal((await api(adm, 'PUT', `/perfis/${admPerfil.id}`, { nome: 'X', permissoes: [] })).status, 400, 'Administrador é fixo');
  assert.equal((await api(adm, 'POST', '/perfis', { nome: 'Inválido', permissoes: ['nao.existe'] })).status, 400);

  // Perfil de balcão: vende com até 5% de desconto, sem custos, sem cancelar
  const balcao = (
    await api(adm, 'POST', '/perfis', {
      nome: 'Balcão',
      descricao: 'Atendimento',
      permissoes: ['vendas.criar', 'vendas.ver', 'caixa.operar', 'clientes.gerenciar'],
      desconto_max_pct: 5,
    }, 201)
  ).data;
  await api(adm, 'POST', '/usuarios', { nome: 'Ana Balcão', email: 'ana@oticamd.com.br', senha: 'ana-12345', perfil_id: balcao.id }, 201);
  assert.equal((await api(adm, 'POST', '/usuarios', { nome: 'Dup', email: 'ana@oticamd.com.br', senha: 'ana-12345', perfil_id: balcao.id })).status, 409);

  assert.equal((await api(null, 'POST', '/auth/login', { email: 'ana@oticamd.com.br', senha: 'errada' })).status, 401);
  const sessao = await login('ana@oticamd.com.br', 'ana-12345');
  const ana = sessao.token;
  assert.equal(sessao.usuario.perfil.nome, 'Balcão');
  assert.equal(sessao.usuario.desconto_max_pct, 5);

  // Custos escondidos
  const lista = (await api(ana, 'GET', '/produtos', null, 200)).data;
  assert.ok(lista.length && lista.every((p) => p.preco_custo === undefined), 'lista sem custo');
  const armacao = lista.find((p) => p.categoria === 'armacao' && p.estoque_atual > 2 && !p.preco_promocional);
  assert.equal((await api(ana, 'GET', `/produtos/${armacao.id}`, null, 200)).data.preco_custo, undefined);
  assert.ok((await api(adm, 'GET', `/produtos/${armacao.id}`, null, 200)).data.preco_custo !== undefined);

  // Funções bloqueadas
  for (const [m, p] of [
    ['GET', '/usuarios'],
    ['GET', '/perfis'],
    ['GET', '/auditoria'],
    ['GET', '/caixa'],
    ['GET', '/crediario/resumo'],
    ['PUT', `/produtos/${armacao.id}`],
    ['DELETE', `/produtos/${armacao.id}`],
    ['POST', '/produtos/reajuste'],
    ['GET', '/produtos/importacao/modelo'],
    ['PUT', '/configuracoes'],
    ['POST', '/estoque/movimentacoes'],
    ['GET', '/os'],
  ]) {
    assert.equal((await api(ana, m, p, m === 'GET' || m === 'DELETE' ? null : {})).status, 403, `${m} ${p} deveria ser 403`);
  }
  const dash = (await api(ana, 'GET', '/dashboard', null, 200)).data;
  assert.equal(dash.vendas, null);
  assert.equal(dash.pode_financeiro, false);
  assert.equal(dash.os_por_status, null);

  // Venda: desconto acima do limite é barrado
  if (!(await api(ana, 'GET', '/caixa/atual', null, 200)).data) await api(ana, 'POST', '/caixa/abrir', { valor_abertura: 50 }, 201);
  const preco = Number(armacao.preco_venda);
  const venda = (desconto) => ({
    desconto,
    itens: [{ produto_id: armacao.id, quantidade: 1, preco_unitario: preco }],
    pagamentos: [{ forma: 'pix', valor: Math.round((preco - desconto) * 100) / 100 }],
  });
  const acima = await api(ana, 'POST', '/vendas', venda(Math.round(preco * 0.2 * 100) / 100));
  assert.equal(acima.status, 403);
  assert.match(acima.data.erro, /limite de 5%/);
  // desconto escondido no preço do item também conta
  const noItem = await api(ana, 'POST', '/vendas', {
    itens: [{ produto_id: armacao.id, quantidade: 1, preco_unitario: Math.round(preco * 0.5 * 100) / 100 }],
    pagamentos: [{ forma: 'pix', valor: Math.round(preco * 0.5 * 100) / 100 }],
  });
  assert.equal(noItem.status, 403, 'desconto no preço do item');
  const ok = (await api(ana, 'POST', '/vendas', venda(Math.floor(preco * 0.04 * 100) / 100), 201)).data;
  const det = (await api(ana, 'GET', `/vendas/${ok.id}`, null, 200)).data;
  assert.ok(det.itens.every((i) => i.custo_unitario === undefined), 'venda sem custo');
  assert.equal((await api(ana, 'POST', `/vendas/${ok.id}/cancelar`, { motivo: 'teste' })).status, 403);
  await api(adm, 'POST', `/vendas/${ok.id}/cancelar`, { motivo: 'Cliente desistiu' }, 200);

  // Troca de senha
  assert.equal((await api(ana, 'POST', '/auth/senha', { atual: 'errada', nova: 'nova-senha-1' })).status, 400);
  await api(ana, 'POST', '/auth/senha', { atual: 'ana-12345', nova: 'nova-senha-1' }, 200);
  await login('ana@oticamd.com.br', 'nova-senha-1');

  // Perfil alterado vale na hora (sem novo login)
  await api(adm, 'PUT', `/perfis/${balcao.id}`, { nome: 'Balcão', permissoes: ['vendas.criar', 'vendas.ver', 'caixa.operar', 'clientes.gerenciar', 'custos.ver'], desconto_max_pct: 5 }, 200);
  assert.ok((await api(ana, 'GET', `/produtos/${armacao.id}`, null, 200)).data.preco_custo !== undefined, 'custo liberado');

  // Proteções
  assert.equal((await api(adm, 'DELETE', `/perfis/${balcao.id}`)).status, 409, 'perfil com usuários');
  assert.equal((await api(adm, 'PUT', `/usuarios/${me.id}`, { ativo: false })).status, 400, 'não se desativa');
  assert.equal((await api(adm, 'PUT', `/usuarios/${me.id}`, { perfil_id: balcao.id })).status, 400, 'sobra um administrador');

  // Desativar derruba a sessão
  const usuarios = (await api(adm, 'GET', '/usuarios', null, 200)).data;
  const anaId = usuarios.find((u) => u.email === 'ana@oticamd.com.br').id;
  assert.ok(usuarios.find((u) => u.id === anaId).ultimo_acesso);
  await api(adm, 'PUT', `/usuarios/${anaId}`, { ativo: false }, 200);
  assert.equal((await api(ana, 'GET', '/produtos')).status, 401);
  assert.equal((await api(null, 'POST', '/auth/login', { email: 'ana@oticamd.com.br', senha: 'nova-senha-1' })).status, 401);

  // Auditoria
  const log = (await api(adm, 'GET', `/auditoria?usuario_id=${anaId}`, null, 200)).data;
  const acoes = new Set(log.map((l) => l.acao));
  for (const a of ['login', 'venda_criada', 'senha_alterada']) assert.ok(acoes.has(a), `auditoria: ${a}`);
  const geral = (await api(adm, 'GET', '/auditoria', null, 200)).data;
  const g = new Set(geral.map((l) => l.acao));
  for (const a of ['perfil_criado', 'perfil_alterado', 'usuario_criado', 'usuario_alterado', 'venda_cancelada', 'login_falhou']) assert.ok(g.has(a), `auditoria: ${a}`);
  const busca = (await api(adm, 'GET', '/auditoria?busca=desistiu', null, 200)).data;
  assert.ok(busca.some((l) => l.acao === 'venda_cancelada'));
  console.log('OK: perfis, permissões e auditoria');
})().catch((e) => {
  console.error('FALHOU:', e.message);
  process.exit(1);
});
