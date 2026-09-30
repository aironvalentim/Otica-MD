import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Wallet,
  Package,
  ArrowLeftRight,
  Users,
  Wrench,
  CalendarDays,
  HandCoins,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Percent,
  Tag,
  FileSpreadsheet,
  UserCog,
  History,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import { Botao, Campo, Erro, Modal, ToastProvider, useToast } from './ui';

const GRUPOS = [
  {
    titulo: null,
    itens: [
      { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
      { to: '/admin/pdv', label: 'Nova venda', icon: ShoppingCart, p: ['vendas.criar'] },
    ],
  },
  {
    titulo: 'Vendas',
    itens: [
      { to: '/admin/vendas', label: 'Vendas', icon: Receipt, p: ['vendas.ver'] },
      { to: '/admin/caixa', label: 'Caixa', icon: Wallet, p: ['caixa.operar', 'relatorios.financeiro'] },
      { to: '/admin/crediario', label: 'Crediário', icon: HandCoins, p: ['crediario.receber', 'relatorios.financeiro'] },
    ],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { to: '/admin/clientes', label: 'Clientes e receitas', icon: Users, p: ['clientes.gerenciar', 'vendas.criar'] },
      { to: '/admin/os', label: 'Ordens de serviço', icon: Wrench, p: ['os.gerenciar'] },
      { to: '/admin/agendamentos', label: 'Agendamentos', icon: CalendarDays, p: ['agendamentos.gerenciar'] },
    ],
  },
  {
    titulo: 'Estoque',
    itens: [
      { to: '/admin/produtos', label: 'Produtos', icon: Package, end: true },
      { to: '/admin/estoque', label: 'Entradas e saídas', icon: ArrowLeftRight, p: ['estoque.movimentar'] },
      { to: '/admin/produtos/importar', label: 'Importar planilha', icon: FileSpreadsheet, p: ['produtos.importar'] },
      { to: '/admin/precos', label: 'Preços em massa', icon: Percent, p: ['precos.massa'] },
      { to: '/admin/etiquetas', label: 'Etiquetas', icon: Tag, p: ['etiquetas.imprimir'] },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [
      { to: '/admin/equipe', label: 'Equipe e perfis', icon: UserCog, p: ['usuarios.gerenciar'] },
      { to: '/admin/auditoria', label: 'Auditoria', icon: History, p: ['auditoria.ver'] },
      { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, p: ['config.loja'] },
    ],
  },
];

function MinhaSenha({ aberto, onFechar }) {
  const avisar = useToast();
  const [f, setF] = useState({ atual: '', nova: '', repetir: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (f.nova !== f.repetir) return setErro('A confirmação não confere com a nova senha');
    setSalvando(true);
    try {
      await api.post('/auth/senha', { atual: f.atual, nova: f.nova });
      setF({ atual: '', nova: '', repetir: '' });
      onFechar();
      avisar('Senha alterada');
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Minha senha" largura="max-w-sm">
      <form onSubmit={salvar} className="space-y-4">
        <Campo label="Senha atual">
          <input type="password" required autoComplete="current-password" value={f.atual} onChange={set('atual')} className="campo" />
        </Campo>
        <Campo label="Nova senha" dica="Mínimo 8 caracteres">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={f.nova}
            onChange={set('nova')}
            className="campo"
          />
        </Campo>
        <Campo label="Repita a nova senha">
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={f.repetir}
            onChange={set('repetir')}
            className="campo"
          />
        </Campo>
        <Erro>{erro}</Erro>
        <Botao type="submit" carregando={salvando} className="w-full">
          Alterar senha
        </Botao>
      </form>
    </Modal>
  );
}

export default function AdminLayout() {
  const { usuario, logout, pode } = useAuth();
  const [menu, setMenu] = useState(false);
  const [senha, setSenha] = useState(false);
  const grupos = GRUPOS.map((g) => ({ ...g, itens: g.itens.filter((i) => !i.p || pode(...i.p)) })).filter((g) => g.itens.length);

  const nav = (
    <nav className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2 px-5 py-5">
        <span className="font-display text-xl font-semibold text-white">
          Ótica <span className="text-gold">MD</span>
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">gestão</span>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {grupos.map((g, i) => (
          <div key={i}>
            {g.titulo && <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-white/40">{g.titulo}</p>}
            {g.itens.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenu(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={17} /> {label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-white/10 p-3">
        <div className="px-3 pb-2 pt-1">
          <p className="truncate text-sm font-medium text-white">{usuario?.nome}</p>
          <p className="truncate text-xs text-white/50">{usuario?.perfil?.nome}</p>
        </div>
        <button
          onClick={() => {
            setMenu(false);
            setSenha(true);
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          <KeyRound size={17} /> Minha senha
        </button>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          <ExternalLink size={17} /> Ver site
        </a>
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white"
        >
          <LogOut size={17} /> Sair
        </button>
      </div>
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 text-ink">
        <aside className="nao-imprimir fixed inset-y-0 left-0 hidden w-60 bg-ink lg:block">{nav}</aside>

        <div className="nao-imprimir sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 lg:hidden">
          <span className="font-display text-lg text-white">
            Ótica <span className="text-gold">MD</span>
          </span>
          <button onClick={() => setMenu(true)} className="text-white" aria-label="Abrir menu">
            <Menu />
          </button>
        </div>
        {menu && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMenu(false)} />
            <aside className="absolute inset-y-0 left-0 w-64 bg-ink">
              <button onClick={() => setMenu(false)} className="absolute right-3 top-5 text-white/70" aria-label="Fechar menu">
                <X />
              </button>
              {nav}
            </aside>
          </div>
        )}

        <MinhaSenha aberto={senha} onFechar={() => setSenha(false)} />

        <main className="px-4 py-6 lg:ml-60 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
