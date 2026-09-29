import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, Check, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { CATEGORIAS, moeda } from '../../lib/format';
import { ARREDONDAMENTOS } from '../../lib/precos';
import { Botao, Cabecalho, Campo, Cartao, Erro, Tabela, useToast } from '../../components/admin/ui';

const ACOES = {
  aumentar_pct: { label: 'Aumentar o preço em %', pede: 'pct' },
  reduzir_pct: { label: 'Reduzir o preço em %', pede: 'pct' },
  promocao_pct: { label: 'Colocar em promoção (% de desconto)', pede: 'pct' },
  remover_promocao: { label: 'Encerrar promoção', pede: null },
  aplicar_markup: { label: 'Recalcular pelo custo × markup', pede: 'markup' },
};

export default function Precos() {
  const avisar = useToast();
  const [params] = useSearchParams();
  const ids = params.get('ids') ? params.get('ids').split(',').map(Number) : null;
  const { dados: marcas } = useApi('/produtos/marcas');
  const { dados: fornecedores } = useApi('/fornecedores?tipo=fornecedor');
  const { dados: config } = useApi('/configuracoes');

  const [filtro, setFiltro] = useState({ categoria: '', marca: '', fornecedor_id: '', somente_publicados: false });
  const [acao, setAcao] = useState('aumentar_pct');
  const [valor, setValor] = useState('');
  const [arred, setArred] = useState('');
  const [previa, setPrevia] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (config && !arred) setArred(config.preco_arredondamento || 'x90');
  }, [config, arred]);
  // Mudou qualquer parâmetro: a prévia antiga deixa de valer
  useEffect(() => setPrevia(null), [filtro, acao, valor, arred]);

  const corpo = (simular) => ({
    filtro: ids ? { ids } : { ...filtro, fornecedor_id: filtro.fornecedor_id || null },
    acao,
    valor: valor === '' ? null : Number(String(valor).replace(',', '.')),
    arredondamento: arred,
    simular,
  });

  async function executar(simular) {
    setErro('');
    if (!simular && !confirm(`Alterar o preço de ${previa.total} produto(s)? Fica registrado no histórico de preços de cada um.`)) return;
    setCarregando(true);
    try {
      const r = await api.post('/produtos/reajuste', corpo(simular));
      if (simular) setPrevia(r);
      else {
        avisar(`Preços de ${r.total} produto(s) atualizados`);
        setPrevia(null);
      }
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  const pede = ACOES[acao].pede;

  return (
    <>
      <Link to="/admin/produtos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Produtos
      </Link>
      <Cabecalho titulo="Preços em massa" subtitulo="Reajuste, promoções e recálculo pelo markup, com prévia antes de aplicar" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Cartao titulo="1. Quais produtos">
          {ids ? (
            <p className="text-sm">
              <strong>{ids.length}</strong> produto(s) selecionado(s) na lista.{' '}
              <Link to="/admin/precos" className="underline">
                Usar filtros
              </Link>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Categoria">
                <select value={filtro.categoria} onChange={(e) => setFiltro({ ...filtro, categoria: e.target.value })} className="campo">
                  <option value="">Todas</option>
                  {Object.entries(CATEGORIAS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Marca">
                <select value={filtro.marca} onChange={(e) => setFiltro({ ...filtro, marca: e.target.value })} className="campo">
                  <option value="">Todas</option>
                  {marcas?.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </Campo>
              <Campo label="Fornecedor">
                <select value={filtro.fornecedor_id} onChange={(e) => setFiltro({ ...filtro, fornecedor_id: e.target.value })} className="campo">
                  <option value="">Todos</option>
                  {fornecedores?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <label className="flex items-center gap-2 self-end pb-2 text-sm">
                <input type="checkbox" checked={filtro.somente_publicados} onChange={(e) => setFiltro({ ...filtro, somente_publicados: e.target.checked })} />
                Só os que estão no site
              </label>
            </div>
          )}
        </Cartao>

        <Cartao titulo="2. O que fazer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Ação" className="sm:col-span-2">
              <select value={acao} onChange={(e) => setAcao(e.target.value)} className="campo">
                {Object.entries(ACOES).map(([k, a]) => (
                  <option key={k} value={k}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Campo>
            {pede === 'pct' && (
              <Campo label="Percentual (%)">
                <input type="number" min="0.1" step="0.1" value={valor} onChange={(e) => setValor(e.target.value)} className="campo" placeholder="Ex.: 10" />
              </Campo>
            )}
            {pede === 'markup' && (
              <Campo label="Markup (× custo)" dica="Vazio = markup de cada categoria">
                <input type="number" min="1" step="0.05" value={valor} onChange={(e) => setValor(e.target.value)} className="campo" placeholder="Ex.: 2,5" />
              </Campo>
            )}
            {acao !== 'remover_promocao' && (
              <Campo label="Arredondamento">
                <select value={arred} onChange={(e) => setArred(e.target.value)} className="campo">
                  {Object.entries(ARREDONDAMENTOS).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
          <div className="mt-4">
            <Erro>{erro}</Erro>
          </div>
          <Botao className="mt-3 w-full" variante="secundario" carregando={carregando && !previa} onClick={() => executar(true)} disabled={pede === 'pct' && !valor}>
            <Eye size={16} /> Ver prévia
          </Botao>
        </Cartao>
      </div>

      {previa && (
        <Cartao
          className="mt-6"
          semPadding
          titulo={`3. Prévia: ${previa.total} produto(s) mudam de preço`}
          acoes={
            <Botao variante="sucesso" disabled={!previa.total} carregando={carregando} onClick={() => executar(false)}>
              <Check size={16} /> Aplicar
            </Botao>
          }
        >
          {previa.abaixo_do_custo > 0 && (
            <p className="flex items-center gap-2 border-b border-red-100 bg-red-50 px-5 py-2 text-sm text-red-700">
              <AlertTriangle size={16} /> {previa.abaixo_do_custo} produto(s) ficariam abaixo do custo.
            </p>
          )}
          <Tabela
            linhas={previa.itens}
            vazio="Nenhum produto muda de preço com esses filtros."
            colunas={[
              {
                titulo: 'Produto',
                render: (i) => (
                  <>
                    {i.nome} {i.cor && <span className="text-slate-500">· {i.cor}</span>}
                    <span className="block text-xs text-slate-400">{i.sku}</span>
                  </>
                ),
              },
              { titulo: 'Custo', direita: true, render: (i) => moeda(i.custo) },
              {
                titulo: 'Venda',
                direita: true,
                render: (i) =>
                  i.venda_antes === i.venda_depois ? (
                    moeda(i.venda_depois)
                  ) : (
                    <span>
                      <s className="text-slate-400">{moeda(i.venda_antes)}</s> <strong>{moeda(i.venda_depois)}</strong>
                    </span>
                  ),
              },
              {
                titulo: 'Promoção',
                direita: true,
                render: (i) =>
                  i.promo_antes === i.promo_depois ? (
                    i.promo_depois ? moeda(i.promo_depois) : '—'
                  ) : (
                    <span>
                      <s className="text-slate-400">{i.promo_antes ? moeda(i.promo_antes) : '—'}</s> <strong>{i.promo_depois ? moeda(i.promo_depois) : '—'}</strong>
                    </span>
                  ),
              },
              {
                titulo: 'Margem',
                direita: true,
                render: (i) =>
                  i.margem_depois == null ? '—' : <span className={i.margem_depois < 0 ? "font-semibold text-red-600" : i.margem_depois < 30 ? "text-amber-700" : "text-green-700"}>{Math.round(i.margem_depois)}%</span>,
              },
            ]}
          />
        </Cartao>
      )}
    </>
  );
}
