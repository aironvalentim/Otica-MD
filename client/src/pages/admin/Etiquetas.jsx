import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, Printer, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { moeda, precoFinal } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao } from '../../components/admin/ui';
import ProdutoBusca from '../../components/admin/ProdutoBusca';

// Formatos de impressão (medidas em mm)
const FORMATOS = {
  a4: {
    nome: 'Folha A4 · 3 × 10 etiquetas de 63,5 × 25,4 mm',
    pagina: 'A4',
    folha: { largura: 210, altura: 297, margemTopo: 21.5, margemEsq: 7.2, colunas: 3, linhas: 10, etqL: 63.5, etqA: 25.4, espacoH: 2.5, espacoV: 0 },
  },
  termica: {
    nome: 'Etiqueta térmica 40 × 25 mm (rolo)',
    pagina: '40mm 25mm',
    folha: { largura: 40, altura: 25, margemTopo: 0, margemEsq: 0, colunas: 1, linhas: 1, etqL: 40, etqA: 25, espacoH: 0, espacoV: 0 },
  },
};

function CodigoBarras({ valor }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current || !valor) return;
    try {
      JsBarcode(ref.current, valor, { format: 'CODE128', displayValue: true, fontSize: 14, height: 40, margin: 0, textMargin: 1, width: 1.6 });
      // Faz o código ocupar a largura disponível sem distorcer a leitura
      const w = ref.current.getAttribute('width');
      const h = ref.current.getAttribute('height');
      ref.current.setAttribute('viewBox', `0 0 ${parseFloat(w)} ${parseFloat(h)}`);
      ref.current.setAttribute('width', '100%');
      ref.current.setAttribute('height', '100%');
      ref.current.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    } catch {
      /* código inválido para CODE128 */
    }
  }, [valor]);
  return <svg ref={ref} />;
}

function Etiqueta({ p, f, mostrarPreco }) {
  return (
    <div
      style={{ width: `${f.etqL}mm`, height: `${f.etqA}mm`, padding: '1.2mm 2mm', boxSizing: 'border-box' }}
      className="flex flex-col overflow-hidden bg-white text-black"
    >
      <div className="flex items-baseline justify-between gap-1" style={{ fontSize: '2.4mm', lineHeight: 1.15 }}>
        <span className="truncate font-semibold">{[p.nome, p.cor].filter(Boolean).join(' · ')}</span>
        {mostrarPreco && <span className="shrink-0 font-bold">{moeda(precoFinal(p))}</span>}
      </div>
      <div className="min-h-0 flex-1 pt-[0.6mm]">
        <CodigoBarras valor={p.sku} />
      </div>
    </div>
  );
}

