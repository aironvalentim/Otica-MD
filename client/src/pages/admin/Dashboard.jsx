import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign, TrendingUp, Receipt, AlertTriangle, CalendarDays, Wrench, RefreshCw, ShoppingCart } from 'lucide-react';
import { useApi } from '../../lib/hooks';
import { moeda, STATUS_OS } from '../../lib/format';
import { Botao, Cabecalho, Cartao, Etiqueta, Indicador } from '../../components/admin/ui';

function DicaGrafico({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const [a, m, dia] = d.dia.split('-');
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="text-slate-500">{`${dia}/${m}/${a}`}</p>
      <p className="font-semibold text-ink">{moeda(d.total)}</p>
      <p className="text-slate-500">{d.qtd} venda(s)</p>
    </div>
  );
}

export default function Dashboard() {
  const { dados: d, erro } = useApi('/dashboard');

  if (erro) return <p className="text-red-600">{erro}</p>;
  if (!d) return <p className="text-slate-500">Carregando…</p>;

  const v = d.vendas;
  const osPendentes = d.os_por_status.reduce((s, o) => s + o.qtd, 0);
  const osAtrasadas = d.os_por_status.reduce((s, o) => s + o.atrasadas, 0);

  return (
    <>
      <Cabecalho titulo="Painel" subtitulo={d.caixa_aberto ? 'Caixa aberto' : 'Caixa fechado. Abra o caixa para vender'}>
        {!d.caixa_aberto && (
          <Link to="/admin/caixa">
            <Botao variante="secundario">Abrir caixa</Botao>
          </Link>
        )}
        <Link to="/admin/pdv">
          <Botao>
            <ShoppingCart size={16} /> Nova venda
          </Botao>
        </Link>
      </Cabecalho>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador titulo="Vendas hoje" valor={moeda(v.hoje_total)} detalhe={`${v.hoje_qtd} venda(s)`} icone={DollarSign} />
        <Indicador
          titulo="Vendas no mês"
          valor={moeda(v.mes_total)}
          detalhe={v.mes_anterior_parcial > 0 ? `${moeda(v.mes_anterior_parcial)} no mesmo período do mês passado` : `${v.mes_qtd} venda(s)`}
          icone={TrendingUp}
        />
        <Indicador titulo="Ticket médio" valor={moeda(v.ticket_medio_mes)} detalhe="neste mês" icone={Receipt} />
        <Indicador
          titulo="Margem bruta"
          valor={moeda(v.margem_bruta_mes)}
          detalhe={v.mes_total > 0 ? `${Math.round((v.margem_bruta_mes / v.mes_total) * 100)}% das vendas do mês` : 'neste mês'}
          icone={TrendingUp}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Vendas dos últimos 30 dias" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.serie_30_dias} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis
                  dataKey="dia"
                  tickFormatter={(s) => s.slice(8, 10) + '/' + s.slice(5, 7)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  interval={4}
                />
                <YAxis
                  tickFormatter={(n) => (n >= 1000 ? `${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : n)}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={64}
                />
                <Tooltip content={<DicaGrafico />} cursor={{ fill: 'rgba(22,32,46,0.05)' }} />
                <Bar dataKey="total" fill="#16202e" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Cartao>

        <Cartao titulo="Precisa de atenção">
          <ul className="space-y-3 text-sm">
            <li>
              <Link to="/admin/crediario?situacao=atrasadas" className="flex items-center justify-between hover:underline">
                <span className="flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-600" /> Crediário atrasado
                </span>
                <span className="font-medium">
                  {moeda(d.crediario.atrasado)} <span className="text-slate-400">({d.crediario.parcelas_atrasadas})</span>
                </span>
              </Link>
            </li>
            <li>
              <Link to="/admin/os" className="flex items-center justify-between hover:underline">
                <span className="flex items-center gap-2">
                  <Wrench size={16} className="text-amber-600" /> OS em andamento
                </span>
                <span className="font-medium">
                  {osPendentes}
                  {osAtrasadas > 0 && <span className="text-red-600"> ({osAtrasadas} atrasada{osAtrasadas > 1 ? 's' : ''})</span>}
                </span>
              </Link>
            </li>
            <li>
              <Link to="/admin/agendamentos" className="flex items-center justify-between hover:underline">
                <span className="flex items-center gap-2">
                  <CalendarDays size={16} className="text-blue-600" /> Agendamentos novos
                </span>
                <span className="font-medium">{d.agendamentos_novos}</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/clientes?lembretes=1" className="flex items-center justify-between hover:underline">
                <span className="flex items-center gap-2">
                  <RefreshCw size={16} className="text-green-600" /> Receita com +1 ano (lembrar troca)
                </span>
                <span className="font-medium">{d.lembretes_troca}</span>
              </Link>
            </li>
            <li className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-slate-500">Crediário a vencer em 7 dias</span>
              <span className="font-medium">{moeda(d.crediario.vence_semana)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-500">Total a receber no crediário</span>
              <span className="font-medium">{moeda(d.crediario.a_receber)}</span>
            </li>
          </ul>
        </Cartao>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Cartao titulo="OS por etapa">
          {d.os_por_status.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma OS em andamento.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.os_por_status.map((o) => (
                <li key={o.status} className="flex items-center justify-between">
                  <Etiqueta cor={STATUS_OS[o.status].cor}>{STATUS_OS[o.status].label}</Etiqueta>
                  <span className="font-medium">{o.qtd}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Mais vendidos no mês">
          {d.mais_vendidos_mes.length === 0 ? (
            <p className="text-sm text-slate-500">Sem vendas neste mês.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.mais_vendidos_mes.map((p) => (
                <li key={p.descricao} className="flex justify-between gap-3">
                  <span className="truncate">
                    {p.descricao} <span className="text-slate-400">×{p.qtd}</span>
                  </span>
                  <span className="shrink-0 font-medium">{moeda(p.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao
          titulo="Estoque baixo"
          acoes={
            <Link to="/admin/produtos?estoque=baixo" className="text-xs text-slate-500 hover:text-ink">
              Ver todos
            </Link>
          }
        >
          {d.estoque_baixo.length === 0 ? (
            <p className="text-sm text-slate-500">Tudo em dia.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.estoque_baixo.map((p) => (
                <li key={p.id} className="flex justify-between gap-3">
                  <Link to={`/admin/produtos/${p.id}`} className="truncate hover:underline">
                    {p.nome} {p.cor && <span className="text-slate-400">· {p.cor}</span>}
                  </Link>
                  <span className={`shrink-0 font-medium ${p.estoque_atual <= 0 ? 'text-red-600' : 'text-amber-700'}`}>
                    {p.estoque_atual} / mín. {p.estoque_minimo}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>
    </>
  );
}
