import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { FORMAS_PAGAMENTO, data, linkWhatsApp, moeda } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Etiqueta, Indicador, Modal, Tabela, useToast } from '../../components/admin/ui';

function Receber({ parcela, onPago }) {
  const [forma, setForma] = useState('dinheiro');
  const [valor, setValor] = useState(parcela.valor);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function ok() {
    setErro('');
    setSalvando(true);
    try {
      await api.post(`/crediario/parcelas/${parcela.id}/pagar`, { forma_pagamento: forma, valor_pago: valor });
      onPago();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm">
        {parcela.cliente_nome} · parcela {parcela.numero}/{parcela.total_parcelas} · vence {data(parcela.vencimento)}
        {parcela.dias_atraso > 0 && <span className="text-red-600"> · {parcela.dias_atraso} dia(s) de atraso</span>}
      </p>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Forma">
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="campo">
            {['dinheiro', 'pix', 'debito', 'credito'].map((f) => (
              <option key={f} value={f}>
                {FORMAS_PAGAMENTO[f]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Valor recebido (R$)" dica="Altere se cobrar juros ou multa">
          <input type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="campo" />
        </Campo>
      </div>
      <Erro>{erro}</Erro>
      <Botao variante="sucesso" className="w-full" carregando={salvando} onClick={ok}>
        Confirmar recebimento
      </Botao>
    </div>
  );
}

export default function Crediario() {
  const avisar = useToast();
  const [params] = useSearchParams();
  const [situacao, setSituacao] = useState(params.get('situacao') || '');
  const [status, setStatus] = useState('aberta');
  const clienteId = params.get('cliente_id') || '';
  const { dados, recarregar } = useApi(`/crediario/parcelas${qs({ status, situacao, cliente_id: clienteId })}`);
  const { pode } = useAuth();
  const { dados: resumo, recarregar: recarregarResumo } = useApi(pode('relatorios.financeiro') ? '/crediario/resumo' : null);
  const [receber, setReceber] = useState(null);

  return (
    <>
      <Cabecalho
        titulo="Crediário"
        subtitulo={clienteId && dados?.[0] ? `Cliente: ${dados[0].cliente_nome}` : 'Carnês e contas a receber da loja'}
      />

      {resumo && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Indicador titulo="A receber" valor={moeda(resumo.a_receber)} />
          <Indicador
            titulo="Em atraso"
            valor={moeda(resumo.atrasado)}
            cor={resumo.atrasado > 0 ? 'text-red-600' : 'text-ink'}
            detalhe={`${resumo.parcelas_atrasadas} parcela(s) · ${resumo.clientes_atrasados} cliente(s)`}
          />
          <Indicador titulo="Recebido no mês" valor={moeda(resumo.recebido_mes)} />
          <Indicador
            titulo="Inadimplência"
            valor={resumo.a_receber > 0 ? `${Math.round((resumo.atrasado / resumo.a_receber) * 100)}%` : '0%'}
            detalhe="do total a receber"
          />
        </div>
      )}

      <Cartao semPadding>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="campo w-auto">
            <option value="aberta">Em aberto</option>
            <option value="paga">Pagas</option>
            <option value="todas">Todas</option>
          </select>
          {status === 'aberta' && (
            <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className="campo w-auto">
              <option value="">Todos os vencimentos</option>
              <option value="atrasadas">Atrasadas</option>
              <option value="semana">Vencem em 7 dias</option>
            </select>
          )}
          {clienteId && (
            <Link to="/admin/crediario" className="self-center text-sm underline">
              Ver todos os clientes
            </Link>
          )}
        </div>
        <Tabela
          linhas={dados}
          vazio="Nenhuma parcela."
          colunas={[
            {
              titulo: 'Cliente',
              render: (p) => (
                <Link to={`/admin/clientes/${p.cliente_id}`} className="font-medium hover:underline">
                  {p.cliente_nome}
                </Link>
              ),
            },
            {
              titulo: 'Parcela',
              render: (p) => (
                <Link to={`/admin/vendas/${p.venda_id}`} className="hover:underline">
                  {p.numero}/{p.total_parcelas} · venda #{p.venda_id}
                </Link>
              ),
            },
            {
              titulo: 'Vencimento',
              render: (p) => (
                <span>
                  {data(p.vencimento)}{' '}
                  {p.status === 'aberta' && p.dias_atraso > 0 && <Etiqueta cor="red">{p.dias_atraso}d atraso</Etiqueta>}
                </span>
              ),
            },
            { titulo: 'Valor', direita: true, render: (p) => moeda(p.status === 'paga' ? p.valor_pago : p.valor) },
            {
              titulo: '',
              direita: true,
              render: (p) =>
                p.status === 'aberta' ? (
                  <div className="flex justify-end gap-2">
                    {p.cliente_telefone && (
                      <a
                        href={linkWhatsApp(
                          p.cliente_telefone,
                          `Olá, ${p.cliente_nome.split(' ')[0]}! Aqui é da Ótica MD. Passando para lembrar da parcela ${p.numero}/${p.total_parcelas} no valor de ${moeda(p.valor)}, com vencimento em ${data(p.vencimento)}. Qualquer dúvida, estamos à disposição.`,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-green-700 hover:bg-green-50"
                      >
                        <MessageCircle size={13} /> Lembrar
                      </a>
                    )}
                    {pode('crediario.receber') && (
                      <Botao tamanho="sm" onClick={() => setReceber(p)}>
                        Receber
                      </Botao>
                    )}
                  </div>
                ) : (
                  <Etiqueta cor={p.status === 'paga' ? 'green' : 'zinc'}>
                    {p.status === 'paga' ? `paga ${data(p.pago_em)}` : p.status}
                  </Etiqueta>
                ),
            },
          ]}
        />
      </Cartao>

      <Modal aberto={!!receber} onFechar={() => setReceber(null)} titulo="Receber parcela">
        {receber && (
          <Receber
            parcela={receber}
            onPago={() => {
              setReceber(null);
              avisar('Parcela recebida e lançada no caixa');
              recarregar();
              recarregarResumo();
            }}
          />
        )}
      </Modal>
    </>
  );
}
