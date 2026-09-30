import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { qs } from '../../lib/api';
import { useApi, useDebounce } from '../../lib/hooks';
import { dataHora, moeda, FORMAS_PAGAMENTO, hojeISO } from '../../lib/format';
import { Cabecalho, Cartao, Campo, Etiqueta, Tabela } from '../../components/admin/ui';

// Nome legível e cor de cada ação registrada
const ACOES = {
  login: ['Entrou no sistema', 'slate'],
  login_falhou: ['Senha errada no login', 'amber'],
  senha_alterada: ['Trocou a própria senha', 'slate'],
  venda_criada: ['Venda', 'green'],
  venda_cancelada: ['Venda cancelada', 'red'],
  caixa_aberto: ['Abriu o caixa', 'blue'],
  caixa_fechado: ['Fechou o caixa', 'blue'],
  sangria: ['Sangria', 'amber'],
  suprimento: ['Suprimento', 'blue'],
  parcela_recebida: ['Recebeu parcela', 'green'],
  produto_criado: ['Cadastrou produto', 'slate'],
  produto_alterado: ['Alterou produto', 'slate'],
  produto_desativado: ['Desativou produto', 'red'],
  reajuste_precos: ['Preços em massa', 'amber'],
  importacao_planilha: ['Importou planilha', 'slate'],
  estoque_entrada: ['Entrada de estoque', 'slate'],
  estoque_saida: ['Saída de estoque', 'amber'],
  estoque_ajuste: ['Ajuste de estoque', 'amber'],
  estoque_nota: ['Entrada de nota', 'slate'],
  usuario_criado: ['Criou usuário', 'gold'],
  usuario_alterado: ['Alterou usuário', 'gold'],
  perfil_criado: ['Criou perfil', 'gold'],
  perfil_alterado: ['Alterou perfil', 'gold'],
  perfil_excluido: ['Excluiu perfil', 'gold'],
  configuracoes_alteradas: ['Alterou configurações', 'gold'],
};

const ROTULOS = {
  nome: 'Nome',
  sku: 'Código',
  preco_venda: 'Preço',
  preco_promocional: 'Promoção',
  preco_custo: 'Custo',
  estoque_inicial: 'Estoque inicial',
  estoque_minimo: 'Estoque mínimo',
  publicado: 'No site',
  ativo: 'Ativo',
  perfil: 'Perfil',
  perfil_id: 'Perfil',
  email: 'E-mail',
  usuario: 'Usuário',
  senha: 'Senha',
  total: 'Total',
  desconto: 'Desconto',
  motivo: 'Motivo',
  quantidade: 'Qtd.',
  saldo: 'Saldo',
  documento: 'Documento',
  valor: 'Valor',
  valor_abertura: 'Abertura',
  esperado: 'Esperado',
  contado: 'Contado',
  diferenca: 'Diferença',
  forma: 'Forma',
  parcela: 'Parcela',
  descricao: 'Descrição',
  arquivo: 'Arquivo',
  novos: 'Novos',
  atualizar: 'Atualizados',
  unidades: 'Unidades',
  itens: 'Itens',
  desconto_max_pct: 'Desconto máx.',
  erros: 'Erros',
  markup_armacao: 'Markup armação',
  markup_solar: 'Markup solar',
  markup_lente: 'Markup lente',
  markup_acessorio: 'Markup acessório',
  preco_arredondamento: 'Arredondamento',
  loja_nome: 'Nome da loja',
  loja_whatsapp: 'WhatsApp',
  loja_endereco: 'Endereço',
  loja_horario: 'Horário',
  loja_instagram: 'Instagram',
  destaque: 'Destaque',
  controla_estoque: 'Controla estoque',
};
// Nomes das permissões (mesmo catálogo do servidor)
const PERMISSOES = {
  'vendas.criar': 'Fazer vendas',
  'vendas.ver': 'Ver vendas',
  'vendas.cancelar': 'Cancelar vendas',
  'caixa.operar': 'Operar caixa',
  'crediario.receber': 'Receber crediário',
  'clientes.gerenciar': 'Clientes e receitas',
  'os.gerenciar': 'Ordens de serviço',
  'agendamentos.gerenciar': 'Agendamentos',
  'produtos.editar': 'Editar produtos',
  'estoque.movimentar': 'Entradas e saídas',
  'etiquetas.imprimir': 'Etiquetas',
  'precos.massa': 'Preços em massa',
  'produtos.importar': 'Importar planilha',
  'custos.ver': 'Ver custo e margem',
  'relatorios.financeiro': 'Relatórios financeiros',
  'config.loja': 'Configurações',
  'usuarios.gerenciar': 'Equipe e perfis',
  'auditoria.ver': 'Auditoria',
};
const nomesPerm = (l) => l.map((k) => PERMISSOES[k] || k).join(', ');

const DINHEIRO = new Set([
  'preco_venda',
  'preco_promocional',
  'preco_custo',
  'total',
  'desconto',
  'valor',
  'valor_abertura',
  'esperado',
  'contado',
  'diferenca',
]);

