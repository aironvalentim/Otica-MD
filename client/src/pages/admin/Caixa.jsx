import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { FORMAS_PAGAMENTO, dataHora, moeda } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Indicador, Modal, Tabela, useToast } from '../../components/admin/ui';

const TIPOS = {
  venda: 'Venda',
  recebimento_crediario: 'Crediário',
  suprimento: 'Suprimento',
  sangria: 'Sangria',
  estorno: 'Estorno',
};

function FormValor({ label, botao, variante, onConfirmar, extra }) {
  const [valor, setValor] = useState('');
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function ok(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await onConfirmar(valor, texto);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }
  return (
    <form onSubmit={ok} className="space-y-4">
      {extra}
      <Campo label={label}>
        <input autoFocus required type="number" step="0.01" min="0" value={valor} onChange={(e) => setValor(e.target.value)} className="campo text-lg" />
      </Campo>
      <Campo label="Observação">
        <input value={texto} onChange={(e) => setTexto(e.target.value)} className="campo" />
      </Campo>
      <Erro>{erro}</Erro>
      <Botao type="submit" variante={variante} carregando={salvando} className="w-full">
        {botao}
      </Botao>
    </form>
  );
}

export default function Caixa() {
  const avisar = useToast();
  const { dados: cx, recarregar, carregando } = useApi('/caixa/atual');
  const { dados: historico, recarregar: recarregarHist } = useApi('/caixa');
  const [modal, setModal] = useState(null);
  const [resultado, setResultado] = useState(null);

  const tudo = () => {
    setModal(null);
    recarregar();
    recarregarHist();
  };

  if (carregando && !cx) return <p className="text-slate-500">Carregando…</p>;

  return (
    <>
      <Cabecalho titulo="Caixa" subtitulo={cx ? `Aberto por ${cx.aberto_por_nome} em ${dataHora(cx.aberto_em)}` : 'Nenhum caixa aberto'}>
        {cx ? (
          <>
            <Botao variante="secundario" onClick={() => setModal('suprimento')}>
              <ArrowDownCircle size={16} /> Suprimento
            </Botao>
            <Botao variante="secundario" onClick={() => setModal('sangria')}>
              <ArrowUpCircle size={16} /> Sangria
            </Botao>
            <Botao variante="perigo" onClick={() => setModal('fechar')}>
              <Lock size={16} /> Fechar caixa
            </Botao>
          </>
        ) : (
          <Botao onClick={() => setModal('abrir')}>
            <Unlock size={16} /> Abrir caixa
          </Botao>
        )}
      </Cabecalho>

      {resultado && (
        <div className={`mb-6 rounded-lg px-4 py-3 text-sm ${Math.abs(resultado.diferenca) < 0.01 ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
          Caixa #{resultado.id} fechado. Esperado em dinheiro: {moeda(resultado.valor_fechamento_calculado)} · Contado: {moeda(resultado.valor_fechamento_informado)} ·{' '}
          <strong>
            {Math.abs(resultado.diferenca) < 0.01 ? 'Sem diferença' : resultado.diferenca > 0 ? `Sobra de ${moeda(resultado.diferenca)}` : `Falta de ${moeda(-resultado.diferenca)}`}
          </strong>
        </div>
      )}

      {cx && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Indicador titulo="Dinheiro na gaveta" valor={moeda(cx.dinheiro_esperado)} detalhe={`Abertura ${moeda(cx.valor_abertura)}`} />
            {['pix', 'debito', 'credito'].map((f) => (
              <Indicador key={f} titulo={FORMAS_PAGAMENTO[f]} valor={moeda(cx.por_forma[f])} />
            ))}
            <Indicador titulo="Vendas do caixa" valor={moeda(cx.total_vendas)} />
          </div>

          <Cartao titulo="Movimentos do caixa" className="mt-6" semPadding>
            <Tabela
              linhas={cx.lancamentos}
              vazio="Nenhum movimento ainda."
              colunas={[
                { titulo: 'Hora', render: (l) => dataHora(l.criado_em) },
                { titulo: 'Tipo', render: (l) => TIPOS[l.tipo] },
                { titulo: 'Forma', render: (l) => FORMAS_PAGAMENTO[l.forma_pagamento] },
                { titulo: 'Descrição', render: (l) => <span className="text-xs">{l.descricao}</span> },
                { titulo: 'Por', render: (l) => <span className="text-xs text-slate-500">{l.usuario_nome}</span> },
                {
                  titulo: 'Valor',
                  direita: true,
                  render: (l) => <span className={l.valor < 0 ? 'text-red-600' : 'text-green-700'}>{moeda(l.valor)}</span>,
                },
              ]}
            />
          </Cartao>
        </>
      )}

      <Cartao titulo="Caixas anteriores" className="mt-6" semPadding>
        <Tabela
          linhas={historico?.filter((h) => h.fechado_em)}
          vazio="Nenhum caixa fechado ainda."
          colunas={[
            { titulo: '#', render: (h) => `#${h.id}` },
            { titulo: 'Abertura', render: (h) => `${dataHora(h.aberto_em)} · ${h.aberto_por_nome || ''}` },
            { titulo: 'Fechamento', render: (h) => `${dataHora(h.fechado_em)} · ${h.fechado_por_nome || ''}` },
            { titulo: 'Vendas', direita: true, render: (h) => moeda(h.total_vendas) },
            {
              titulo: 'Diferença',
              direita: true,
              render: (h) => {
                const d = (h.valor_fechamento_informado || 0) - (h.valor_fechamento_calculado || 0);
                return <span className={Math.abs(d) < 0.01 ? 'text-slate-500' : d > 0 ? 'text-green-700' : 'text-red-600'}>{moeda(d)}</span>;
              },
            },
          ]}
        />
      </Cartao>

      <Modal aberto={modal === 'abrir'} onFechar={() => setModal(null)} titulo="Abrir caixa">
        <FormValor
          label="Troco inicial na gaveta (R$)"
          botao="Abrir caixa"
          onConfirmar={async (valor, obs) => {
            await api.post('/caixa/abrir', { valor_abertura: valor, observacoes: obs });
            setResultado(null);
            avisar('Caixa aberto');
            tudo();
          }}
        />
      </Modal>
      <Modal aberto={modal === 'suprimento' || modal === 'sangria'} onFechar={() => setModal(null)} titulo={modal === 'sangria' ? 'Sangria (retirada)' : 'Suprimento (entrada de troco)'}>
        <FormValor
          key={modal}
          label="Valor em dinheiro (R$)"
          botao="Registrar"
          onConfirmar={async (valor, descricao) => {
            await api.post('/caixa/lancamentos', { tipo: modal, valor, descricao });
            avisar('Registrado');
            tudo();
          }}
        />
      </Modal>
      <Modal aberto={modal === 'fechar'} onFechar={() => setModal(null)} titulo="Fechar caixa">
        <FormValor
          label="Dinheiro contado na gaveta (R$)"
          botao="Fechar caixa"
          variante="perigo"
          extra={<p className="text-sm text-slate-600">Conte as notas e moedas e informe o total. O sistema compara com o esperado e mostra sobra ou falta.</p>}
          onConfirmar={async (valor, obs) => {
            const r = await api.post('/caixa/fechar', { valor_informado: valor, observacoes: obs });
            setResultado(r);
            tudo();
          }}
        />
      </Modal>
    </>
  );
}
