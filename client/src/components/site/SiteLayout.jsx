import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X, MapPin, Clock, Instagram, MessageCircle, LockKeyhole } from 'lucide-react';
import { useLojaConfig } from '../../lib/hooks';
import { linkWhatsApp, telefone } from '../../lib/format';
import { useAuth } from '../../lib/auth';

const NAV = [
  { to: '/catalogo/armacao', label: 'Armações' },
  { to: '/catalogo/solar', label: 'Óculos de sol' },
  { to: '/#lentes', label: 'Lentes' },
  { to: '/agendar-exame', label: 'Exame de vista' },
];

export function Logo({ claro = false }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Ótica MD — início">
      <svg viewBox="0 0 48 24" className="h-6 w-12" aria-hidden="true">
        <g fill="none" stroke={claro ? '#e9b872' : '#16202e'} strokeWidth="3">
          <circle cx="12" cy="12" r="9" />
          <circle cx="36" cy="12" r="9" />
          <path d="M21 11c2-3 4-3 6 0" />
        </g>
      </svg>
      <span className={`font-display text-2xl font-semibold tracking-tight ${claro ? 'text-cream' : 'text-ink'}`}>
        Ótica <span className="text-gold-dark">MD</span>
      </span>
    </Link>
  );
}

export default function SiteLayout() {
  const [aberto, setAberto] = useState(false);
  const cfg = useLojaConfig();
  const { usuario } = useAuth();
  const rotuloAdmin = usuario ? 'Painel' : 'Admin';
  const whats = linkWhatsApp(cfg.loja_whatsapp, 'Olá! Vim pelo site da Ótica MD e gostaria de atendimento.');

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <div className="bg-ink px-4 py-2 text-center text-xs text-cream/90">
        Parcelamos em até <strong className="text-gold">10x sem juros</strong> · Ajustes e limpeza grátis para sempre
      </div>

      <header className="sticky top-0 z-30 border-b border-sand-dark/60 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            {NAV.map((n) =>
              n.to.includes('#') ? (
                <Link key={n.to} to={n.to} className="transition hover:text-gold-dark">
                  {n.label}
                </Link>
              ) : (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `transition hover:text-gold-dark ${isActive ? 'text-gold-dark' : ''}`}>
                  {n.label}
                </NavLink>
              )
            )}
          </nav>
          <div className="hidden items-center gap-4 md:flex">
            {/* Acesso discreto ao painel da equipe */}
            <Link
              to="/admin"
              target="_blank"
              rel="noopener"
              title="Área da equipe (abre em nova aba)"
              className="flex items-center gap-1 text-xs text-muted/70 transition hover:text-ink"
            >
              <LockKeyhole size={13} /> {rotuloAdmin}
            </Link>
            <a
              href={whats}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink-soft"
            >
              <MessageCircle size={16} /> Fale conosco
            </a>
          </div>
          <button className="md:hidden" onClick={() => setAberto(!aberto)} aria-label="Abrir menu">
            {aberto ? <X /> : <Menu />}
          </button>
        </div>
        {aberto && (
          <nav className="border-t border-sand-dark/60 px-4 pb-4 md:hidden">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setAberto(false)} className="block border-b border-sand py-3 text-base">
                {n.label}
              </Link>
            ))}
            <a href={whats} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-ink py-3 text-cream">
              <MessageCircle size={18} /> Fale conosco no WhatsApp
            </a>
            <Link
              to="/admin"
              target="_blank"
              rel="noopener"
              onClick={() => setAberto(false)}
              className="mt-4 flex items-center justify-center gap-1 text-xs text-muted/70 hover:text-ink"
            >
              <LockKeyhole size={12} /> Área da equipe
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-ink text-cream/80">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo claro />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Óculos de grau, óculos de sol e lentes com atendimento de perto, no centro de Vitória de Santo Antão.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <h3 className="font-display text-lg text-cream">Visite a loja</h3>
            <p className="flex gap-2">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gold" /> {cfg.loja_endereco || 'Centro, Vitória de Santo Antão - PE'}
            </p>
            <p className="flex gap-2">
              <Clock size={16} className="mt-0.5 shrink-0 text-gold" /> {cfg.loja_horario || 'Seg a Sáb'}
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <h3 className="font-display text-lg text-cream">Contato</h3>
            <a href={whats} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-gold">
              <MessageCircle size={16} className="mt-0.5 text-gold" /> {telefone(cfg.loja_whatsapp)}
            </a>
            {cfg.loja_instagram && (
              <a href={`https://instagram.com/${cfg.loja_instagram}`} target="_blank" rel="noreferrer" className="flex gap-2 hover:text-gold">
                <Instagram size={16} className="mt-0.5 text-gold" /> @{cfg.loja_instagram}
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 py-5 text-center text-xs text-cream/50">
          © {new Date().getFullYear()} Ótica MD · <Link to="/admin" target="_blank" rel="noopener" className="hover:text-cream">Área da equipe</Link>
        </div>
      </footer>

      <a
        href={whats}
        target="_blank"
        rel="noreferrer"
        aria-label="Conversar no WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition hover:scale-105"
      >
        <MessageCircle size={26} />
      </a>
    </div>
  );
}
