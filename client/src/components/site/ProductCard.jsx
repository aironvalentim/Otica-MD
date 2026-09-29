import { Link } from 'react-router-dom';
import GlassesArt from './GlassesArt';
import { cap, moeda, precoFinal } from '../../lib/format';

export function ImagemProduto({ produto, className = '' }) {
  const img = produto.imagens?.[0];
  if (img) return <img src={img} alt={produto.nome} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  return (
    <div className={`flex h-full w-full items-center justify-center p-6 ${className}`}>
      <GlassesArt formato={produto.formato} cor={produto.cor} solar={produto.categoria === 'solar'} className="w-4/5" />
    </div>
  );
}

export default function ProductCard({ produto }) {
  const final = precoFinal(produto);
  const promo = final < produto.preco_venda;
  return (
    <Link to={`/produto/${produto.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand transition group-hover:bg-sand-dark/70">
        <ImagemProduto produto={produto} className="transition duration-500 group-hover:scale-105" />
        {promo && <span className="absolute left-3 top-3 rounded-full bg-gold px-2.5 py-1 text-xs font-semibold text-ink">Oferta</span>}
        {!produto.disponivel && (
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600">Sob encomenda</span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h3 className="font-medium leading-snug">{produto.nome}</h3>
          <p className="text-sm text-muted">
            {[produto.cor, cap(produto.formato)].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="sm:text-right">
          {promo && <p className="text-xs text-muted line-through">{moeda(produto.preco_venda)}</p>}
          <p className="font-semibold">{moeda(final)}</p>
        </div>
      </div>
      <p className="mt-0.5 text-xs text-muted">ou 10x de {moeda(final / 10)}</p>
    </Link>
  );
}
