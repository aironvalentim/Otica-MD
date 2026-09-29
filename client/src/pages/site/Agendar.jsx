import { useState } from 'react';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { hojeISO } from '../../lib/format';

export default function Agendar() {
  const [form, setForm] = useState({ nome: '', telefone: '', data_preferida: '', periodo: 'manha', mensagem: '', site: '' });
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await api.post('/publico/agendamentos', form);
      setOk(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const input = 'w-full rounded-xl border border-sand-dark bg-white px-4 py-3 outline-none focus:border-ink';

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 md:grid-cols-2">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-gold-dark">Exame de vista</p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl">Agende seu horário</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Deixe seu nome e WhatsApp. A gente confirma o dia e o horário com você pelo WhatsApp.
        </p>
        <ul className="mt-8 space-y-3 text-ink-soft">
          {['Atendimento com hora marcada', 'Receita pronta para escolher a armação na hora', 'Orçamento das lentes na mesma visita'].map((t) => (
            <li key={t} className="flex items-center gap-3">
              <CheckCircle2 size={18} className="text-gold-dark" /> {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-sand-dark/50">
        {ok ? (
          <div className="py-10 text-center">
            <CheckCircle2 size={48} className="mx-auto text-ok" />
            <h2 className="mt-4 font-display text-2xl">Pedido recebido!</h2>
            <p className="mt-2 text-muted">Vamos chamar você no WhatsApp para confirmar o horário.</p>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Nome completo</label>
              <input required minLength={3} value={form.nome} onChange={set('nome')} className={input} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">WhatsApp</label>
              <input required type="tel" placeholder="(81) 9 0000-0000" value={form.telefone} onChange={set('telefone')} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Data preferida</label>
                <input type="date" min={hojeISO()} value={form.data_preferida} onChange={set('data_preferida')} className={input} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Período</label>
                <select value={form.periodo} onChange={set('periodo')} className={input}>
                  <option value="manha">Manhã</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Observação (opcional)</label>
              <textarea rows={3} value={form.mensagem} onChange={set('mensagem')} className={input} placeholder="Ex.: uso multifocal, sinto dor de cabeça ao ler…" />
            </div>
            {/* campo-isca invisível contra robôs */}
            <input type="text" name="site" value={form.site} onChange={set('site')} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-bad">{erro}</p>}
            <button
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 font-medium text-cream transition hover:bg-ink-soft disabled:opacity-60"
            >
              <CalendarCheck size={18} /> {enviando ? 'Enviando…' : 'Solicitar agendamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
