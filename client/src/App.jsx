import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import SiteLayout from './components/site/SiteLayout';
import Home from './pages/site/Home';
import Catalogo from './pages/site/Catalogo';
import Produto from './pages/site/Produto';
import Agendar from './pages/site/Agendar';
import { useAuth } from './lib/auth';

// O painel é carregado sob demanda: quem só visita o site não baixa esse código
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Produtos = lazy(() => import('./pages/admin/Produtos'));
const ProdutoForm = lazy(() => import('./pages/admin/ProdutoForm'));
const Estoque = lazy(() => import('./pages/admin/Estoque'));
const Clientes = lazy(() => import('./pages/admin/Clientes'));
const ClienteDetalhe = lazy(() => import('./pages/admin/ClienteDetalhe'));
const PDV = lazy(() => import('./pages/admin/PDV'));
const Vendas = lazy(() => import('./pages/admin/Vendas'));
const VendaDetalhe = lazy(() => import('./pages/admin/VendaDetalhe'));
const Caixa = lazy(() => import('./pages/admin/Caixa'));
const OrdensServico = lazy(() => import('./pages/admin/OrdensServico'));
const OSDetalhe = lazy(() => import('./pages/admin/OSDetalhe'));
const Crediario = lazy(() => import('./pages/admin/Crediario'));
const Agendamentos = lazy(() => import('./pages/admin/Agendamentos'));
const Configuracoes = lazy(() => import('./pages/admin/Configuracoes'));
const ImportarProdutos = lazy(() => import('./pages/admin/ImportarProdutos'));
const Precos = lazy(() => import('./pages/admin/Precos'));
const Etiquetas = lazy(() => import('./pages/admin/Etiquetas'));
const Equipe = lazy(() => import('./pages/admin/Equipe'));
const Auditoria = lazy(() => import('./pages/admin/Auditoria'));

function RolarParaTopo() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

function Carregando() {
  return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Carregando…</div>;
}

function Protegido({ children }) {
  const { usuario, carregando } = useAuth();
  const location = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/admin/login" replace state={{ de: location.pathname }} />;
  return children;
}

// Bloqueia a página quando o perfil não tem nenhuma das permissões pedidas
function Acesso({ p, children }) {
  const { pode } = useAuth();
  if (pode(...p)) return children;
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center">
      <p className="font-display text-xl text-ink">Sem acesso</p>
      <p className="mt-2 text-sm text-slate-500">
        Seu perfil não tem permissão para esta tela. Se precisar, peça ao administrador para liberar.
      </p>
    </div>
  );
}
const r = (p, el) => <Acesso p={p}>{el}</Acesso>;

export default function App() {
  return (
    <>
      <RolarParaTopo />
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Home />} />
            <Route path="catalogo" element={<Catalogo />} />
            <Route path="catalogo/:categoria" element={<Catalogo />} />
            <Route path="produto/:slug" element={<Produto />} />
            <Route path="agendar-exame" element={<Agendar />} />
          </Route>

          <Route path="admin/login" element={<Login />} />
          <Route
            path="admin"
            element={
              <Protegido>
                <AdminLayout />
              </Protegido>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="pdv" element={r(['vendas.criar'], <PDV />)} />
            <Route path="vendas" element={r(['vendas.ver'], <Vendas />)} />
            <Route path="vendas/:id" element={r(['vendas.ver', 'vendas.criar'], <VendaDetalhe />)} />
            <Route path="caixa" element={r(['caixa.operar', 'relatorios.financeiro'], <Caixa />)} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="produtos/novo" element={r(['produtos.editar'], <ProdutoForm />)} />
            <Route path="produtos/importar" element={r(['produtos.importar'], <ImportarProdutos />)} />
            <Route path="precos" element={r(['precos.massa'], <Precos />)} />
            <Route path="etiquetas" element={r(['etiquetas.imprimir'], <Etiquetas />)} />
            <Route path="produtos/:id" element={<ProdutoForm />} />
            <Route path="estoque" element={r(['estoque.movimentar'], <Estoque />)} />
            <Route path="clientes" element={r(['clientes.gerenciar', 'vendas.criar'], <Clientes />)} />
            <Route path="clientes/:id" element={r(['clientes.gerenciar', 'vendas.criar'], <ClienteDetalhe />)} />
            <Route path="os" element={r(['os.gerenciar'], <OrdensServico />)} />
            <Route path="os/:id" element={r(['os.gerenciar'], <OSDetalhe />)} />
            <Route path="crediario" element={r(['crediario.receber', 'relatorios.financeiro'], <Crediario />)} />
            <Route path="agendamentos" element={r(['agendamentos.gerenciar'], <Agendamentos />)} />
            <Route path="configuracoes" element={r(['config.loja'], <Configuracoes />)} />
            <Route path="equipe" element={r(['usuarios.gerenciar'], <Equipe />)} />
            <Route path="auditoria" element={r(['auditoria.ver'], <Auditoria />)} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
