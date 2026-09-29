import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, Ban, CheckCircle2, ShoppingCart, Wrench } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi, useLojaConfig } from '../../lib/hooks';
import { FORMAS_PAGAMENTO, cpf, data, dataHora, moeda, telefone } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Etiqueta, Modal, useToast } from '../../components/admin/ui';

export default function VendaDetalhe() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const avisar = useToast();
  const cfg = useLojaConfig();
  const { dados: v, recarregar } = useApi(`/vendas/${id}`);
  const [cancelar, setCancelar] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  if (!v) return <p className="text-slate-500">Carregando…</p>;

  async function confirmarCancelamento() {
    setErro('');
    setSalvando(true);
    try {
      await api.post(`/vendas/${id}/cancelar`, { motivo });
      avisar('Venda cancelada. Estoque devolvido e valores estornados no caixa.');
      setCancelar(false);
      recarregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <Link to="/admin/vendas" className="nao-imprimir mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Vendas
      </Link>
      {params.get('nova') && (
        <div className="nao-imprimir mb-4 flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
          <CheckCircle2 size={18} /> Venda registrada com sucesso.
          <Link to="/admin/pdv" className="ml-auto font-medium underline">
            <ShoppingCart size={14} className="mr-1 inline" />
            Nova venda
          </Link>
        </div>
      )}
      <div className="nao-imprimir">
        <Cabecalho titulo={`Venda #${v.id}`} subtitulo={dataHora(v.criado_em)}>
          {v.status === 'concluida' && (
            <Botao variante="secundario" onClick={() => setCancelar(true)}>
              <Ban size={16} /> Cancelar venda
            </Botao>
          )}
          <Botao onClick={() => window.print()}>
            <Printer size={16} /> Imprimir comprovante
          </Botao>
        </Cabecalho>
      </div>

      {v.status === 'cancelada' && (
        <div className="nao-imprimir mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">Venda cancelada em {dataHora(v.cancelada_em)}.</div>
      )}

      <Cartao className="imprimir mx-auto max-w-2xl">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold">Ótica MD</p>
          <p className="text-xs text-slate-500">{cfg.loja_endereco}</p>
          <p className="text-xs text-slate-500">WhatsApp {telefone(cfg.loja_whatsapp)}</p>
          <p className="mt-3 text-sm font-semibold">
            Comprovante de venda #{v.id} {v.status === 'cancelada' && <Etiqueta cor="red">CANCELADA</Etiqueta>}
          </p>
          <p className="text-xs text-slate-500">{dataHora(v.criado_em)} · Atendido por {v.vendedor_nome}</p>
          <p className="mt-1 text-[11px] text-slate-400">Documento sem valor fiscal</p>
        </div>

        {v.cliente_nome && (
          <p className="mt-4 border-t border-dashed border-slate-200 pt-3 text-sm">
            Cliente: <strong>{v.cliente_nome}</strong>
            {v.cliente_cpf && ` · CPF ${cpf(v.cliente_cpf)}`}
            {v.cliente_telefone && ` · ${telefone(v.cliente_telefone)}`}
          </p>
        )}

        <table className="mt-4 w-full border-t border-dashed border-slate-200 text-sm">
          <tbody>
            {v.itens.map((i) => (
              <tr key={i.id}>
                <td className="py-1.5">
                  {i.quantidade}× {i.descricao}
                </td>
                <td className="py-1.5 text-right tabular-nums">{moeda(i.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="mt-2 space-y-1 border-t border-dashed border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{moeda(v.subtotal)}</dd>
          </div>
          {v.desconto > 0 && (
            <div className="flex justify-between">
              <dt>Desconto</dt>
              <dd className="tabular-nums">− {moeda(v.desconto)}</dd>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums">{moeda(v.total)}</dd>
          </div>
          {v.pagamentos.map((p) => (
            <div key={p.id} className="flex justify-between text-slate-600">
              <dt>
                {FORMAS_PAGAMENTO[p.forma]}
                {p.parcelas > 1 && ` (${p.parcelas}x)`}
              </dt>
              <dd className="tabular-nums">{moeda(p.valor)}</dd>
            </div>
          ))}
        </dl>

        {v.parcelas.length > 0 && (
          <div className="mt-4 border-t border-dashed border-slate-200 pt-3">
            <p className="mb-2 text-sm font-semibold">Carnê do crediário</p>
            <table className="w-full text-sm">
              <tbody>
                {v.parcelas.map((p) => (
                  <tr key={p.id}>
                    <td className="py-1">
                      Parcela {p.numero}/{p.total_parcelas}
                    </td>
                    <td className="py-1">vence {data(p.vencimento)}</td>
                    <td className="py-1 text-right tabular-nums">{moeda(p.valor)}</td>
                    <td className="py-1 text-right text-xs">{p.status === 'paga' ? 'PAGA' : p.status === 'cancelada' ? 'CANCELADA' : '______'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {v.ordens_servico.length > 0 && (
          <p className="nao-imprimir mt-4 text-sm">
            <Link to={`/admin/os/${v.ordens_servico[0].id}`} className="inline-flex items-center gap-1 underline">
              <Wrench size={14} /> Ordem de serviço #{v.ordens_servico[0].id}
            </Link>
          </p>
        )}
        {v.observacoes && <p className="mt-4 text-xs text-slate-500">Obs.: {v.observacoes}</p>}
        <p className="mt-6 text-center text-xs text-slate-500">Obrigado pela preferência! Ajustes e limpeza grátis sempre que precisar.</p>
      </Cartao>

      <Modal aberto={cancelar} onFechar={() => setCancelar(false)} titulo={`Cancelar venda #${v.id}`}>
        <p className="text-sm text-slate-600">
          Os produtos voltam ao estoque, os pagamentos são estornados no caixa aberto e as parcelas do crediário são canceladas.
        </p>
        <Campo label="Motivo" className="mt-4">
          <input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} className="campo" />
        </Campo>
        <div className="mt-3">
          <Erro>{erro}</Erro>
        </div>
        <Botao variante="perigo" className="mt-3 w-full" disabled={motivo.trim().length < 3} carregando={salvando} onClick={confirmarCancelamento}>
          Confirmar cancelamento
        </Botao>
      </Modal>
    </>
  );
}
