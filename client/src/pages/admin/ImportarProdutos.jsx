import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { CATEGORIA_SING, moeda } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Erro, Etiqueta, Indicador, Tabela, useToast } from '../../components/admin/ui';

const ACOES = {
  novo: { label: 'Novo', cor: 'green' },
  atualizar: { label: 'Atualizar', cor: 'blue' },
  erro: { label: 'Erro', cor: 'red' },
};

export default function ImportarProdutos() {
  const avisar = useToast();
  const input = useRef(null);
  const [arquivo, setArquivo] = useState(null);
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState('');

  async function escolher(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setArquivo(f);
    setResultado(null);
    setErro('');
    setCarregando(true);
    try {
      setPrevia(await api.enviarArquivo('/produtos/importacao?simular=1', 'arquivo', f));
    } catch (err) {
      setPrevia(null);
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function importar() {
    setErro('');
    setCarregando(true);
    try {
      const r = await api.enviarArquivo('/produtos/importacao', 'arquivo', arquivo);
      setResultado(r);
      setPrevia(null);
      avisar(`${r.total.novos} produto(s) criado(s) e ${r.total.atualizar} atualizado(s)`);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  const linhas = previa?.linhas.filter((l) => !filtro || l.acao === filtro);

  return (
    <>
      <Link to="/admin/produtos" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-ink">
        <ArrowLeft size={16} /> Produtos
      </Link>
      <Cabecalho titulo="Importar produtos por planilha" subtitulo="Cadastre ou reponha dezenas de produtos de uma vez">
        <Botao variante="secundario" onClick={() => api.baixar('/produtos/importacao/modelo', 'modelo-produtos-otica-md.xlsx').catch((e) => avisar(e.message, 'erro'))}>
          <Download size={16} /> Baixar modelo (.xlsx)
        </Botao>
      </Cabecalho>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Como funciona" className="lg:col-span-1">
          <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-600">
            <li>Baixe o modelo e preencha uma linha por produto (cada cor é uma linha).</li>
            <li>
              <strong>Nome</strong> e <strong>Categoria</strong> são obrigatórios.
            </li>
            <li>
              Sem <strong>preço de venda</strong>, o sistema calcula pelo custo e pelo markup definido em{' '}
              <Link to="/admin/configuracoes" className="underline">
                Configurações
              </Link>
              .
            </li>
            <li>
              Se o <strong>código (SKU)</strong> já existir, a linha atualiza o produto e soma a <strong>quantidade</strong> ao estoque.
            </li>
            <li>Envie o arquivo: primeiro aparece uma prévia, e nada é gravado até você confirmar.</li>
          </ol>
        </Cartao>

        <Cartao titulo="Enviar planilha" className="lg:col-span-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={carregando}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-10 text-slate-500 transition hover:border-ink hover:text-ink disabled:opacity-60"
          >
            <FileSpreadsheet size={32} />
            <span className="font-medium">{carregando ? 'Lendo planilha…' : arquivo ? `Trocar arquivo (${arquivo.name})` : 'Escolher arquivo .xlsx ou .csv'}</span>
            <span className="text-xs">Até 2.000 linhas</span>
          </button>
          <input ref={input} type="file" accept=".xlsx,.csv" className="hidden" onChange={escolher} />
          <div className="mt-4">
            <Erro>{erro}</Erro>
          </div>

          {resultado && (
            <div className="mt-4 flex items-start gap-3 rounded-lg bg-green-50 p-4 text-sm text-green-800">
              <CheckCircle2 className="shrink-0" size={20} />
              <div>
                <p className="font-medium">Importação concluída.</p>
                <p>
                  {resultado.total.novos} produto(s) novo(s), {resultado.total.atualizar} atualizado(s) e {resultado.total.unidades} unidade(s) lançadas no
                  estoque.
                </p>
                <Link to="/admin/produtos" className="mt-1 inline-block underline">
                  Ver produtos
                </Link>
              </div>
            </div>
          )}
        </Cartao>
      </div>

      {previa && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Indicador titulo="Novos" valor={previa.total.novos} cor="text-green-700" />
            <Indicador titulo="Atualizar" valor={previa.total.atualizar} cor="text-blue-700" />
            <Indicador titulo="Com erro" valor={previa.total.erros} cor={previa.total.erros ? 'text-red-600' : 'text-ink'} />
            <Indicador titulo="Unidades para o estoque" valor={previa.total.unidades} />
          </div>

          <Cartao
            className="mt-6"
            semPadding
            titulo="Prévia da importação"
            acoes={
              <div className="flex gap-1 text-xs">
                {[['', 'Todas'], ['novo', 'Novos'], ['atualizar', 'Atualizar'], ['erro', 'Erros']].map(([k, l]) => (
                  <button key={k} onClick={() => setFiltro(k)} className={`rounded-full px-2.5 py-1 ${filtro === k ? 'bg-ink text-white' : 'bg-slate-100'}`}>
                    {l}
                  </button>
                ))}
              </div>
            }
          >
            <Tabela
              chave="linha"
              linhas={linhas}
              vazio="Nenhuma linha neste filtro."
              colunas={[
                { titulo: 'Linha', render: (l) => <span className="text-slate-400">{l.linha}</span> },
                { titulo: 'Ação', render: (l) => <Etiqueta cor={ACOES[l.acao].cor}>{ACOES[l.acao].label}</Etiqueta> },
                {
                  titulo: 'Produto',
                  render: (l) => (
                    <div>
                      <p className="font-medium">
                        {l.nome || '—'} {l.cor && <span className="font-normal text-slate-500">· {l.cor}</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {l.sku} {l.categoria && `· ${CATEGORIA_SING[l.categoria]}`}
                      </p>
                      {l.erros.length > 0 && <p className="mt-1 text-xs text-red-600">{l.erros.join(' · ')}</p>}
                    </div>
                  ),
                },
                { titulo: 'Custo', direita: true, render: (l) => (l.custo != null ? moeda(l.custo) : '—') },
                {
                  titulo: 'Venda',
                  direita: true,
                  render: (l) =>
                    l.venda != null ? (
                      <span>
                        {moeda(l.venda)}
                        {l.sugerido && <span className="block text-[11px] text-amber-700">sugerido pelo markup</span>}
                      </span>
                    ) : (
                      '—'
                    ),
                },
                { titulo: 'Qtd.', direita: true, render: (l) => (l.quantidade ? `+${l.quantidade}` : '—') },
              ]}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
              {previa.total.erros > 0 ? (
                <p className="flex items-center gap-2 text-sm text-red-700">
                  <AlertTriangle size={16} /> Corrija as linhas com erro na planilha e envie de novo.
                </p>
              ) : (
                <p className="text-sm text-slate-600">Tudo certo. Confira os preços antes de importar.</p>
              )}
              <Botao onClick={importar} disabled={previa.total.erros > 0 || previa.linhas.length === 0} carregando={carregando}>
                <Upload size={16} /> Importar {previa.total.novos + previa.total.atualizar} produto(s)
              </Botao>
            </div>
          </Cartao>
        </>
      )}
    </>
  );
}
