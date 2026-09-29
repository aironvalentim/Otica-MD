import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, FileText, Trash2 } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { CATEGORIAS, MOTIVOS_MOV, dataHora, moeda } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Modal, Tabela, useToast } from '../../components/admin/ui';
import ProdutoBusca from '../../components/admin/ProdutoBusca';

const MOTIVOS = {
  entrada: ['compra', 'devolucao_cliente', 'outro'],
  saida: ['perda', 'devolucao_fornecedor', 'uso_interno', 'outro'],
};

function FormMovimentacao({ tipo, fornecedores, onSalvo }) {
  const avisar = useToast();
  const [produto, setProduto] = useState(null);
  const [f, setF] = useState({ motivo: tipo === 'ajuste' ? '' : MOTIVOS[tipo][0], quantidade: 1, custo_unitario: '', fornecedor_id: '', documento: '', observacao: '', novo_estoque: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    if (!produto) return setErro('Escolha o produto');
    setErro('');
    setSalvando(true);
    try {
      const corpo =
        tipo === 'ajuste'
          ? { tipo, produto_id: produto.id, novo_estoque: f.novo_estoque, observacao: f.observacao }
          : {
              tipo,
              produto_id: produto.id,
              motivo: f.motivo,
              quantidade: f.quantidade,
              fornecedor_id: f.fornecedor_id,
              documento: f.documento,
              observacao: f.observacao,
              ...(tipo === 'entrada' ? { custo_unitario: f.custo_unitario === '' ? null : f.custo_unitario } : {}),
            };
      await api.post('/estoque/movimentacoes', corpo);
      avisar('Movimentação registrada');
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4">
      {produto ? (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span>
            <strong>{produto.nome}</strong> {produto.cor && `· ${produto.cor}`}
            <span className="block text-xs text-slate-500">
              {produto.controla_estoque ? `Estoque atual: ${produto.estoque_atual}` : 'Este produto não controla estoque'}
            </span>
          </span>
          <button type="button" onClick={() => setProduto(null)} className="text-xs underline">
            trocar
          </button>
        </div>
      ) : (
        <ProdutoBusca onSelecionar={setProduto} autoFocus />
      )}

      {tipo === 'ajuste' ? (
        <Campo label="Quantidade contada na prateleira" dica="O sistema registra a diferença como ajuste de inventário">
          <input required type="number" min="0" value={f.novo_estoque} onChange={set('novo_estoque')} className="campo" />
        </Campo>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Motivo">
            <select value={f.motivo} onChange={set('motivo')} className="campo">
              {MOTIVOS[tipo].map((m) => (
                <option key={m} value={m}>
                  {MOTIVOS_MOV[m]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Quantidade">
            <input required type="number" min="1" value={f.quantidade} onChange={set('quantidade')} className="campo" />
          </Campo>
          {tipo === 'entrada' && (
            <Campo label="Custo unitário (R$)" dica="Atualiza o custo médio">
              <input type="number" step="0.01" min="0" value={f.custo_unitario} onChange={set('custo_unitario')} className="campo" />
            </Campo>
          )}
          <Campo label="Fornecedor">
            <select value={f.fornecedor_id} onChange={set('fornecedor_id')} className="campo">
              <option value="">—</option>
              {fornecedores?.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Documento / NF" className={tipo === 'entrada' ? 'col-span-2' : ''}>
            <input value={f.documento} onChange={set('documento')} className="campo" />
          </Campo>
        </div>
      )}
      <Campo label="Observação">
        <input value={f.observacao} onChange={set('observacao')} className="campo" />
      </Campo>
      <Erro>{erro}</Erro>
      <Botao type="submit" carregando={salvando} className="w-full">
        Registrar
      </Botao>
    </form>
  );
}

function FormNota({ fornecedores, onSalvo }) {
  const avisar = useToast();
  const [itens, setItens] = useState([]);
  const [cab, setCab] = useState({ fornecedor_id: '', documento: '', observacao: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const add = (p) =>
    setItens((l) => (l.some((i) => i.produto.id === p.id) ? l : [...l, { produto: p, quantidade: 1, custo_unitario: p.preco_custo || '' }]));
  const setItem = (idx, k, v) => setItens((l) => l.map((i, n) => (n === idx ? { ...i, [k]: v } : i)));
  const total = itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.custo_unitario || 0), 0);

  async function salvar() {
    setErro('');
    setSalvando(true);
    try {
      await api.post('/estoque/entrada-lote', {
        ...cab,
        itens: itens.map((i) => ({ produto_id: i.produto.id, quantidade: i.quantidade, custo_unitario: i.custo_unitario === '' ? null : i.custo_unitario })),
      });
      avisar(`Nota lançada: ${itens.length} item(ns)`);
      onSalvo();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Fornecedor">
          <select value={cab.fornecedor_id} onChange={(e) => setCab({ ...cab, fornecedor_id: e.target.value })} className="campo">
            <option value="">—</option>
            {fornecedores?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Nº da nota">
          <input value={cab.documento} onChange={(e) => setCab({ ...cab, documento: e.target.value })} className="campo" />
        </Campo>
      </div>
      <ProdutoBusca onSelecionar={add} placeholder="Adicionar produto da nota…" />
      {itens.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="py-1 text-left font-medium">Produto</th>
              <th className="w-20 py-1 font-medium">Qtd.</th>
              <th className="w-28 py-1 font-medium">Custo un.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {itens.map((i, idx) => (
              <tr key={i.produto.id} className="border-t border-slate-100">
                <td className="py-1.5">
                  {i.produto.nome} <span className="text-xs text-slate-500">{i.produto.cor}</span>
                </td>
                <td className="px-1">
                  <input type="number" min="1" value={i.quantidade} onChange={(e) => setItem(idx, 'quantidade', e.target.value)} className="campo py-1" />
                </td>
                <td className="px-1">
                  <input type="number" step="0.01" min="0" value={i.custo_unitario} onChange={(e) => setItem(idx, 'custo_unitario', e.target.value)} className="campo py-1" />
                </td>
                <td>
                  <button onClick={() => setItens(itens.filter((_, n) => n !== idx))} className="p-1 text-slate-400 hover:text-red-600" aria-label="Remover">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-right text-sm">
        Total da nota: <strong>{moeda(total)}</strong>
      </p>
      <Erro>{erro}</Erro>
      <Botao onClick={salvar} disabled={!itens.length} carregando={salvando} className="w-full">
        Lançar entrada
      </Botao>
    </div>
  );
}

export default function Estoque() {
  const [modal, setModal] = useState(null);
  const [filtro, setFiltro] = useState({ tipo: '', de: '', ate: '' });
  const { dados: movs, recarregar } = useApi(`/estoque/movimentacoes${qs(filtro)}`);
  const { dados: resumo, recarregar: recarregarResumo } = useApi('/estoque/resumo');
  const { dados: fornecedores } = useApi('/fornecedores?tipo=fornecedor');

  const fechar = () => setModal(null);
  const salvo = () => {
    setModal(null);
    recarregar();
    recarregarResumo();
  };

  const totCusto = resumo?.reduce((s, r) => s + r.valor_custo, 0) || 0;
  const totVenda = resumo?.reduce((s, r) => s + r.valor_venda, 0) || 0;

  return (
    <>
      <Cabecalho titulo="Entradas e saídas" subtitulo="Todo movimento de estoque fica registrado aqui">
        <Botao variante="secundario" onClick={() => setModal('nota')}>
          <FileText size={16} /> Entrada de nota
        </Botao>
        <Botao variante="secundario" onClick={() => setModal('ajuste')}>
          <ClipboardList size={16} /> Inventário
        </Botao>
        <Botao variante="secundario" onClick={() => setModal('saida')}>
          <ArrowUpFromLine size={16} /> Saída
        </Botao>
        <Botao onClick={() => setModal('entrada')}>
          <ArrowDownToLine size={16} /> Entrada
        </Botao>
      </Cabecalho>

      {resumo && (
        <Cartao titulo="Valor em estoque" className="mb-6" semPadding>
          <Tabela
            chave="categoria"
            linhas={resumo}
            colunas={[
              { titulo: 'Categoria', render: (r) => CATEGORIAS[r.categoria] },
              { titulo: 'Produtos', direita: true, campo: 'produtos' },
              { titulo: 'Unidades', direita: true, campo: 'unidades' },
              { titulo: 'A preço de custo', direita: true, render: (r) => moeda(r.valor_custo) },
              { titulo: 'A preço de venda', direita: true, render: (r) => moeda(r.valor_venda) },
            ]}
          />
          <div className="flex justify-end gap-8 border-t border-slate-100 px-4 py-3 text-sm">
            <span>
              Custo total: <strong>{moeda(totCusto)}</strong>
            </span>
            <span>
              Venda total: <strong>{moeda(totVenda)}</strong>
            </span>
          </div>
        </Cartao>
      )}

      <Cartao semPadding>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <select value={filtro.tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value })} className="campo w-auto">
            <option value="">Entradas e saídas</option>
            <option value="entrada">Só entradas</option>
            <option value="saida">Só saídas</option>
            <option value="ajuste">Só ajustes</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            de <input type="date" value={filtro.de} onChange={(e) => setFiltro({ ...filtro, de: e.target.value })} className="campo w-auto" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            até <input type="date" value={filtro.ate} onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })} className="campo w-auto" />
          </label>
        </div>
        <Tabela
          linhas={movs}
          vazio="Nenhuma movimentação no período."
          colunas={[
            { titulo: 'Data', render: (m) => <span className="whitespace-nowrap">{dataHora(m.criado_em)}</span> },
            {
              titulo: 'Produto',
              render: (m) => (
                <>
                  {m.produto_nome} <span className="text-xs text-slate-500">{m.sku}</span>
                </>
              ),
            },
            {
              titulo: 'Tipo',
              render: (m) =>
                m.tipo === 'entrada' ? (
                  <span className="text-green-700">↑ Entrada</span>
                ) : m.tipo === 'saida' ? (
                  <span className="text-red-700">↓ Saída</span>
                ) : (
                  <span className="text-blue-700">⇄ Ajuste</span>
                ),
            },
            { titulo: 'Motivo', render: (m) => MOTIVOS_MOV[m.motivo] },
            { titulo: 'Qtd.', direita: true, campo: 'quantidade' },
            { titulo: 'Saldo', direita: true, render: (m) => `${m.estoque_anterior} → ${m.estoque_posterior}` },
            { titulo: 'Por', render: (m) => <span className="text-xs text-slate-500">{m.usuario_nome || '—'}</span> },
            { titulo: 'Obs.', render: (m) => <span className="text-xs text-slate-500">{[m.fornecedor_nome, m.documento, m.observacao].filter(Boolean).join(' · ')}</span> },
          ]}
        />
      </Cartao>

      <Modal aberto={['entrada', 'saida', 'ajuste'].includes(modal)} onFechar={fechar} titulo={{ entrada: 'Entrada de estoque', saida: 'Saída de estoque', ajuste: 'Ajuste de inventário' }[modal]}>
        {modal && modal !== 'nota' && <FormMovimentacao key={modal} tipo={modal} fornecedores={fornecedores} onSalvo={salvo} />}
      </Modal>
      <Modal aberto={modal === 'nota'} onFechar={fechar} titulo="Entrada de nota de compra" largura="max-w-2xl">
        <FormNota fornecedores={fornecedores} onSalvo={salvo} />
      </Modal>
    </>
  );
}
