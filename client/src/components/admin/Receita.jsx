import { useState } from 'react';
import { api } from '../../lib/api';
import { data, grau, hojeISO } from '../../lib/format';
import { Botao, Campo, Erro } from './ui';

const OLHOS = [
  ['od', 'OD (direito)'],
  ['oe', 'OE (esquerdo)'],
];
const COLUNAS = [
  ['esferico', 'Esférico', 0.25],
  ['cilindrico', 'Cilíndrico', 0.25],
  ['eixo', 'Eixo', 1],
  ['adicao', 'Adição', 0.25],
  ['dnp', 'DNP', 0.5],
  ['altura', 'Altura', 0.5],
];

// Tabela de leitura de uma receita (usada na ficha, na OS e na venda)
export function ReceitaTabela({ r }) {
  if (!r) return null;
  const fmt = (col, v) => (v == null || v === '' ? '—' : col === 'eixo' ? `${v}°` : ['dnp', 'altura'].includes(col) ? String(v).replace('.', ',') : grau(v));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-slate-500">
            <th className="py-1 text-left font-medium" />
            {COLUNAS.map(([k, l]) => (
              <th key={k} className="px-2 py-1 font-medium">
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OLHOS.map(([o, l]) => (
            <tr key={o} className="border-t border-slate-100">
              <td className="py-1.5 text-left text-xs font-semibold">{l}</td>
              {COLUNAS.map(([k]) => (
                <td key={k} className="px-2 py-1.5">
                  {fmt(k, r[`${o}_${k}`])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        {data(r.data_receita)}
        {r.medico && ` · Dr(a). ${r.medico}`}
        {r.crm && ` · CRM ${r.crm}`}
        {r.validade && ` · válida até ${data(r.validade)}`}
      </p>
      {r.observacoes && <p className="mt-1 text-xs text-slate-600">{r.observacoes}</p>}
    </div>
  );
}

export function ReceitaForm({ clienteId, inicial, onSalvo }) {
  const campos = ['medico', 'crm', 'data_receita', 'validade', 'observacoes', ...OLHOS.flatMap(([o]) => COLUNAS.map(([k]) => `${o}_${k}`))];
  const [f, setF] = useState(Object.fromEntries(campos.map((c) => [c, inicial?.[c] ?? (c === 'data_receita' ? hojeISO() : '')])));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value.replace(',', '.') });

  async function salvar(e) {
    e.preventDefault();
    e.stopPropagation();
    setErro('');
    setSalvando(true);
    try {
      const corpo = { ...f, cliente_id: clienteId };
      const r = inicial?.id ? await api.put(`/receitas/${inicial.id}`, corpo) : await api.post('/receitas', corpo);
      onSalvo(r);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th />
              {COLUNAS.map(([k, l]) => (
                <th key={k} className="px-1 pb-1 font-medium">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {OLHOS.map(([o, l]) => (
              <tr key={o}>
                <td className="whitespace-nowrap pr-2 text-xs font-semibold">{l}</td>
                {COLUNAS.map(([k, , passo]) => (
                  <td key={k} className="px-1 py-1">
                    <input
                      type="number"
                      step={passo}
                      value={f[`${o}_${k}`]}
                      onChange={set(`${o}_${k}`)}
                      className="campo px-2 text-center tabular-nums"
                      min={k === 'eixo' ? 0 : k === 'adicao' || k === 'dnp' || k === 'altura' ? 0 : undefined}
                      max={k === 'eixo' ? 180 : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-xs text-slate-500">Use sinal de menos para graus negativos (miopia). Esférico e cilíndrico em passos de 0,25.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Campo label="Médico(a)" className="sm:col-span-2">
          <input value={f.medico} onChange={(e) => setF({ ...f, medico: e.target.value })} className="campo" />
        </Campo>
        <Campo label="CRM">
          <input value={f.crm} onChange={(e) => setF({ ...f, crm: e.target.value })} className="campo" />
        </Campo>
        <Campo label="Data da receita">
          <input type="date" value={f.data_receita} onChange={(e) => setF({ ...f, data_receita: e.target.value })} className="campo" />
        </Campo>
        <Campo label="Validade">
          <input type="date" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} className="campo" />
        </Campo>
        <Campo label="Observações" className="sm:col-span-3">
          <input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className="campo" />
        </Campo>
      </div>
      <Erro>{erro}</Erro>
      <Botao type="submit" carregando={salvando} className="w-full">
        Salvar receita
      </Botao>
    </form>
  );
}
