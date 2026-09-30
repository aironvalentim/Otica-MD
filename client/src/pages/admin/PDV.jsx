import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Minus, Plus, Trash2, UserPlus, X, Wallet, Search, FilePlus2 } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi, useDebounce } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { FORMAS_PAGAMENTO, data, moeda, precoFinal, telefone } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Modal, useToast } from '../../components/admin/ui';
import ProdutoBusca from '../../components/admin/ProdutoBusca';
import ClienteForm from '../../components/admin/ClienteForm';
import { ReceitaForm, ReceitaTabela } from '../../components/admin/Receita';

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function ClienteBusca({ onSelecionar, onNovo }) {
  const [t, setT] = useState('');
  const b = useDebounce(t, 200);
  const [itens, setItens] = useState([]);
  useEffect(() => {
    if (!b.trim()) return setItens([]);
    api
      .get(`/clientes${qs({ busca: b })}`)
      .then((r) => setItens(r.slice(0, 6)))
      .catch(() => {});
  }, [b]);
  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Nome, CPF ou telefone" className="campo pl-9" />
        </div>
        <Botao type="button" variante="secundario" onClick={onNovo} title="Cadastrar cliente">
          <UserPlus size={16} />
        </Botao>
      </div>
      {itens.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {itens.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onSelecionar(c);
                  setT('');
                  setItens([]);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium">{c.nome}</span>
                <span className="block text-xs text-slate-500">{telefone(c.telefone)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PDV() {
  const navigate = useNavigate();
  const avisar = useToast();
  const [params] = useSearchParams();
  const { dados: caixa, carregando: carregandoCaixa } = useApi('/caixa/atual');
  const { dados: laboratorios } = useApi('/fornecedores?tipo=laboratorio');

  const [itens, setItens] = useState([]);
  const [cliente, setCliente] = useState(null);
  const [receitas, setReceitas] = useState([]);
  const [receitaId, setReceitaId] = useState('');
  const [desconto, setDesconto] = useState('');
  const [descontoPct, setDescontoPct] = useState(false);
  const [pagamentos, setPagamentos] = useState([]);
  const [gerarOS, setGerarOS] = useState(false);
  const [os, setOS] = useState({ laboratorio_id: '', tipo_lente: '', tratamentos: '', previsao_entrega: '' });
  const [obs, setObs] = useState('');
  const [modal, setModal] = useState(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Cliente vindo da ficha (?cliente=ID)
  useEffect(() => {
    const id = params.get('cliente');
    if (id)
      api
        .get(`/clientes/${id}`)
        .then(escolherCliente)
        .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escolherCliente(c) {
    setCliente(c);
    api.get(`/receitas?cliente_id=${c.id}`).then((r) => {
      setReceitas(r);
      setReceitaId(r[0]?.id || '');
    });
  }

  const addProduto = (p) => {
    setItens((l) => {
      const idx = l.findIndex((i) => i.produto_id === p.id);
      if (idx >= 0) return l.map((i, n) => (n === idx ? { ...i, quantidade: i.quantidade + 1 } : i));
      return [
        ...l,
        {
          chave: `p${p.id}`,
          produto_id: p.id,
          descricao: [p.nome, p.cor].filter(Boolean).join(' - '),
          quantidade: 1,
          preco_unitario: precoFinal(p),
          produto: p,
        },
      ];
    });
    if (p.categoria === 'lente') setGerarOS(true);
  };
  const addAvulso = () =>
    setItens((l) => [...l, { chave: `a${Date.now()}`, produto_id: null, descricao: '', quantidade: 1, preco_unitario: 0 }]);
  const setItem = (chave, k, v) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, [k]: v } : i)));
  const removerItem = (chave) => setItens((l) => l.filter((i) => i.chave !== chave));

  const subtotal = r2(itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.preco_unitario || 0), 0));
  const valorDesconto = r2(descontoPct ? (subtotal * Number(desconto || 0)) / 100 : Number(desconto || 0));
  const total = r2(Math.max(subtotal - valorDesconto, 0));
  const pago = r2(pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0));
  const restante = r2(total - pago);

  // Limite de desconto do perfil: conta o desconto geral e o preço reduzido item a item
  const { usuario } = useAuth();
  const limiteDesconto = Number(usuario?.desconto_max_pct ?? 0);
  const valorTabela = itens.reduce(
    (s, i) => s + Number(i.quantidade || 0) * (i.produto ? Number(precoFinal(i.produto)) : Number(i.preco_unitario || 0)),
    0,
  );
  const descontoItens = itens.reduce(
    (s, i) => s + (i.produto ? Math.max(0, Number(precoFinal(i.produto)) - Number(i.preco_unitario || 0)) * Number(i.quantidade || 0) : 0),
    0,
  );
  const pctDesconto = valorTabela > 0 ? ((valorDesconto + descontoItens) / valorTabela) * 100 : 0;
  const acimaDoLimite = pctDesconto > limiteDesconto + 0.001;

  const addPagamento = (forma) =>
    setPagamentos((l) => [
      ...l,
      { chave: Date.now(), forma, valor: restante > 0 ? restante : '', parcelas: forma === 'crediario' ? 3 : 1, primeiro_vencimento: '' },
    ]);
  const setPag = (chave, k, v) => setPagamentos((l) => l.map((p) => (p.chave === chave ? { ...p, [k]: v } : p)));

  const receitaSel = useMemo(() => receitas.find((r) => String(r.id) === String(receitaId)), [receitas, receitaId]);
  const pronto = itens.length > 0 && Math.abs(restante) < 0.01 && total >= 0 && pagamentos.length > 0 && !acimaDoLimite;

  async function finalizar() {
    setErro('');
    setSalvando(true);
    try {
      const v = await api.post('/vendas', {
        cliente_id: cliente?.id || null,
        receita_id: receitaId || null,
        desconto: valorDesconto,
        observacoes: obs,
        itens: itens.map(({ produto_id, descricao, quantidade, preco_unitario }) => ({
          produto_id,
          descricao,
          quantidade,
          preco_unitario,
        })),
        pagamentos: pagamentos.map(({ forma, valor, parcelas, primeiro_vencimento }) => ({ forma, valor, parcelas, primeiro_vencimento })),
        ordem_servico: gerarOS ? os : null,
      });
      avisar(`Venda #${v.id} registrada`);
      navigate(`/admin/vendas/${v.id}?nova=1`);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (carregandoCaixa) return <p className="text-slate-500">Carregando…</p>;
  if (!caixa)
    return (
      <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
        <Wallet className="mx-auto text-slate-400" size={36} />
        <h1 className="mt-3 text-lg font-semibold">O caixa está fechado</h1>
        <p className="mt-1 text-sm text-slate-500">Abra o caixa com o valor do troco para começar a vender.</p>
        <Link to="/admin/caixa">
          <Botao className="mt-5">Abrir caixa</Botao>
        </Link>
      </div>
    );

  return (
    <>
      <Cabecalho titulo="Nova venda" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* ITENS */}
        <div className="space-y-6">
          <Cartao titulo="Itens">
            <div className="flex gap-2">
              <div className="flex-1">
                <ProdutoBusca onSelecionar={addProduto} autoFocus />
              </div>
              <Botao variante="secundario" onClick={addAvulso}>
                <Plus size={16} /> Item avulso
              </Botao>
            </div>
            {itens.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Busque uma armação, lente ou serviço para começar.</p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Descrição</th>
                    <th className="w-28 py-1 font-medium">Qtd.</th>
                    <th className="w-28 py-1 font-medium">Preço un.</th>
                    <th className="w-24 py-1 text-right font-medium">Total</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => {
                    const semEstoque = i.produto?.controla_estoque && i.quantidade > i.produto.estoque_atual;
                    return (
                      <tr key={i.chave} className="border-t border-slate-100 align-top">
                        <td className="py-2 pr-2">
                          {i.produto_id ? (
                            <>
                              {i.descricao}
                              {semEstoque && <span className="block text-xs text-red-600">Só {i.produto.estoque_atual} em estoque</span>}
                            </>
                          ) : (
                            <input
                              autoFocus
                              placeholder="Ex.: Montagem, conserto…"
                              value={i.descricao}
                              onChange={(e) => setItem(i.chave, 'descricao', e.target.value)}
                              className="campo py-1"
                            />
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setItem(i.chave, 'quantidade', Math.max(1, i.quantidade - 1))}
                              className="rounded p-1 hover:bg-slate-100"
                              aria-label="Menos"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="w-6 text-center tabular-nums">{i.quantidade}</span>
                            <button
                              onClick={() => setItem(i.chave, 'quantidade', i.quantidade + 1)}
                              className="rounded p-1 hover:bg-slate-100"
                              aria-label="Mais"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={i.preco_unitario}
                            onChange={(e) => setItem(i.chave, 'preco_unitario', e.target.value)}
                            className="campo py-1 text-right"
                          />
                        </td>
                        <td className="py-2 text-right tabular-nums">{moeda(i.quantidade * i.preco_unitario)}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => removerItem(i.chave)}
                            className="p-1 text-slate-400 hover:text-red-600"
                            aria-label="Remover"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao titulo="Cliente e receita">
            {cliente ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-sm">
                    <strong>{cliente.nome}</strong>
                    <span className="block text-xs text-slate-500">{telefone(cliente.telefone)}</span>
                  </div>
                  <button
                    onClick={() => {
                      setCliente(null);
                      setReceitas([]);
                      setReceitaId('');
                    }}
                    className="text-slate-400 hover:text-ink"
                    aria-label="Remover cliente"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <Campo label="Receita" className="flex-1">
                    <select value={receitaId} onChange={(e) => setReceitaId(e.target.value)} className="campo">
                      <option value="">Sem receita</option>
                      {receitas.map((r) => (
                        <option key={r.id} value={r.id}>
                          {data(r.data_receita)} {r.medico ? `· ${r.medico}` : ''}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Botao variante="secundario" onClick={() => setModal('receita')}>
                    <FilePlus2 size={16} /> Nova
                  </Botao>
                </div>
                {receitaSel && <ReceitaTabela r={receitaSel} />}
              </div>
            ) : (
              <>
                <ClienteBusca onSelecionar={escolherCliente} onNovo={() => setModal('cliente')} />
                <p className="mt-2 text-xs text-slate-500">Opcional em vendas simples. Obrigatório para crediário e ordem de serviço.</p>
              </>
            )}
          </Cartao>

          <Cartao
            titulo="Ordem de serviço (laboratório)"
            acoes={
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={gerarOS} onChange={(e) => setGerarOS(e.target.checked)} /> Gerar OS
              </label>
            }
          >
            {gerarOS ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Laboratório">
                  <select value={os.laboratorio_id} onChange={(e) => setOS({ ...os, laboratorio_id: e.target.value })} className="campo">
                    <option value="">—</option>
                    {laboratorios?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nome}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Previsão de entrega">
                  <input
                    type="date"
                    value={os.previsao_entrega}
                    onChange={(e) => setOS({ ...os, previsao_entrega: e.target.value })}
                    className="campo"
                  />
                </Campo>
                <Campo label="Tipo de lente">
                  <select value={os.tipo_lente} onChange={(e) => setOS({ ...os, tipo_lente: e.target.value })} className="campo">
                    <option value="">—</option>
                    {['Visão simples', 'Multifocal', 'Bifocal', 'Ocupacional'].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Tratamentos">
                  <input
                    placeholder="Antirreflexo, filtro azul…"
                    value={os.tratamentos}
                    onChange={(e) => setOS({ ...os, tratamentos: e.target.value })}
                    className="campo"
                  />
                </Campo>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Marque quando a venda tiver montagem de lentes.</p>
            )}
          </Cartao>
        </div>

        {/* PAGAMENTO */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Cartao titulo="Pagamento">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="tabular-nums">{moeda(subtotal)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-500">Desconto</dt>
                <dd className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    className="campo w-24 py-1 text-right"
                  />
                  <button onClick={() => setDescontoPct(!descontoPct)} className="w-9 rounded border border-slate-300 py-1 text-xs">
                    {descontoPct ? '%' : 'R$'}
                  </button>
                </dd>
              </div>
              {limiteDesconto < 100 && (
                <p className={`text-right text-xs ${acimaDoLimite ? 'font-medium text-red-600' : 'text-slate-500'}`}>
                  {pctDesconto > 0.05 ? `Desconto de ${pctDesconto.toFixed(1).replace('.', ',')}% · ` : ''}
                  seu limite é {String(limiteDesconto).replace('.', ',')}%
                  {acimaDoLimite && <span className="block">Peça a um gerente para finalizar esta venda.</span>}
                </p>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{moeda(total)}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-3">
              {pagamentos.map((p) => (
                <div key={p.chave} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{FORMAS_PAGAMENTO[p.forma]}</span>
                    <button
                      onClick={() => setPagamentos(pagamentos.filter((x) => x.chave !== p.chave))}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Remover"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.valor}
                      onChange={(e) => setPag(p.chave, 'valor', e.target.value)}
                      className="campo py-1 text-right"
                      aria-label="Valor"
                    />
                    {(p.forma === 'credito' || p.forma === 'crediario') && (
                      <select
                        value={p.parcelas}
                        onChange={(e) => setPag(p.chave, 'parcelas', Number(e.target.value))}
                        className="campo py-1"
                        aria-label="Parcelas"
                      >
                        {Array.from({ length: p.forma === 'credito' ? 12 : 10 }, (_, n) => n + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}x de {moeda(Number(p.valor || 0) / n)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {p.forma === 'crediario' && (
                    <label className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                      1º vencimento
                      <input
                        type="date"
                        value={p.primeiro_vencimento}
                        onChange={(e) => setPag(p.chave, 'primeiro_vencimento', e.target.value)}
                        className="campo w-auto py-1"
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {Object.entries(FORMAS_PAGAMENTO).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => addPagamento(k)}
                  disabled={k === 'crediario' && !cliente}
                  title={k === 'crediario' && !cliente ? 'Selecione o cliente' : ''}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-medium hover:border-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  + {l}
                </button>
              ))}
            </div>

            <p className={`mt-4 text-center text-sm ${Math.abs(restante) < 0.01 ? 'text-green-700' : 'text-amber-700'}`}>
              {Math.abs(restante) < 0.01
                ? 'Pagamento completo'
                : restante > 0
                  ? `Falta ${moeda(restante)}`
                  : `Pagamento excede em ${moeda(-restante)}`}
            </p>

            <Campo label="Observação" className="mt-4">
              <input value={obs} onChange={(e) => setObs(e.target.value)} className="campo" />
            </Campo>

            <div className="mt-4">
              <Erro>{erro}</Erro>
            </div>
            <Botao tamanho="lg" variante="sucesso" className="mt-3 w-full" disabled={!pronto} carregando={salvando} onClick={finalizar}>
              Finalizar venda
            </Botao>
          </Cartao>
        </div>
      </div>

      <Modal aberto={modal === 'cliente'} onFechar={() => setModal(null)} titulo="Novo cliente" largura="max-w-2xl">
        <ClienteForm
          onSalvo={(c) => {
            setModal(null);
            escolherCliente(c);
          }}
        />
      </Modal>
      <Modal aberto={modal === 'receita'} onFechar={() => setModal(null)} titulo="Nova receita" largura="max-w-3xl">
        {cliente && (
          <ReceitaForm
            clienteId={cliente.id}
            onSalvo={(r) => {
              setModal(null);
              setReceitas((l) => [r, ...l]);
              setReceitaId(r.id);
            }}
          />
        )}
      </Modal>
    </>
  );
}
