import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Trash2, X, Wand2, Tag } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { CATEGORIAS, FORMATOS, GENEROS, MATERIAIS, cap, moeda, dataHora, MOTIVOS_MOV } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Tabela, useToast } from '../../components/admin/ui';
import GlassesArt from '../../components/site/GlassesArt';
import { precoSugerido, markupDe } from '../../lib/precos';

const VAZIO = {
  nome: '',
  sku: '',
  categoria: 'armacao',
  marca: '',
  modelo: '',
  cor: '',
  genero: '',
  formato: '',
  material: '',
  largura_lente: '',
  ponte: '',
  haste: '',
  descricao: '',
  preco_custo: '',
  preco_venda: '',
  preco_promocional: '',
  controla_estoque: true,
  estoque_minimo: 1,
  estoque_inicial: 0,
  fornecedor_id: '',
  publicado: false,
  destaque: false,
  imagens: [],
  ativo: true,
};

export default function ProdutoForm() {
  const { id } = useParams();
  const novo = !id;
  const navigate = useNavigate();
  const avisar = useToast();
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState('');
  const { dados: fornecedores } = useApi('/fornecedores?tipo=fornecedor');
  const { dados: movs } = useApi(novo ? null : `/estoque/movimentacoes?produto_id=${id}`);
  const { dados: precos } = useApi(novo ? null : `/produtos/${id}/precos`);
  const { dados: config } = useApi('/configuracoes');

  useEffect(() => {
    if (novo) return;
    api
      .get(`/produtos/${id}`)
      .then((p) => setForm({ ...VAZIO, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])) }))
      .catch((e) => setErro(e.message));
  }, [id, novo]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const ehOculos = form.categoria === 'armacao' || form.categoria === 'solar';

  async function enviarFotos(e) {
    const files = e.target.files;
    if (!files?.length) return;
    setEnviandoFoto(true);
    try {
      const { urls } = await api.upload(files);
      setForm((f) => ({ ...f, imagens: [...f.imagens, ...urls].slice(0, 10) }));
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setEnviandoFoto(false);
      e.target.value = '';
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    const campos = Object.keys(VAZIO).filter((k) => novo || k !== 'estoque_inicial');
    const corpo = Object.fromEntries(campos.map((k) => [k, form[k]]));
    try {
      const p = novo ? await api.post('/produtos', corpo) : await api.put(`/produtos/${id}`, corpo);
      avisar('Produto salvo');
      if (novo) navigate(`/admin/produtos/${p.id}`, { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function desativar() {
    if (!confirm('Desativar este produto? Ele sai do site e do PDV, mas continua no histórico de vendas.')) return;
    await api.del(`/produtos/${id}`);
    avisar('Produto desativado');
    navigate('/admin/produtos');
  }

  const precoEfetivo = Number(form.preco_promocional) > 0 ? Number(form.preco_promocional) : Number(form.preco_venda);
  const margem = precoEfetivo > 0 ? Math.round((1 - Number(form.preco_custo || 0) / precoEfetivo) * 100) : null;
  const sugerido = precoSugerido(form.preco_custo, form.categoria, config);

  return (
    <form onSubmit={salvar}>
      <Link to="/admin/produtos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Produtos
      </Link>
      <Cabecalho titulo={novo ? 'Novo produto' : form.nome || 'Produto'} subtitulo={!novo && form.controla_estoque ? `Estoque atual: ${form.estoque_atual}` : null}>
        {!novo && form.ativo && (
          <Botao type="button" variante="secundario" onClick={desativar}>
            <Trash2 size={16} /> Desativar
          </Botao>
        )}
        <Botao type="submit" carregando={salvando}>
          Salvar
        </Botao>
      </Cabecalho>
      <Erro>{erro}</Erro>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Cartao titulo="Informações">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Nome *" className="sm:col-span-2">
                <input required value={form.nome} onChange={set('nome')} className="campo" placeholder="Ex.: Armação Aurora" />
              </Campo>
              <Campo label="Categoria *">
                <select value={form.categoria} onChange={set('categoria')} className="campo">
                  {Object.entries(CATEGORIAS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="SKU / código">
                <input value={form.sku} onChange={set('sku')} className="campo" />
              </Campo>
              <Campo label="Marca">
                <input value={form.marca} onChange={set('marca')} className="campo" />
              </Campo>
              <Campo label="Modelo">
                <input value={form.modelo} onChange={set('modelo')} className="campo" />
              </Campo>
              <Campo label="Cor">
                <input value={form.cor} onChange={set('cor')} className="campo" placeholder="Ex.: Preto fosco" />
              </Campo>
              <Campo label="Fornecedor">
                <select value={form.fornecedor_id} onChange={set('fornecedor_id')} className="campo">
                  <option value="">—</option>
                  {fornecedores?.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo label="Descrição (aparece no site)" className="sm:col-span-2">
                <textarea rows={3} value={form.descricao} onChange={set('descricao')} className="campo" />
              </Campo>
            </div>
          </Cartao>

          {ehOculos && (
            <Cartao titulo="Características da armação">
              <div className="grid gap-4 sm:grid-cols-3">
                <Campo label="Público">
                  <select value={form.genero} onChange={set('genero')} className="campo">
                    <option value="">—</option>
                    {Object.entries(GENEROS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Formato">
                  <select value={form.formato} onChange={set('formato')} className="campo">
                    <option value="">—</option>
                    {FORMATOS.map((f) => (
                      <option key={f} value={f}>
                        {cap(f)}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Material">
                  <select value={form.material} onChange={set('material')} className="campo">
                    <option value="">—</option>
                    {MATERIAIS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Largura da lente (mm)">
                  <input type="number" min="0" value={form.largura_lente} onChange={set('largura_lente')} className="campo" />
                </Campo>
                <Campo label="Ponte (mm)">
                  <input type="number" min="0" value={form.ponte} onChange={set('ponte')} className="campo" />
                </Campo>
                <Campo label="Haste (mm)">
                  <input type="number" min="0" value={form.haste} onChange={set('haste')} className="campo" />
                </Campo>
              </div>
            </Cartao>
          )}

          <Cartao titulo="Fotos">
            <p className="mb-3 text-xs text-slate-500">
              1ª foto: <strong>frente</strong>. 2ª foto: <strong>lateral ou 45°</strong>, que aparece quando o cliente passa o mouse no catálogo.
              Use fundo branco para o melhor efeito. As setas mudam a ordem.
            </p>
            <div className="flex flex-wrap gap-3">
              {form.imagens.map((url, i) => (
                <div key={url} className="relative h-24 w-32 overflow-hidden rounded-lg bg-slate-100">
                  <img src={url} alt="" className="h-full w-full object-contain" />
                  {i < 2 && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{i === 0 ? 'frente' : 'lateral (hover)'}</span>
                  )}
                  <div className="absolute bottom-1 right-1 flex gap-0.5">
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => { const l = [...f.imagens]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; return { ...f, imagens: l }; })}
                        className="rounded bg-white/90 px-1 text-xs text-slate-700"
                        aria-label="Mover para a esquerda"
                      >
                        ◀
                      </button>
                    )}
                    {i < form.imagens.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => { const l = [...f.imagens]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; return { ...f, imagens: l }; })}
                        className="rounded bg-white/90 px-1 text-xs text-slate-700"
                        aria-label="Mover para a direita"
                      >
                        ▶
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imagens: form.imagens.filter((u) => u !== url) })}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-slate-700"
                    aria-label="Remover foto"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-ink hover:text-ink">
                <ImagePlus size={20} />
                {enviandoFoto ? 'Enviando…' : 'Adicionar'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={enviarFotos} disabled={enviandoFoto} />
              </label>
            </div>
            {form.imagens.length === 0 && ehOculos && (
              <div className="mt-4 flex items-center gap-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                <GlassesArt formato={form.formato} cor={form.cor} solar={form.categoria === 'solar'} className="w-24" />
                Sem foto, o site mostra esta ilustração pelo formato e pela cor.
              </div>
            )}
          </Cartao>
        </div>

        <div className="space-y-6">
          <Cartao titulo="Preço">
            <div className="space-y-4">
              <Campo label="Preço de custo (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.preco_custo}
                  onChange={set('preco_custo')}
                  onBlur={() => {
                    // Cadastro novo sem preço: já preenche com o sugerido
                    if (novo && !form.preco_venda && sugerido) setForm((f) => ({ ...f, preco_venda: sugerido }));
                  }}
                  className="campo"
                />
              </Campo>
              <Campo label="Preço de venda (R$) *">
                <input required type="number" step="0.01" min="0" value={form.preco_venda} onChange={set('preco_venda')} className="campo" />
              </Campo>
              {sugerido && Number(form.preco_venda) !== sugerido && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, preco_venda: sugerido })}
                  className="flex w-full items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100"
                >
                  <span className="flex items-center gap-1.5">
                    <Wand2 size={14} /> Sugerido: <strong>{moeda(sugerido)}</strong> ({String(markupDe(config, form.categoria)).replace('.', ',')}× o custo)
                  </span>
                  <span className="font-medium underline">usar</span>
                </button>
              )}
              <Campo label="Preço promocional (R$)" dica="Deixe vazio se não houver promoção">
                <input type="number" step="0.01" min="0" value={form.preco_promocional} onChange={set('preco_promocional')} className="campo" />
              </Campo>
              {margem !== null && (
                <p className="text-sm text-slate-600">
                  Margem: <strong className={margem < 30 ? 'text-amber-700' : 'text-green-700'}>{margem}%</strong>
                  {form.preco_promocional ? ' (no preço promocional)' : ''}
                </p>
              )}
              {!novo && form.sku && (
                <Link to={`/admin/etiquetas?ids=${id}`} className="flex items-center gap-1.5 text-xs text-slate-600 underline">
                  <Tag size={13} /> Imprimir etiqueta ({form.sku})
                </Link>
              )}
            </div>
          </Cartao>

          <Cartao titulo="Estoque">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.controla_estoque} onChange={set('controla_estoque')} /> Controlar estoque
              </label>
              {form.controla_estoque ? (
                <>
                  {novo && (
                    <Campo label="Quantidade inicial">
                      <input type="number" min="0" value={form.estoque_inicial} onChange={set('estoque_inicial')} className="campo" />
                    </Campo>
                  )}
                  <Campo label="Estoque mínimo (alerta)">
                    <input type="number" min="0" value={form.estoque_minimo} onChange={set('estoque_minimo')} className="campo" />
                  </Campo>
                  {!novo && (
                    <p className="text-xs text-slate-500">
                      Para mudar a quantidade, use <Link to="/admin/estoque" className="underline">Entradas e saídas</Link>.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500">Use para lentes sob encomenda e serviços: a venda não baixa estoque.</p>
              )}
            </div>
          </Cartao>

          <Cartao titulo="Site">
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.publicado} onChange={set('publicado')} /> Mostrar no catálogo do site
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.destaque} onChange={set('destaque')} /> Destaque na página inicial
              </label>
              {!novo && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.ativo} onChange={set('ativo')} /> Produto ativo
                </label>
              )}
              {!novo && form.publicado && (
                <a href={`/produto/${form.slug}`} target="_blank" rel="noreferrer" className="block text-xs underline">
                  Ver no site
                </a>
              )}
            </div>
          </Cartao>
        </div>
      </div>

      {!novo && (
        <Cartao titulo="Histórico de estoque" className="mt-6" semPadding>
          <Tabela
            linhas={movs}
            vazio="Nenhuma movimentação ainda."
            colunas={[
              { titulo: 'Data', render: (m) => dataHora(m.criado_em) },
              { titulo: 'Tipo', render: (m) => (m.tipo === 'entrada' ? '↑ Entrada' : m.tipo === 'saida' ? '↓ Saída' : '⇄ Ajuste') },
              { titulo: 'Motivo', render: (m) => MOTIVOS_MOV[m.motivo] },
              { titulo: 'Qtd.', direita: true, campo: 'quantidade' },
              { titulo: 'Saldo', direita: true, render: (m) => `${m.estoque_anterior} → ${m.estoque_posterior}` },
              { titulo: 'Custo un.', direita: true, render: (m) => (m.custo_unitario != null ? moeda(m.custo_unitario) : '—') },
              { titulo: 'Obs.', render: (m) => <span className="text-xs text-slate-500">{[m.documento, m.observacao].filter(Boolean).join(' · ')}</span> },
            ]}
          />
        </Cartao>
      )}

      {!novo && precos?.length > 0 && (
        <Cartao titulo="Histórico de preços" className="mt-6" semPadding>
          <Tabela
            linhas={precos}
            colunas={[
              { titulo: 'Data', render: (h) => dataHora(h.criado_em) },
              { titulo: 'Motivo', campo: 'motivo' },
              { titulo: 'Custo', direita: true, render: (h) => (h.custo_anterior !== h.custo_novo ? `${moeda(h.custo_anterior)} → ${moeda(h.custo_novo)}` : moeda(h.custo_novo)) },
              { titulo: 'Venda', direita: true, render: (h) => (h.venda_anterior !== h.venda_nova ? `${moeda(h.venda_anterior)} → ${moeda(h.venda_nova)}` : moeda(h.venda_nova)) },
              {
                titulo: 'Promoção',
                direita: true,
                render: (h) => (h.promocional_anterior === h.promocional_novo ? (h.promocional_novo ? moeda(h.promocional_novo) : '—') : `${h.promocional_anterior ? moeda(h.promocional_anterior) : '—'} → ${h.promocional_novo ? moeda(h.promocional_novo) : '—'}`),
              },
              { titulo: 'Por', render: (h) => <span className="text-xs text-slate-500">{h.usuario_nome}</span> },
            ]}
          />
        </Cartao>
      )}
    </form>
  );
}