function valorLegivel(k, v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  if (DINHEIRO.has(k) && !Number.isNaN(Number(v))) return moeda(v);
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function Detalhes({ a }) {
  const d = a.detalhes || {};
  if (a.acao === 'venda_criada') {
    return (
      <span>
        {moeda(d.total)}
        {d.desconto > 0 && (
          <span className="text-amber-700">
            {' '}
            · desconto {moeda(d.desconto)} ({d.desconto_pct}%)
          </span>
        )}
        {d.formas?.length > 0 && <span className="text-slate-500"> · {d.formas.map((f) => FORMAS_PAGAMENTO[f] || f).join(' + ')}</span>}
      </span>
    );
  }
  if (a.acao === 'perfil_alterado') {
    return (
      <span>
        <strong>{d.perfil}</strong>
        {d.adicionadas?.length > 0 && <span className="text-green-700"> · liberou: {nomesPerm(d.adicionadas)}</span>}
        {d.removidas?.length > 0 && <span className="text-red-700"> · retirou: {nomesPerm(d.removidas)}</span>}
        {d.desconto_max_pct && <span> · desconto {d.desconto_max_pct}%</span>}
      </span>
    );
  }
  if (a.acao === 'reajuste_precos')
    return (
      <span>
        {d.motivo} · {d.total} produto(s)
      </span>
    );
  if (a.acao === 'caixa_fechado') {
    return (
      <span>
        esperado {moeda(d.esperado)} · contado {moeda(d.contado)} ·{' '}
        <span className={Number(d.diferenca) === 0 ? 'text-green-700' : 'font-medium text-red-700'}>diferença {moeda(d.diferenca)}</span>
      </span>
    );
  }
  const partes = Object.entries(d).filter(([k]) => !['formas', 'desconto_pct', 'permissoes'].includes(k));
  if (!partes.length) return <span className="text-slate-400">—</span>;
  return (
    <span className="text-slate-700">
      {partes.map(([k, v], i) => (
        <span key={k}>
          {i > 0 && ' · '}
          <span className="text-slate-500">{ROTULOS[k] || k}: </span>
          {v && typeof v === 'object' && 'de' in v ? `${valorLegivel(k, v.de)} → ${valorLegivel(k, v.para)}` : valorLegivel(k, v)}
        </span>
      ))}
    </span>
  );
}

function linkDe(a) {
  if (!a.entidade_id) return null;
  if (a.entidade === 'venda') return `/admin/vendas/${a.entidade_id}`;
  if (a.entidade === 'produto') return `/admin/produtos/${a.entidade_id}`;
  return null;
}

export default function Auditoria() {
  const [f, setF] = useState({ usuario_id: '', acao: '', de: hojeISO().slice(0, 8) + '01', ate: '', busca: '' });
  const busca = useDebounce(f.busca, 350);
  const { dados: usuarios } = useApi('/auditoria/usuarios');
  const { dados, erro } = useApi(`/auditoria${qs({ ...f, busca })}`);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <Cabecalho titulo="Auditoria" subtitulo="Quem fez o quê e quando. Os registros não podem ser apagados pelo painel." />
      <Cartao className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Campo label="Pessoa">
            <select value={f.usuario_id} onChange={set('usuario_id')} className="campo">
              <option value="">Todas</option>
              {usuarios?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Ação">
            <select value={f.acao} onChange={set('acao')} className="campo">
              <option value="">Todas</option>
              {Object.entries(ACOES).map(([k, [l]]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="De">
            <input type="date" value={f.de} onChange={set('de')} className="campo" />
          </Campo>
          <Campo label="Até">
            <input type="date" value={f.ate} onChange={set('ate')} className="campo" />
          </Campo>
          <Campo label="Buscar">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={f.busca} onChange={set('busca')} placeholder="produto, motivo, e-mail…" className="campo pl-9" />
            </div>
          </Campo>
        </div>
      </Cartao>

      {erro && <p className="mb-4 text-sm text-red-600">{erro}</p>}
      <Cartao semPadding titulo={dados ? `${dados.length}${dados.length === 500 ? '+' : ''} registro(s)` : 'Registros'}>
        <Tabela
          linhas={dados}
          vazio="Nenhum registro com esses filtros."
          colunas={[
            { titulo: 'Quando', render: (a) => <span className="whitespace-nowrap text-slate-600">{dataHora(a.criado_em)}</span> },
            { titulo: 'Quem', render: (a) => <span className="whitespace-nowrap font-medium">{a.usuario_nome || '—'}</span> },
            {
              titulo: 'Ação',
              render: (a) => {
                const [l, cor] = ACOES[a.acao] || [a.acao, 'slate'];
                const link = linkDe(a);
                return (
                  <span className="whitespace-nowrap">
                    <Etiqueta cor={cor}>{l}</Etiqueta>
                    {link && (
                      <Link to={link} className="ml-2 text-xs text-slate-500 underline hover:text-ink">
                        #{a.entidade_id}
                      </Link>
                    )}
                  </span>
                );
              },
            },
            { titulo: 'Detalhes', classe: 'min-w-[260px]', render: (a) => <Detalhes a={a} /> },
          ]}
        />
      </Cartao>
    </>
  );
}
