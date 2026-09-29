import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { data, dataHora, linkWhatsApp, telefone } from '../../lib/format';
import { Cabecalho, Cartao, Etiqueta, Tabela, useToast } from '../../components/admin/ui';

const STATUS = {
  novo: { label: 'Novo', cor: 'blue' },
  confirmado: { label: 'Confirmado', cor: 'amber' },
  realizado: { label: 'Realizado', cor: 'green' },
  cancelado: { label: 'Cancelado', cor: 'zinc' },
};

export default function Agendamentos() {
  const avisar = useToast();
  const [filtro, setFiltro] = useState('');
  const { dados, recarregar } = useApi(`/agendamentos${filtro ? `?status=${filtro}` : ''}`);

  async function mudar(a, status) {
    await api.put(`/agendamentos/${a.id}`, { status });
    avisar('Agendamento atualizado');
    recarregar();
  }

  return (
    <>
      <Cabecalho titulo="Agendamentos de exame" subtitulo="Pedidos feitos pelo site" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[['', 'Todos'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className={`rounded-full px-3 py-1.5 ${filtro === k ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {l}
          </button>
        ))}
      </div>
      <Cartao semPadding>
        <Tabela
          linhas={dados}
          vazio="Nenhum agendamento."
          colunas={[
            {
              titulo: 'Nome',
              render: (a) => (
                <div>
                  <p className="font-medium">{a.nome}</p>
                  <p className="text-xs text-slate-500">pedido em {dataHora(a.criado_em)}</p>
                </div>
              ),
            },
            { titulo: 'WhatsApp', render: (a) => telefone(a.telefone) },
            { titulo: 'Preferência', render: (a) => `${data(a.data_preferida)}${a.periodo ? ` · ${a.periodo === 'manha' ? 'manhã' : 'tarde'}` : ''}` },
            { titulo: 'Mensagem', render: (a) => <span className="text-xs text-slate-600">{a.mensagem || '—'}</span> },
            { titulo: 'Status', render: (a) => <Etiqueta cor={STATUS[a.status].cor}>{STATUS[a.status].label}</Etiqueta> },
            {
              titulo: '',
              direita: true,
              render: (a) => (
                <div className="flex items-center justify-end gap-2">
                  <a
                    href={linkWhatsApp(
                      a.telefone,
                      `Olá, ${a.nome.split(' ')[0]}! Aqui é da Ótica MD. Recebemos seu pedido de exame de vista${a.data_preferida ? ` para ${data(a.data_preferida)}` : ''}. Podemos confirmar o horário?`
                    )}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-green-700 hover:bg-green-50"
                  >
                    <MessageCircle size={13} /> Chamar
                  </a>
                  <select value={a.status} onChange={(e) => mudar(a, e.target.value)} className="campo w-auto py-1 text-xs">
                    {Object.entries(STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              ),
            },
          ]}
        />
      </Cartao>
    </>
  );
}
