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
} from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { ToastProvider } from './ui';

const GRUPOS = [
  {
    titulo: null,
    itens: [
      { to: '/admin', label: 'Painel', icon: LayoutDashboard, end: true },
      { to: '/admin/pdv', label: 'Nova venda', icon: ShoppingCart },
    ],
  },
  {
    titulo: 'Vendas',
    itens: [
      { to: '/admin/vendas', label: 'Vendas', icon: Receipt },
      { to: '/admin/caixa', label: 'Caixa', icon: Wallet },
      { to: '/admin/crediario', label: 'Crediário', icon: HandCoins },
    ],
  },
  {
    titulo: 'Atendimento',
    itens: [
      { to: '/admin/clientes', label: 'Clientes e receitas', icon: Users },
      { to: '/admin/os', label: 'Ordens de serviço', icon: Wrench },
      { to: '/admin/agendamentos', label: 'Agendamentos', icon: CalendarDays },
    ],
  },
  {
    titulo: 'Estoque',
    itens: [
      { to: '/admin/produtos', label: 'Produtos', icon: Package, end: true },
      { to: '/admin/estoque', label: 'Entradas e saídas', icon: ArrowLeftRight },
      { to: '/admin/produtos/importar', label: 'Importar planilha', icon: FileSpreadsheet, admin: true },
      { to: '/admin/precos', label: 'Preços em massa', icon: Percent, admin: true },
      { to: '/admin/etiquetas', label: 'Etiquetas', icon: Tag },
    ],
  },
];

export default function AdminLayout() {
  const { usuario, logout } = useAuth();
  const [menu, setMenu] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col">
      <Link to="/admin" className="flex items-center gap-2 px-5 py-5">
        <span className="font-display text-xl font-semibold text-white">
          Ótica <span className="text-gold">MD</span>
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">gestão</span>
      </Link>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {GRUPOS.map((g, i) => (
          <div key={i}>
            {g.titulo && <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-wider text-white/40">{g.titulo}</p>}
            {g.itens.filter((i) => !i.admin || usuario?.papel === 'admin').map(({ to, label, icon: Icon, end }) => (
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
        {usuario?.papel === 'admin' && (
          <NavLink to="/admin/configuracoes" onClick={() => setMenu(false)} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
            <Settings size={17} /> Configurações
          </NavLink>
        )}
        <a href="/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <ExternalLink size={17} /> Ver site
        </a>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/5 hover:text-white">
          <LogOut size={17} /> Sair ({usuario?.nome?.split(' ')[0]})
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

        <main className="px-4 py-6 lg:ml-60 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
