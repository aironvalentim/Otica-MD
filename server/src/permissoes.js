// Catálogo de permissões do painel. O perfil "Administrador" tem '*' (tudo).
// Para criar uma permissão nova: acrescente aqui e use exigir('chave') na rota.

const CATALOGO = [
  {
    grupo: 'Vendas',
    itens: [
      { chave: 'vendas.criar', nome: 'Fazer vendas (PDV)', descricao: 'Usar a tela Nova venda' },
      { chave: 'vendas.ver', nome: 'Ver lista de vendas', descricao: 'Consultar vendas e comprovantes' },
      { chave: 'vendas.cancelar', nome: 'Cancelar vendas', descricao: 'Cancelar venda, devolver estoque e estornar no caixa' },
      { chave: 'caixa.operar', nome: 'Operar o caixa', descricao: 'Abrir, fechar, sangria e suprimento' },
      { chave: 'crediario.receber', nome: 'Receber crediário', descricao: 'Ver parcelas e dar baixa em pagamentos' },
    ],
  },
  {
    grupo: 'Atendimento',
    itens: [
      { chave: 'clientes.gerenciar', nome: 'Clientes e receitas', descricao: 'Cadastrar e editar clientes e receitas' },
      { chave: 'os.gerenciar', nome: 'Ordens de serviço', descricao: 'Acompanhar e mudar o status das OS' },
      { chave: 'agendamentos.gerenciar', nome: 'Agendamentos', descricao: 'Ver e confirmar pedidos de exame do site' },
    ],
  },
  {
    grupo: 'Produtos e estoque',
    itens: [
      { chave: 'produtos.editar', nome: 'Cadastrar e editar produtos', descricao: 'Inclui fotos e preço de cada produto' },
      { chave: 'estoque.movimentar', nome: 'Entradas e saídas', descricao: 'Lançar notas, perdas e inventário' },
      { chave: 'etiquetas.imprimir', nome: 'Imprimir etiquetas', descricao: 'Etiquetas com código de barras' },
      { chave: 'precos.massa', nome: 'Preços em massa', descricao: 'Reajustes, promoções e recálculo pelo markup' },
      { chave: 'produtos.importar', nome: 'Importar planilha', descricao: 'Cadastro e reposição em lote (exige ver custos)' },
    ],
  },
  {
    grupo: 'Informações sensíveis',
    itens: [
      { chave: 'custos.ver', nome: 'Ver custo e margem', descricao: 'Preço de custo, margem e valor do estoque a custo' },
      { chave: 'relatorios.financeiro', nome: 'Relatórios financeiros', descricao: 'Faturamento, ticket médio, crediário a receber e histórico de caixas' },
    ],
  },
  {
    grupo: 'Administração',
    itens: [
      { chave: 'config.loja', nome: 'Configurações da loja', descricao: 'Dados do site, precificação, fornecedores e laboratórios' },
      { chave: 'usuarios.gerenciar', nome: 'Equipe e perfis', descricao: 'Criar usuários, perfis e redefinir senhas' },
      { chave: 'auditoria.ver', nome: 'Log de ações', descricao: 'Ver quem fez o quê e quando' },
    ],
  },
];

const TODAS = CATALOGO.flatMap((g) => g.itens.map((i) => i.chave));

function pode(usuario, chave) {
  const p = usuario?.permissoes;
  if (!p) return false;
  return p.includes('*') || p.includes(chave);
}

module.exports = { CATALOGO, TODAS, pode };
