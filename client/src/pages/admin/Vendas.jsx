import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { qs } from '../../lib/api';
import { dataHora, hojeISO, moeda } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Etiqueta, Indicador, Tabela } from '../../components/admin/ui';

const inicioMes = () => hojeISO().slice(0, 8) + '01';

export default function Vendas() {
  const navigate = useNavigate();
  const { pode } = useAuth();
  const [f, setF] = useState({ de: inicioMes(), ate: hojeISO(), status: '' });
  const { dados } = useApi(`/vendas${qs(f)}`);
  const concluidas = dados?.filter((v) => v.status === 'concluida') || [];
  const total = concluidas.reduce((s, v) => s + v.total, 0);

  return (
    <>
      <Cabecalho titulo="Vendas">
        {pode('vendas.criar') && (
          <Link to="/admin/pdv">
            <Botao>
              <ShoppingCart size={16} /> Nova venda
            </Botao>
          </Link>
        )}
      </Cabecalho>

      {pode('relatorios.financeiro') && (
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <Indicador titulo="Total no período" valor={moeda(total)} />
          <Indicador titulo="Vendas" valor={concluidas.length} />
          <Indicador titulo="Ticket médio" valor={moeda(concluidas.length ? total / concluidas.length : 0)} />
        </div>
      )}

      <Cartao semPadding>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            de <input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} className="campo w-auto" />
          </label>
          <label className="flex items-center gap-2">
            até <input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} className="campo w-auto" />
          </label>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="campo w-auto">
            <option value="">Todas</option>
            <option value="concluida">Concluídas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </div>
        <Tabela
          linhas={dados}
          vazio="Nenhuma venda no período."
          onLinha={(v) => navigate(`/admin/vendas/${v.id}`)}
          colunas={[
            { titulo: '#', render: (v) => <span className="font-medium">#{v.id}</span> },
            { titulo: 'Data', render: (v) => dataHora(v.criado_em) },
            { titulo: 'Cliente', render: (v) => v.cliente_nome || <span className="text-slate-400">Consumidor</span> },
            { titulo: 'Pagamento', render: (v) => <span className="text-xs capitalize">{v.formas}</span> },
            { titulo: 'Vendedor', render: (v) => <span className="text-xs">{v.vendedor_nome}</span> },
            {
              titulo: 'Total',
              direita: true,
              render: (v) =>
                v.status === 'cancelada' ? (
                  <span>
                    <Etiqueta cor="red">cancelada</Etiqueta> <s className="text-slate-400">{moeda(v.total)}</s>
                  </span>
                ) : (
                  <span className="font-medium">{moeda(v.total)}</span>
                ),
            },
          ]}
        />
      </Cartao>
    </>
  );
}
