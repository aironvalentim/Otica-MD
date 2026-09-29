import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CreditCard, Sparkles, Wrench, MessageCircle, MapPin } from 'lucide-react';
import GlassesArt from '../../components/site/GlassesArt';
import ProductCard from '../../components/site/ProductCard';
import { useApi, useLojaConfig } from '../../lib/hooks';
import { linkWhatsApp } from '../../lib/format';

const VANTAGENS = [
  { icon: CalendarCheck, titulo: 'Exame de vista', texto: 'Agende pelo site e resolva receita e óculos no mesmo lugar.' },
  { icon: CreditCard, titulo: 'Até 10x no cartão', texto: 'Ou no crediário da loja, com parcelas que cabem no mês.' },
  { icon: Sparkles, titulo: 'Lentes sob medida', texto: 'Multifocal, antirreflexo, filtro azul e fotossensível.' },
  { icon: Wrench, titulo: 'Ajustes grátis', texto: 'Limpeza, parafusos e plaquetas sem custo, sempre.' },
];

// Guia de formato de rosto (inspirado nos grandes e-commerces de óculos)
const ROSTOS = [
  { rosto: 'Redondo', dica: 'Linhas retas equilibram as curvas do rosto.', formatos: ['quadrado', 'retangular'] },
  { rosto: 'Quadrado', dica: 'Curvas suavizam o maxilar marcado.', formatos: ['redondo', 'oval'] },
  { rosto: 'Oval', dica: 'Quase tudo combina. Aposte em armações marcantes.', formatos: ['hexagonal', 'aviador'] },
  { rosto: 'Coração', dica: 'Base mais larga que a testa equilibra o queixo fino.', formatos: ['gatinho', 'oval'] },
];

const LENTES = [
  { nome: 'Visão simples', texto: 'Para quem precisa enxergar só de longe ou só de perto. Finas, leves e com antirreflexo.' },
  { nome: 'Multifocal', texto: 'Longe, meio e perto na mesma lente, sem a linha do bifocal. Ideal a partir dos 40 anos.' },
  { nome: 'Filtro de luz azul', texto: 'Mais conforto para quem passa horas no celular e no computador.' },
  { nome: 'Fotossensível', texto: 'Escurece no sol e clareia em ambientes internos. Um óculos só para o dia todo.' },
];

