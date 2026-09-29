import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useDebounce } from '../../lib/hooks';
import { CATEGORIA_SING, moeda, precoFinal } from '../../lib/format';

// Campo de busca com lista de sugestões. Chama onSelecionar(produto).
export default function ProdutoBusca({ onSelecionar, placeholder = 'Buscar produto por nome, SKU ou marca…', autoFocus, limparAoSelecionar = true }) {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const t = useDebounce(texto, 200);
  const caixa = useRef(null);

  useEffect(() => {
    if (!t.trim()) return setItens([]);
    let cancelado = false;
    api
      .get(`/produtos${qs({ busca: t })}`)
      .then((r) => {
        if (cancelado) return;
        setItens(r.slice(0, 8));
        setAtivo(0);
      })
      .catch(() => !cancelado && setItens([]));
    return () => {
      cancelado = true;
    };
  }, [t]);

  useEffect(() => {
    const fora = (e) => caixa.current && !caixa.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, []);

  function escolher(p) {
    onSelecionar(p);
    setTexto(limparAoSelecionar ? '' : p.nome);
    setItens([]);
    setAberto(false);
  }

  // Leitor de código de barras: digita o código e aperta Enter muito rápido.
  // Enter com texto sem sugestões na tela -> busca pelo código exato.
  async function porCodigo() {
    const codigo = texto.trim();
    if (!codigo) return;
    try {
      escolher(await api.get(`/produtos/codigo/${encodeURIComponent(codigo)}`));
    } catch {
      setAberto(true);
    }
  }

  function tecla(e) {
    if (e.key === 'Enter' && (!itens.length || t !== texto)) {
      e.preventDefault();
      porCodigo();
      return;
    }
    if (!itens.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, itens.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      escolher(itens[ativo]);
    }
  }

  return (
    <div ref={caixa} className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={texto}
        autoFocus={autoFocus}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={tecla}
        placeholder={placeholder}
        className="campo pl-9"
      />
      {aberto && itens.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {itens.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => escolher(p)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === ativo ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <span>
                  <span className="font-medium">{p.nome}</span>
                  <span className="block text-xs text-slate-500">
                    {[CATEGORIA_SING[p.categoria], p.sku, p.cor].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-medium">{moeda(precoFinal(p))}</span>
                  <span className={`text-xs ${p.controla_estoque && p.estoque_atual <= 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {p.controla_estoque ? `${p.estoque_atual} em estoque` : 'sob encomenda'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