export default function Etiquetas() {
  const [params] = useSearchParams();
  const [itens, setItens] = useState([]); // { produto, qtd }
  const [formato, setFormato] = useState('a4');
  const [inicio, setInicio] = useState(1);
  const [mostrarPreco, setMostrarPreco] = useState(true);

  useEffect(() => {
    const ids = params.get('ids');
    if (!ids) return;
    api.get(`/produtos?ids=${ids}&ativo=todos`).then((ps) =>
      setItens(ps.map((p) => ({ produto: p, qtd: p.controla_estoque ? Math.max(p.estoque_atual, 1) : 1 })))
    );
  }, [params]);

  const add = (p) =>
    setItens((l) => (l.some((i) => i.produto.id === p.id) ? l : [...l, { produto: p, qtd: p.controla_estoque ? Math.max(p.estoque_atual, 1) : 1 }]));

  const F = FORMATOS[formato];
  const f = F.folha;
  const porFolha = f.colunas * f.linhas;

  // Lista final de etiquetas (com posições vazias no começo, para folhas já usadas)
  const etiquetas = useMemo(() => {
    const lista = [];
    if (formato === 'a4') for (let i = 1; i < inicio; i++) lista.push(null);
    for (const { produto, qtd } of itens) for (let i = 0; i < qtd; i++) lista.push(produto);
    return lista;
  }, [itens, inicio, formato]);

  const paginas = [];
  for (let i = 0; i < etiquetas.length; i += porFolha) paginas.push(etiquetas.slice(i, i + porFolha));
  const total = etiquetas.filter(Boolean).length;

  return (
    <>
      <style>{`@media print { @page { size: ${F.pagina}; margin: 0; } .imprimir { padding: 0 !important; } .pagina-etiquetas { break-after: page; } .pagina-etiquetas:last-child { break-after: auto; } }`}</style>

      <div className="nao-imprimir">
        <Link to="/admin/produtos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
          <ArrowLeft size={16} /> Produtos
        </Link>
        <Cabecalho titulo="Etiquetas com código de barras" subtitulo="Para identificar as peças e vender bipando no caixa">
          <Botao onClick={() => window.print()} disabled={!total}>
            <Printer size={16} /> Imprimir {total} etiqueta(s)
          </Botao>
        </Cabecalho>

        <div className="grid gap-6 lg:grid-cols-3">
          <Cartao titulo="Produtos" className="lg:col-span-2">
            <ProdutoBusca onSelecionar={add} placeholder="Adicionar produto…" />
            {itens.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                Busque os produtos acima ou selecione vários na lista de <Link to="/admin/produtos" className="underline">Produtos</Link>.
              </p>
            ) : (
              <table className="mt-4 w-full text-sm">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Produto</th>
                    <th className="py-1 text-left font-medium">Código</th>
                    <th className="w-24 py-1 font-medium">Etiquetas</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {itens.map(({ produto: p, qtd }) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="py-1.5">
                        {p.nome} <span className="text-slate-500">{p.cor}</span>
                        {p.controla_estoque && <span className="block text-xs text-slate-400">{p.estoque_atual} em estoque</span>}
                      </td>
                      <td className="py-1.5 font-mono text-xs">{p.sku}</td>
                      <td className="px-1">
                        <input
                          type="number"
                          min="0"
                          max="500"
                          value={qtd}
                          onChange={(e) => setItens(itens.map((i) => (i.produto.id === p.id ? { ...i, qtd: Math.max(0, Math.min(500, Number(e.target.value) || 0)) } : i)))}
                          className="campo py-1 text-center"
                        />
                      </td>
                      <td>
                        <button onClick={() => setItens(itens.filter((i) => i.produto.id !== p.id))} className="p-1 text-slate-400 hover:text-red-600" aria-label="Remover">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Cartao>

          <Cartao titulo="Impressão">
            <div className="space-y-4">
              <Campo label="Formato">
                <select value={formato} onChange={(e) => setFormato(e.target.value)} className="campo">
                  {Object.entries(FORMATOS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              {formato === 'a4' && (
                <Campo label="Começar na etiqueta nº" dica="Para aproveitar uma folha já usada (1 a 30, da esquerda para a direita)">
                  <input type="number" min="1" max={porFolha} value={inicio} onChange={(e) => setInicio(Math.max(1, Math.min(porFolha, Number(e.target.value) || 1)))} className="campo" />
                </Campo>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={mostrarPreco} onChange={(e) => setMostrarPreco(e.target.checked)} /> Mostrar preço
              </label>
              <p className="text-xs text-slate-500">
                Na janela de impressão, use escala <strong>100%</strong> (sem "ajustar à página") e margens <strong>nenhuma</strong>. Teste primeiro numa
                folha comum, sobrepondo à folha de etiquetas contra a luz.
              </p>
            </div>
          </Cartao>
        </div>

        {total > 0 && <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-600">Pré-visualização ({paginas.length} página(s))</h2>}
      </div>

      {/* Área impressa */}
      <div className="imprimir space-y-6 print:space-y-0">
        {paginas.map((pag, n) => (
          <div
            key={n}
            className="pagina-etiquetas mx-auto bg-white shadow print:shadow-none"
            style={{ width: `${f.largura}mm`, height: `${f.altura}mm`, paddingTop: `${f.margemTopo}mm`, paddingLeft: `${f.margemEsq}mm`, boxSizing: 'border-box' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${f.colunas}, ${f.etqL}mm)`,
                gridAutoRows: `${f.etqA}mm`,
                columnGap: `${f.espacoH}mm`,
                rowGap: `${f.espacoV}mm`,
              }}
            >
              {pag.map((p, i) => (p ? <Etiqueta key={i} p={p} f={f} mostrarPreco={mostrarPreco} /> : <div key={i} />))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