export default function Home() {
  const { hash } = useLocation();
  const cfg = useLojaConfig();
  const { dados: destaques } = useApi('/publico/produtos?destaque=true');

  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [hash]);

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-gold-dark">Vitória de Santo Antão · Centro</p>
            <h1 className="font-display text-4xl leading-[1.08] font-medium md:text-6xl">
              Enxergar bem, <em className="text-gold-dark">sem complicação.</em>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              Armações escolhidas a dedo, lentes feitas para a sua receita e um atendimento que explica tudo com calma.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/catalogo/armacao" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream transition hover:bg-ink-soft">
                Ver armações <ArrowRight size={18} />
              </Link>
              <Link to="/agendar-exame" className="inline-flex items-center gap-2 rounded-full border border-ink px-6 py-3 font-medium transition hover:bg-ink hover:text-cream">
                Agendar exame de vista
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -right-10 -top-10 h-72 w-72 rounded-full bg-gold/30 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[2rem] bg-sand p-10 md:p-14">
              <GlassesArt formato="redondo" cor="tartaruga" className="w-full drop-shadow-xl" />
              <div className="mt-6 flex justify-between text-sm text-ink-soft">
                <span>Formato redondo</span>
                <span className="font-medium">Acetato tartaruga</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* VANTAGENS */}
      <section className="border-y border-sand-dark/60 bg-white/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {VANTAGENS.map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sand text-gold-dark">
                <Icon size={20} />
              </div>
              <div>
                <h3 className="font-semibold">{titulo}</h3>
                <p className="mt-1 text-sm text-muted">{texto}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CATEGORIAS */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { to: '/catalogo/armacao', titulo: 'Armações de grau', formato: 'retangular', cor: 'preto' },
            { to: '/catalogo/solar', titulo: 'Óculos de sol', formato: 'aviador', cor: 'dourado', solar: true },
            { to: '/#lentes', titulo: 'Lentes', formato: 'oval', cor: 'transparente' },
          ].map((c) => (
            <Link key={c.titulo} to={c.to} className="group relative overflow-hidden rounded-3xl bg-sand p-8 transition hover:bg-sand-dark/70">
              <GlassesArt formato={c.formato} cor={c.cor} solar={c.solar} className="mx-auto w-3/4 transition duration-500 group-hover:-rotate-3 group-hover:scale-105" />
              <div className="mt-6 flex items-center justify-between">
                <h2 className="font-display text-2xl">{c.titulo}</h2>
                <ArrowRight className="transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      {destaques?.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-16">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-3xl md:text-4xl">Mais procurados</h2>
            <Link to="/catalogo" className="flex items-center gap-1 text-sm font-medium hover:text-gold-dark">
              Ver tudo <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-4">
            {destaques.slice(0, 8).map((p) => (
              <ProductCard key={p.id} produto={p} />
            ))}
          </div>
        </section>
      )}

      {/* FORMATO DO ROSTO */}
      <section className="bg-ink py-16 text-cream">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="font-display text-3xl md:text-4xl">Qual armação combina com seu rosto?</h2>
          <p className="mt-3 max-w-xl text-cream/70">Escolha o formato do seu rosto e veja as armações que mais valorizam seus traços.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROSTOS.map((r) => (
              <Link
                key={r.rosto}
                to={`/catalogo/armacao?formato=${r.formatos.join(',')}`}
                className="group rounded-2xl border border-white/10 p-6 transition hover:border-gold hover:bg-white/5"
              >
                <h3 className="font-display text-xl text-gold">Rosto {r.rosto.toLowerCase()}</h3>
                <p className="mt-2 text-sm text-cream/70">{r.dica}</p>
                <p className="mt-4 flex items-center gap-1 text-sm font-medium">
                  Ver {r.formatos.join(' e ')} <ArrowRight size={14} className="transition group-hover:translate-x-1" />
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LENTES */}
      <section id="lentes" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16">
        <div className="grid gap-12 md:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">Lentes certas para a sua rotina</h2>
            <p className="mt-4 text-ink-soft">
              Trabalhamos com os principais laboratórios. Traga sua receita e a gente mostra as opções lado a lado, com o preço de cada uma.
            </p>
            <a
              href={linkWhatsApp(cfg.loja_whatsapp, 'Olá! Tenho uma receita e quero um orçamento de lentes.')}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink-soft"
            >
              <MessageCircle size={18} /> Enviar minha receita
            </a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {LENTES.map((l) => (
              <div key={l.nome} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-sand-dark/50">
                <h3 className="font-semibold">{l.nome}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{l.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EXAME + LOCALIZAÇÃO */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid overflow-hidden rounded-3xl bg-sand md:grid-cols-2">
          <div className="p-10 md:p-14">
            <h2 className="font-display text-3xl">Faz mais de um ano do seu último exame?</h2>
            <p className="mt-4 text-ink-soft">
              A partir dos 40 anos a vista muda mais rápido. Agende seu horário e saia com a receita e o orçamento na mão.
            </p>
            <Link to="/agendar-exame" className="mt-7 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-medium text-cream hover:bg-ink-soft">
              <CalendarCheck size={18} /> Agendar exame
            </Link>
            <p className="mt-8 flex items-start gap-2 text-sm text-ink-soft">
              <MapPin size={16} className="mt-0.5 shrink-0 text-gold-dark" /> {cfg.loja_endereco}
            </p>
          </div>
          <iframe
            title="Mapa da Ótica MD"
            className="h-72 w-full md:h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${encodeURIComponent(cfg.loja_endereco || 'Vitória de Santo Antão PE')}&output=embed`}
          />
        </div>
      </section>
    </>
  );
}
