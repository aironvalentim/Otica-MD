import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, Search } from 'lucide-react';
import ProductCard from '../../components/site/ProductCard';
import { useApi, useDebounce } from '../../lib/hooks';
import { qs } from '../../lib/api';
import { CATEGORIAS, GENEROS, cap } from '../../lib/format';

const ORDENS = [
  ['', 'Relevância'],
  ['menor_preco', 'Menor preço'],
  ['maior_preco', 'Maior preço'],
  ['recentes', 'Novidades'],
];

function GrupoFiltro({ titulo, opcoes, selecionados, onToggle, rotulo = cap }) {
  if (!opcoes?.length) return null;
  return (
    <fieldset className="border-b border-sand-dark/60 py-5">
      <legend className="mb-3 text-sm font-semibold">{titulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => {
          const ativo = selecionados.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                ativo ? 'border-ink bg-ink text-cream' : 'border-sand-dark bg-white hover:border-ink'
              }`}
            >
              {rotulo(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function Catalogo() {
  const { categoria } = useParams();
  const [params, setParams] = useSearchParams();
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [busca, setBusca] = useState(params.get('busca') || '');
  const buscaDebounced = useDebounce(busca);

  const lista = (k) => (params.get(k) ? params.get(k).split(',') : []);
  const sel = { genero: lista('genero'), formato: lista('formato'), material: lista('material'), marca: lista('marca') };
  const ordem = params.get('ordem') || '';

  const toggle = (chave) => (valor) => {
    const atual = lista(chave);
    const novo = atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor];
    const p = new URLSearchParams(params);
    if (novo.length) p.set(chave, novo.join(','));
    else p.delete(chave);
    setParams(p, { replace: true });
  };

  const limpar = () => setParams(new URLSearchParams(), { replace: true });
  const totalFiltros = Object.values(sel).reduce((s, v) => s + v.length, 0);

  const query = useMemo(
    () =>
      qs({
        categoria: categoria || '',
        genero: sel.genero.join(','),
        formato: sel.formato.join(','),
        material: sel.material.join(','),
        marca: sel.marca.join(','),
        ordem,
        busca: buscaDebounced,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoria, params, buscaDebounced]
  );

  const { dados: produtos, carregando } = useApi(`/publico/produtos${query}`);
  const { dados: filtros } = useApi('/publico/filtros');

  const titulo = categoria ? CATEGORIAS[categoria] : 'Todos os produtos';

  const painel = (
    <>
      <GrupoFiltro titulo="Para quem" opcoes={filtros?.generos} selecionados={sel.genero} onToggle={toggle('genero')} rotulo={(g) => GENEROS[g] || g} />
      <GrupoFiltro titulo="Formato" opcoes={filtros?.formatos} selecionados={sel.formato} onToggle={toggle('formato')} />
      <GrupoFiltro titulo="Material" opcoes={filtros?.materiais} selecionados={sel.material} onToggle={toggle('material')} />
      <GrupoFiltro titulo="Marca" opcoes={filtros?.marcas} selecionados={sel.marca} onToggle={toggle('marca')} rotulo={(m) => m} />
      {totalFiltros > 0 && (
        <button onClick={limpar} className="mt-4 text-sm font-medium underline underline-offset-4">
          Limpar filtros
        </button>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="mb-2 text-sm text-muted">
        <Link to="/" className="hover:text-ink">
          Início
        </Link>{' '}
        / {titulo}
      </nav>
      <h1 className="font-display text-4xl">{titulo}</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {[['', 'Todos'], ['armacao', 'Armações'], ['solar', 'Óculos de sol'], ['acessorio', 'Acessórios']].map(([c, l]) => (
          <Link
            key={c}
            to={`/catalogo${c ? '/' + c : ''}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              (categoria || '') === c ? 'bg-ink text-cream' : 'bg-sand hover:bg-sand-dark'
            }`}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, marca ou cor"
            className="w-full rounded-full border border-sand-dark bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-ink"
          />
        </div>
        <button
          onClick={() => setFiltrosAbertos(true)}
          className="flex items-center gap-2 rounded-full border border-sand-dark bg-white px-4 py-2.5 text-sm md:hidden"
        >
          <SlidersHorizontal size={16} /> Filtros {totalFiltros > 0 && `(${totalFiltros})`}
        </button>
        <select
          value={ordem}
          onChange={(e) => {
            const p = new URLSearchParams(params);
            if (e.target.value) p.set('ordem', e.target.value);
            else p.delete('ordem');
            setParams(p, { replace: true });
          }}
          className="rounded-full border border-sand-dark bg-white px-4 py-2.5 text-sm outline-none"
          aria-label="Ordenar"
        >
          {ORDENS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[220px_1fr]">
        <aside className="hidden md:block">{painel}</aside>

        <section>
          <p className="mb-5 text-sm text-muted">{carregando ? 'Carregando…' : `${produtos?.length || 0} produto(s)`}</p>
          {!carregando && produtos?.length === 0 && (
            <div className="rounded-2xl bg-sand p-10 text-center">
              <p className="font-medium">Nenhum produto com esses filtros.</p>
              <button onClick={limpar} className="mt-3 text-sm underline underline-offset-4">
                Limpar filtros
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3">
            {produtos?.map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </section>
      </div>

      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFiltrosAbertos(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-cream p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Filtros</h2>
              <button onClick={() => setFiltrosAbertos(false)} aria-label="Fechar">
                <X />
              </button>
            </div>
            {painel}
            <button onClick={() => setFiltrosAbertos(false)} className="mt-6 w-full rounded-full bg-ink py-3 font-medium text-cream">
              Ver {produtos?.length || 0} produto(s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
