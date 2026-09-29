import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, ShoppingCart, MessageCircle } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { cpf, data, dataHora, hojeISO, linkWhatsApp, moeda, telefone, STATUS_OS } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Etiqueta, Modal, Tabela, useToast } from '../../components/admin/ui';
import ClienteForm from '../../components/admin/ClienteForm';
import { ReceitaForm, ReceitaTabela } from '../../components/admin/Receita';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const avisar = useToast();
  const { dados: c, recarregar } = useApi(`/clientes/${id}`);
  const [editar, setEditar] = useState(false);
  const [receita, setReceita] = useState(null); // null | {} (nova) | receita existente

  if (!c) return <p className="text-slate-500">Carregando…</p>;

  const idade = c.data_nascimento ? Math.floor((Date.now() - new Date(c.data_nascimento)) / 3.15576e10) : null;
  const emAberto = c.parcelas.filter((p) => p.status === 'aberta').reduce((s, p) => s + p.valor, 0);

  return (
    <>
      <Link to="/admin/clientes" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Clientes
      </Link>
      <Cabecalho titulo={c.nome} subtitulo={[telefone(c.telefone), c.cpf && `CPF ${cpf(c.cpf)}`, idade != null && `${idade} anos`].filter(Boolean).join(' · ')}>
        {c.telefone && (
          <a href={linkWhatsApp(c.telefone)} target="_blank" rel="noreferrer">
            <Botao variante="secundario">
              <MessageCircle size={16} /> WhatsApp
            </Botao>
          </a>
        )}
        <Botao variante="secundario" onClick={() => setEditar(true)}>
          <Pencil size={16} /> Editar
        </Botao>
        <Botao onClick={() => navigate(`/admin/pdv?cliente=${c.id}`)}>
          <ShoppingCart size={16} /> Vender
        </Botao>
      </Cabecalho>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao
            titulo="Receitas"
            acoes={
              <Botao tamanho="sm" variante="secundario" onClick={() => setReceita({})}>
                <Plus size={14} /> Nova receita
              </Botao>
            }
          >
            {c.receitas.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma receita cadastrada.</p>
            ) : (
              <div className="space-y-5">
                {c.receitas.map((r, i) => (
                  <div key={r.id} className={i > 0 ? 'border-t border-slate-100 pt-5 opacity-80' : ''}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{i === 0 ? 'Mais recente' : `Receita de ${data(r.data_receita)}`}</span>
                      <button onClick={() => setReceita(r)} className="text-xs underline">
                        editar
                      </button>
                    </div>
                    <ReceitaTabela r={r} />
                  </div>
                ))}
              </div>
            )}
          </Cartao>

          <Cartao titulo="Compras" semPadding>
            <Tabela
              linhas={c.vendas}
              vazio="Nenhuma compra ainda."
              onLinha={(v) => navigate(`/admin/vendas/${v.id}`)}
              colunas={[
                { titulo: '#', render: (v) => `#${v.id}` },
                { titulo: 'Data', render: (v) => dataHora(v.criado_em) },
                { titulo: 'Itens', render: (v) => <span className="text-xs">{v.itens}</span> },
                { titulo: 'Total', direita: true, render: (v) => (v.status === 'cancelada' ? <s className="text-slate-400">{moeda(v.total)}</s> : moeda(v.total)) },
              ]}
            />
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao titulo="Dados">
            <dl className="space-y-2 text-sm">
              {[
                ['Nascimento', data(c.data_nascimento)],
                ['E-mail', c.email],
                ['Endereço', [c.endereco, c.bairro, c.cidade].filter(Boolean).join(', ')],
                ['Cliente desde', data(c.criado_em)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd>{v || '—'}</dd>
                </div>
              ))}
              {c.observacoes && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">{c.observacoes}</p>}
            </dl>
          </Cartao>

          <Cartao titulo="Ordens de serviço">
            {c.ordens_servico.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {c.ordens_servico.map((o) => (
                  <li key={o.id}>
                    <Link to={`/admin/os/${o.id}`} className="flex items-center justify-between hover:underline">
                      <span>
                        OS #{o.id} <span className="text-xs text-slate-500">{o.tipo_lente}</span>
                      </span>
                      <Etiqueta cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Etiqueta>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>

          <Cartao titulo={`Crediário ${emAberto > 0 ? `· ${moeda(emAberto)} em aberto` : ''}`}>
            {c.parcelas.length === 0 ? (
              <p className="text-sm text-slate-500">Sem crediário.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {c.parcelas.map((p) => {
                  const atrasada = p.status === 'aberta' && p.vencimento < hojeISO();
                  return (
                    <li key={p.id} className="flex items-center justify-between">
                      <span>
                        {p.numero}/{p.total_parcelas} · {data(p.vencimento)}
                      </span>
                      <span className="flex items-center gap-2">
                        {moeda(p.valor)}
                        {p.status === 'paga' ? <Etiqueta cor="green">paga</Etiqueta> : atrasada ? <Etiqueta cor="red">atrasada</Etiqueta> : <Etiqueta>aberta</Etiqueta>}
                      </span>
                    </li>
                  );
                })}
                <li className="pt-2">
                  <Link to={`/admin/crediario?cliente_id=${c.id}`} className="text-xs underline">
                    Receber parcelas
                  </Link>
                </li>
              </ul>
            )}
          </Cartao>
        </div>
      </div>

      <Modal aberto={editar} onFechar={() => setEditar(false)} titulo="Editar cliente" largura="max-w-2xl">
        <ClienteForm
          inicial={c}
          onSalvo={() => {
            setEditar(false);
            avisar('Cliente atualizado');
            recarregar();
          }}
        />
      </Modal>
      <Modal aberto={!!receita} onFechar={() => setReceita(null)} titulo={receita?.id ? 'Editar receita' : 'Nova receita'} largura="max-w-3xl">
        {receita && (
          <ReceitaForm
            clienteId={c.id}
            inicial={receita.id ? receita : null}
            onSalvo={() => {
              setReceita(null);
              avisar('Receita salva');
              recarregar();
            }}
          />
        )}
      </Modal>
    </>
  );
}
