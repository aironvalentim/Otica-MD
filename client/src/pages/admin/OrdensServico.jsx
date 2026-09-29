import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { STATUS_OS, data, linkWhatsApp } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Etiqueta, Tabela, useToast } from '../../components/admin/ui';

export const PROXIMO = {
  aberta: 'enviada_laboratorio',
  enviada_laboratorio: 'em_montagem',
  em_montagem: 'pronta',
  pronta: 'entregue',
};

export function mensagemPronta(os) {
  return `Olá, ${os.cliente_nome.split(' ')[0]}! Seus óculos da Ótica MD (OS #${os.id}) estão prontos para retirada. Estamos te esperando!`;
}

export default function OrdensServico() {
  const navigate = useNavigate();
  const avisar = useToast();
  const [status, setStatus] = useState('pendentes');
  const { dados, recarregar } = useApi(`/os?status=${status}`);

  async function avancar(os, e) {
    e.stopPropagation();
    const novo = PROXIMO[os.status];
    await api.post(`/os/${os.id}/status`, { status: novo });
    avisar(`OS #${os.id}: ${STATUS_OS[novo].label}`);
    recarregar();
  }

  const abas = [['pendentes', 'Em andamento'], ...Object.entries(STATUS_OS).map(([k, v]) => [k, v.label])];

  return (
    <>
      <Cabecalho titulo="Ordens de serviço" subtitulo="Acompanhe cada óculos do laboratório até a entrega" />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {abas.map(([k, l]) => (
          <button
            key={k}
            onClick={() => setStatus(k)}
            className={`rounded-full px-3 py-1.5 ${status === k ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <Cartao semPadding>
        <Tabela
          linhas={dados}
          vazio="Nenhuma OS aqui."
          onLinha={(o) => navigate(`/admin/os/${o.id}`)}
          colunas={[
            { titulo: 'OS', render: (o) => <span className="font-medium">#{o.id}</span> },
            { titulo: 'Cliente', campo: 'cliente_nome' },
            { titulo: 'Lente', render: (o) => <span className="text-xs">{[o.tipo_lente, o.tratamentos].filter(Boolean).join(' · ')}</span> },
            { titulo: 'Laboratório', render: (o) => <span className="text-xs">{o.laboratorio_nome || '—'}</span> },
            {
              titulo: 'Previsão',
              render: (o) => <span className={o.atrasada ? 'font-medium text-red-600' : ''}>{data(o.previsao_entrega)}</span>,
            },
            { titulo: 'Status', render: (o) => <Etiqueta cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Etiqueta> },
            {
              titulo: '',
              direita: true,
              render: (o) => (
                <div className="flex justify-end gap-2">
                  {o.status === 'pronta' && o.cliente_telefone && (
                    <a
                      href={linkWhatsApp(o.cliente_telefone, mensagemPronta(o))}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <MessageCircle size={13} /> Avisar
                    </a>
                  )}
                  {PROXIMO[o.status] && (
                    <Botao tamanho="sm" variante="secundario" onClick={(e) => avancar(o, e)}>
                      {STATUS_OS[PROXIMO[o.status]].label} <ChevronRight size={13} />
                    </Botao>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Cartao>
    </>
  );
}
