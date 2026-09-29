import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Botao({ variante = 'primario', tamanho = 'md', carregando, className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50';
  const tamanhos = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  const variantes = {
    primario: 'bg-ink text-white hover:bg-ink-soft',
    secundario: 'border border-slate-300 bg-white text-ink hover:bg-slate-50',
    perigo: 'bg-red-600 text-white hover:bg-red-700',
    sucesso: 'bg-green-600 text-white hover:bg-green-700',
    fantasma: 'text-slate-600 hover:bg-slate-100',
  };
  return (
    <button className={`${base} ${tamanhos[tamanho]} ${variantes[variante]} ${className}`} disabled={carregando || props.disabled} {...props}>
      {carregando && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Campo({ label, children, className = '', dica }) {
  return (
    <label className={`block ${className}`}>
      {label && <span className="rotulo">{label}</span>}
      {children}
      {dica && <span className="mt-1 block text-xs text-slate-500">{dica}</span>}
    </label>
  );
}

export function Cartao({ titulo, acoes, children, className = '', semPadding = false }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">{titulo}</h2>
          {acoes}
        </header>
      )}
      <div className={semPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

export function Cabecalho({ titulo, subtitulo, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const CORES_BADGE = {
  slate: 'bg-slate-100 text-slate-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-800',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-700',
  zinc: 'bg-zinc-100 text-zinc-500',
  gold: 'bg-amber-100 text-amber-900',
};

export function Etiqueta({ cor = 'slate', children }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CORES_BADGE[cor]}`}>{children}</span>;
}

export function Tabela({ colunas, linhas, vazio = 'Nada por aqui ainda.', onLinha, chave = 'id' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            {colunas.map((c, i) => (
              <th key={c.chaveColuna || (typeof c.titulo === 'string' ? c.titulo : i)} className={`whitespace-nowrap px-4 py-2.5 font-medium ${c.direita ? 'text-right' : ''}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas?.length ? (
            linhas.map((l) => (
              <tr
                key={l[chave]}
                onClick={onLinha ? () => onLinha(l) : undefined}
                className={`border-b border-slate-100 last:border-0 ${onLinha ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              >
                {colunas.map((c, i) => (
                  <td key={c.chaveColuna || (typeof c.titulo === 'string' ? c.titulo : i)} className={`px-4 py-2.5 ${c.direita ? 'text-right tabular-nums' : ''} ${c.classe || ''}`}>
                    {c.render ? c.render(l) : l[c.campo]}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={colunas.length} className="px-4 py-10 text-center text-slate-500">
                {linhas ? vazio : 'Carregando…'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ aberto, onFechar, titulo, children, largura = 'max-w-lg' }) {
  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [aberto, onFechar]);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh]" onMouseDown={onFechar}>
      <div className={`w-full ${largura} rounded-xl bg-white shadow-xl`} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">{titulo}</h2>
          <button onClick={onFechar} className="text-slate-400 hover:text-ink" aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Indicador({ titulo, valor, detalhe, icone: Icone, cor = 'text-ink' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
        {Icone && <Icone size={16} className="text-slate-400" />}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function Erro({ children }) {
  if (!children) return null;
  return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</p>;
}

// ---- Notificações (toast) ----
const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);
  const avisar = useCallback((msg, tipo = 'ok') => {
    const id = Math.random();
    setItens((l) => [...l, { id, msg, tipo }]);
    setTimeout(() => setItens((l) => l.filter((i) => i.id !== id)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={avisar}>
      {children}
      <div className="nao-imprimir fixed bottom-4 right-4 z-[60] space-y-2">
        {itens.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.tipo === 'erro' ? 'bg-red-600' : 'bg-ink'}`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
