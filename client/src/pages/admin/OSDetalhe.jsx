import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, MessageCircle, Save } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { STATUS_OS, data, dataHora, linkWhatsApp, telefone } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Etiqueta, useToast } from '../../components/admin/ui';
import { ReceitaTabela } from '../../components/admin/Receita';
import { mensagemPronta } from './OrdensServico';

export default function OSDetalhe() {
  const { id } = useParams();
  const avisar = useToast();
  const { dados: os, recarregar } = useApi(`/os/${id}`);
  const { dados: labs } = useApi('/fornecedores?tipo=laboratorio');
  const [f, setF] = useState(null);
  const [novoStatus, setNovoStatus] = useState('');
  const [obs, setObs] = useState('');

  useEffect(() => {
    if (os)
      setF({
        laboratorio_id: os.laboratorio_id ?? '',
        tipo_lente: os.tipo_lente ?? '',
        tratamentos: os.tratamentos ?? '',
        previsao_entrega: os.previsao_entrega ?? '',
        descricao: os.descricao ?? '',
        observacoes: os.observacoes ?? '',
      });
  }, [os]);

  if (!os || !f) return <p className="text-slate-500">Carregando…</p>;

  async function salvar() {
    await api.put(`/os/${id}`, f);
    avisar('OS atualizada');
    recarregar();
  }

  async function mudarStatus() {
    if (!novoStatus) return;
    await api.post(`/os/${id}/status`, { status: novoStatus, observacao: obs });
    setNovoStatus('');
    setObs('');
    avisar('Status atualizado');
    recarregar();
  }

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <Link to="/admin/os" className="nao-imprimir mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Ordens de serviço
      </Link>
      <div className="nao-imprimir">
        <Cabecalho titulo={`OS #${os.id}`} subtitulo={`${os.cliente_nome} · aberta em ${dataHora(os.criado_em)}`}>
          {os.status === 'pronta' && os.cliente_telefone && (
            <a href={linkWhatsApp(os.cliente_telefone, mensagemPronta(os))} target="_blank" rel="noreferrer">
              <Botao variante="sucesso">
                <MessageCircle size={16} /> Avisar cliente
              </Botao>
            </a>
          )}
          <Botao variante="secundario" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir para o laboratório
          </Botao>
        </Cabecalho>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="imprimir space-y-6 lg:col-span-2">
          <Cartao titulo={`Ordem de serviço #${os.id} — Ótica MD`}>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-500">Cliente:</span> <strong>{os.cliente_nome}</strong> {telefone(os.cliente_telefone)}
              </p>
              <p>
                <span className="text-slate-500">Laboratório:</span> {os.laboratorio_nome || '—'}
              </p>
              <p>
                <span className="text-slate-500">Lente:</span> {os.tipo_lente || '—'}
              </p>
              <p>
                <span className="text-slate-500">Tratamentos:</span> {os.tratamentos || '—'}
              </p>
              <p>
                <span className="text-slate-500">Previsão:</span> {data(os.previsao_entrega)}
              </p>
              <p>
                <span className="text-slate-500">Status:</span> <Etiqueta cor={STATUS_OS[os.status].cor}>{STATUS_OS[os.status].label}</Etiqueta>
              </p>
              {os.descricao && (
                <p className="sm:col-span-2">
                  <span className="text-slate-500">Itens:</span> {os.descricao}
                </p>
              )}
              {os.venda_id && (
                <p className="nao-imprimir">
                  <Link to={`/admin/vendas/${os.venda_id}`} className="underline">
                    Venda #{os.venda_id}
                  </Link>
                </p>
              )}
            </div>
          </Cartao>
          <Cartao titulo="Receita">{os.receita ? <ReceitaTabela r={os.receita} /> : <p className="text-sm text-slate-500">Nenhuma receita vinculada.</p>}</Cartao>

          <Cartao titulo="Dados da OS" className="nao-imprimir">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Laboratório">
                <select value={f.laboratorio_id} onChange={set('laboratorio_id')} className="campo">
                  <option value="">—</option>
                  {labs?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Previsão de entrega">
                <input type="date" value={f.previsao_entrega} onChange={set('previsao_entrega')} className="campo" />
              </Campo>
              <Campo label="Tipo de lente">
                <input value={f.tipo_lente} onChange={set('tipo_lente')} className="campo" />
              </Campo>
              <Campo label="Tratamentos">
                <input value={f.tratamentos} onChange={set('tratamentos')} className="campo" />
              </Campo>
              <Campo label="Descrição" className="sm:col-span-2">
                <input value={f.descricao} onChange={set('descricao')} className="campo" />
              </Campo>
              <Campo label="Observações" className="sm:col-span-2">
                <textarea rows={2} value={f.observacoes} onChange={set('observacoes')} className="campo" />
              </Campo>
            </div>
            <Botao className="mt-4" onClick={salvar}>
              <Save size={16} /> Salvar
            </Botao>
          </Cartao>
        </div>

        <div className="nao-imprimir space-y-6">
          <Cartao titulo="Mudar status">
            <div className="space-y-3">
              <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} className="campo">
                <option value="">Escolha…</option>
                {Object.entries(STATUS_OS)
                  .filter(([k]) => k !== os.status)
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
              </select>
              <input placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} className="campo" />
              <Botao className="w-full" disabled={!novoStatus} onClick={mudarStatus}>
                Atualizar
              </Botao>
            </div>
          </Cartao>
          <Cartao titulo="Histórico">
            <ol className="space-y-3 border-l border-slate-200 pl-4 text-sm">
              {os.historico.map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-ink" />
                  <p className="font-medium">{STATUS_OS[h.status]?.label || h.status}</p>
                  <p className="text-xs text-slate-500">
                    {dataHora(h.criado_em)} · {h.usuario_nome}
                  </p>
                  {h.observacao && <p className="text-xs text-slate-600">{h.observacao}</p>}
                </li>
              ))}
            </ol>
          </Cartao>
        </div>
      </div>
    </>
  );
}
