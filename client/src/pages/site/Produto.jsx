import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, CalendarCheck, ShieldCheck, Ruler, ArrowLeft } from 'lucide-react';
import ProductCard, { ImagemProduto } from '../../components/site/ProductCard';
import { useApi, useLojaConfig } from '../../lib/hooks';
import { CATEGORIAS, CATEGORIA_SING, GENEROS, cap, linkWhatsApp, moeda, precoFinal } from '../../lib/format';

function Medidas({ lente, ponte, haste }) {
  if (!lente && !ponte && !haste) return null;
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-sand-dark/50">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Ruler size={16} /> Medidas da armação
      </h3>
      <svg viewBox="0 0 260 70" className="w-full text-ink" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="30" y="14" width="80" height="44" rx="14" />
          <rect x="150" y="14" width="80" height="44" rx="14" />
          <path d="M110 30 q20 -12 40 0" />
        </g>
        <g stroke="#b9843c" strokeWidth="1.5">
          <line x1="30" y1="66" x2="110" y2="66" />
          <line x1="112" y1="8" x2="148" y2="8" />
        </g>
      </svg>
      <dl className="mt-2 grid grid-cols-3 text-center text-sm">
        <div>
          <dt className="text-muted">Lente</dt>
          <dd className="font-semibold">{lente ? `${lente} mm` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">Ponte</dt>
          <dd className="font-semibold">{ponte ? `${ponte} mm` : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted">Haste</dt>
          <dd className="font-semibold">{haste ? `${haste} mm` : '—'}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Dica: compare com as medidas gravadas na parte de dentro da haste do seu óculos atual.</p>
    </div>
  );
}

export default function Produto() {
  const { slug } = useParams();
  const { dados: p, erro, carregando } = useApi(`/publico/produtos/${slug}`);
  const cfg = useLojaConfig();
  const [foto, setFoto] = useState(0);

  if (carregando) return <div className="py-24 text-center text-muted">Carregando…</div>;
  if (erro || !p)
    return (
      <div className="py-24 text-center">
        <p className="font-display text-2xl">Produto não encontrado</p>
        <Link to="/catalogo" className="mt-4 inline-block underline">
          Voltar ao catálogo
        </Link>
      </div>
    );

  const final = precoFinal(p);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const msg = `Olá! Tenho interesse no ${p.nome}${p.cor ? ` (${p.cor})` : ''} por ${moeda(final)}. ${url}`;
  const specs = [
    ['Marca', p.marca],
    ['Modelo', p.modelo],
    ['Cor', p.cor],
    ['Formato', cap(p.formato)],
    ['Material', p.material],
    ['Indicado para', GENEROS[p.genero]],
  ].filter(([, v]) => v);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to={`/catalogo/${p.categoria}`} className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {CATEGORIAS[p.categoria]}
      </Link>

      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-sand">
            <ImagemProduto produto={{ ...p, imagens: p.imagens?.length ? [p.imagens[foto]] : [] }} />
          </div>
          {p.imagens?.length > 1 && (
            <div className="mt-3 flex gap-3">
              {p.imagens.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setFoto(i)}
                  className={`h-20 w-24 overflow-hidden rounded-xl bg-sand ring-2 ${i === foto ? 'ring-ink' : 'ring-transparent'}`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-sm font-medium uppercase tracking-[0.15em] text-gold-dark">{CATEGORIA_SING[p.categoria]}</p>
          <h1 className="mt-2 font-display text-4xl">{p.nome}</h1>
          {p.cor && <p className="mt-1 text-muted">{p.cor}</p>}

          <div className="mt-6">
            {final < p.preco_venda && <p className="text-muted line-through">{moeda(p.preco_venda)}</p>}
            <p className="text-3xl font-semibold">{moeda(final)}</p>
            <p className="text-sm text-muted">ou 10x de {moeda(final / 10)} no cartão</p>
          </div>

          <p className={`mt-4 text-sm font-medium ${p.disponivel ? 'text-ok' : 'text-warn'}`}>
            {p.disponivel ? '● Disponível na loja' : '● Sob encomenda: consulte o prazo'}
          </p>

          <div className="mt-6 space-y-3">
            <a
              href={linkWhatsApp(cfg.loja_whatsapp, msg)}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-medium text-cream transition hover:bg-ink-soft"
            >
              <MessageCircle size={18} /> Quero este modelo
            </a>
            {p.categoria === 'armacao' && (
              <Link
                to="/agendar-exame"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-ink py-3.5 font-medium transition hover:bg-ink hover:text-cream"
              >
                <CalendarCheck size={18} /> Preciso fazer exame de vista
              </Link>
            )}
          </div>

          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <ShieldCheck size={16} className="text-gold-dark" /> Reservamos o modelo para você provar na loja.
          </p>

          {p.descricao && <p className="mt-8 leading-relaxed text-ink-soft">{p.descricao}</p>}

          {specs.length > 0 && (
            <dl className="mt-8 divide-y divide-sand-dark/60 border-y border-sand-dark/60 text-sm">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-6">
            <Medidas lente={p.largura_lente} ponte={p.ponte} haste={p.haste} />
          </div>
        </div>
      </div>

      {p.relacionados?.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-8 font-display text-3xl">Você também pode gostar</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {p.relacionados.map((r) => (
              <ProductCard key={r.id} produto={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
