import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Globe, FileSpreadsheet, Percent, Tag, X } from 'lucide-react';
import { useApi, useDebounce } from '../../lib/hooks';
import { qs } from '../../lib/api';
import { CATEGORIA_SING, CATEGORIAS, moeda, precoFinal } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Etiqueta, Tabela } from '../../components/admin/ui';
import { useAuth } from '../../lib/auth';

export default function Produtos() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [estoque, setEstoque] = useState(params.get('estoque') || '');
  const [inativos, setInativos] = useState(false);
  const b = useDebounce(busca);
  const { dados } = useApi(`/produtos${qs({ busca: b, categoria, estoque, ativo: inativos ? 'todos' : '' })}`);
  const { pode } = useAuth();
  const [sel, setSel] = useState(new Set());
  const alternar = (id) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const todosMarcados = dados?.length > 0 && dados.every((p) => sel.has(p.id));
  const marcarTodos = () => setSel(todosMarcados ? new Set() : new Set(dados.map((p) => p.id)));
  const idsSel = [...sel].join(',');
  const podeSelecionar = pode('etiquetas.imprimir') || pode('precos.massa');

  return (
    <>
      <Cabecalho titulo="Produtos" subtitulo="Armações, óculos de sol, lentes, acessórios e serviços">
        {pode('produtos.importar') && (
          <Link to="/admin/produtos/importar">
            <Botao variante="secundario">
              <FileSpreadsheet size={16} /> Importar planilha
            </Botao>
          </Link>
        )}
        {pode('precos.massa') && (
          <Link to="/admin/precos">
            <Botao variante="secundario">
              <Percent size={16} /> Preços em massa
            </Botao>
          </Link>
        )}
        {pode('etiquetas.imprimir') && (
          <Link to="/admin/etiquetas">
            <Botao variante="secundario">
              <Tag size={16} /> Etiquetas
            </Botao>
          </Link>
        )}
        {pode('produtos.editar') && (
          <Link to="/admin/produtos/novo">
            <Botao>
              <Plus size={16} /> Novo produto
            </Botao>
          </Link>
        )}
      </Cabecalho>

      {sel.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-sm text-white shadow-lg">
          <span className="font-medium">{sel.size} selecionado(s)</span>
          {pode('etiquetas.imprimir') && (
            <Link
              to={`/admin/etiquetas?ids=${idsSel}`}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
            >
              <Tag size={14} /> Imprimir etiquetas
            </Link>
          )}
          {pode('precos.massa') && (
            <Link
              to={`/admin/precos?ids=${idsSel}`}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20"
            >
              <Percent size={14} /> Alterar preços
            </Link>
          )}
          <button onClick={() => setSel(new Set())} className="ml-auto flex items-center gap-1 text-white/70 hover:text-white">
            <X size={14} /> Limpar
          </button>
        </div>
      )}

      <Cartao semPadding>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, SKU, marca…"
              className="campo pl-9"
            />
          </div>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="campo w-auto">
            <option value="">Todas as categorias</option>
            {Object.entries(CATEGORIAS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={estoque} onChange={(e) => setEstoque(e.target.value)} className="campo w-auto">
            <option value="">Qualquer estoque</option>
            <option value="baixo">Estoque baixo</option>
            <option value="zerado">Zerado</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={inativos} onChange={(e) => setInativos(e.target.checked)} /> Mostrar inativos
          </label>
        </div>
        <Tabela
          linhas={dados}
          onLinha={(p) => navigate(`/admin/produtos/${p.id}`)}
          colunas={[
            podeSelecionar && {
              titulo: <input type="checkbox" aria-label="Selecionar todos" checked={!!todosMarcados} onChange={marcarTodos} />,
              chaveColuna: 'sel',
              render: (p) => (
                <input
                  type="checkbox"
                  aria-label={`Selecionar ${p.nome}`}
                  checked={sel.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => alternar(p.id)}
                />
              ),
            },
            {
              titulo: 'Produto',
              render: (p) => (
                <div>
                  <p className="font-medium">
                    {p.nome} {!p.ativo && <Etiqueta cor="zinc">inativo</Etiqueta>}
                  </p>
                  <p className="text-xs text-slate-500">{[p.sku, p.marca, p.cor].filter(Boolean).join(' · ')}</p>
                </div>
              ),
            },
            { titulo: 'Categoria', render: (p) => CATEGORIA_SING[p.categoria] },
            {
              titulo: 'Site',
              render: (p) =>
                p.publicado ? (
                  <span className="flex items-center gap-1 text-green-700">
                    <Globe size={14} /> {p.destaque ? 'Destaque' : 'Publicado'}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            pode('custos.ver') && { titulo: 'Custo', direita: true, render: (p) => moeda(p.preco_custo) },
            {
              titulo: 'Venda',
              direita: true,
              render: (p) => (
                <>
                  {moeda(precoFinal(p))}
                  {p.preco_promocional ? <span className="block text-xs text-slate-400 line-through">{moeda(p.preco_venda)}</span> : null}
                </>
              ),
            },
            {
              titulo: 'Estoque',
              direita: true,
              render: (p) =>
                !p.controla_estoque ? (
                  <span className="text-slate-400">sob encomenda</span>
                ) : (
                  <span
                    className={
                      p.estoque_atual <= 0
                        ? 'font-semibold text-red-600'
                        : p.estoque_atual <= p.estoque_minimo
                          ? 'font-semibold text-amber-700'
                          : ''
                    }
                  >
                    {p.estoque_atual}
                  </span>
                ),
            },
          ].filter(Boolean)}
        />
      </Cartao>
    </>
  );
}
