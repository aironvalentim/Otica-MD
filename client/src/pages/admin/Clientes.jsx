import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, MessageCircle } from 'lucide-react';
import { useApi, useDebounce } from '../../lib/hooks';
import { qs } from '../../lib/api';
import { cpf, data, linkWhatsApp, moeda, telefone } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Modal, Tabela } from '../../components/admin/ui';
import ClienteForm from '../../components/admin/ClienteForm';

function Lembretes() {
  const { dados } = useApi('/receitas/lembretes');
  return (
    <Cartao titulo="Clientes com receita de mais de 1 ano" semPadding>
      <p className="px-5 pt-4 text-sm text-slate-500">
        Boa hora para chamar para um novo exame. A mensagem já vai pronta no WhatsApp.
      </p>
      <Tabela
        chave="cliente_id"
        linhas={dados}
        vazio="Nenhum cliente com receita vencida."
        colunas={[
          { titulo: 'Cliente', campo: 'nome' },
          { titulo: 'Última receita', render: (r) => `${data(r.data_receita)} (${Math.floor(r.dias / 30)} meses)` },
          {
            titulo: '',
            direita: true,
            render: (r) =>
              r.telefone ? (
                <a
                  href={linkWhatsApp(
                    r.telefone,
                    `Olá, ${r.nome.split(' ')[0]}! Aqui é da Ótica MD. Já faz mais de um ano do seu último exame de vista. Que tal agendar uma nova consulta e ver as novidades em armações?`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-green-700 hover:underline"
                >
                  <MessageCircle size={15} /> Enviar lembrete
                </a>
              ) : (
                <span className="text-xs text-slate-400">sem telefone</span>
              ),
          },
        ]}
      />
    </Cartao>
  );
}

export default function Clientes() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const b = useDebounce(busca);
  const { dados } = useApi(`/clientes${qs({ busca: b })}`);
  const aba = params.get('lembretes') ? 'lembretes' : 'todos';

  return (
    <>
      <Cabecalho titulo="Clientes e receitas">
        <Botao onClick={() => setNovo(true)}>
          <Plus size={16} /> Novo cliente
        </Botao>
      </Cabecalho>

      <div className="mb-4 flex gap-2 text-sm">
        {[
          ['todos', 'Todos os clientes'],
          ['lembretes', 'Lembrete de troca'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setParams(k === 'lembretes' ? { lembretes: '1' } : {})}
            className={`rounded-full px-4 py-1.5 ${aba === k ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {aba === 'lembretes' ? (
        <Lembretes />
      ) : (
        <Cartao semPadding>
          <div className="border-b border-slate-100 p-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CPF ou telefone" className="campo pl-9" />
            </div>
          </div>
          <Tabela
            linhas={dados}
            onLinha={(c) => navigate(`/admin/clientes/${c.id}`)}
            colunas={[
              { titulo: 'Nome', render: (c) => <span className="font-medium">{c.nome}</span> },
              { titulo: 'Telefone', render: (c) => telefone(c.telefone) },
              { titulo: 'CPF', render: (c) => cpf(c.cpf) },
              { titulo: 'Última compra', render: (c) => (c.ultima_compra ? data(c.ultima_compra) : '—') },
              {
                titulo: 'Crediário em aberto',
                direita: true,
                render: (c) => (c.saldo_crediario > 0 ? <span className="font-medium text-amber-700">{moeda(c.saldo_crediario)}</span> : '—'),
              },
            ]}
          />
        </Cartao>
      )}

      <Modal aberto={novo} onFechar={() => setNovo(false)} titulo="Novo cliente" largura="max-w-2xl">
        <ClienteForm onSalvo={(c) => navigate(`/admin/clientes/${c.id}`)} />
      </Modal>
    </>
  );
}
