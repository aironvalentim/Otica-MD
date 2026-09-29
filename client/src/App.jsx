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
            <Route path="pdv" element={<PDV />} />
            <Route path="vendas" element={<Vendas />} />
            <Route path="vendas/:id" element={<VendaDetalhe />} />
            <Route path="caixa" element={<Caixa />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="produtos/novo" element={<ProdutoForm />} />
            <Route path="produtos/importar" element={<ImportarProdutos />} />
            <Route path="precos" element={<Precos />} />
            <Route path="etiquetas" element={<Etiquetas />} />
            <Route path="produtos/:id" element={<ProdutoForm />} />
            <Route path="estoque" element={<Estoque />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalhe />} />
            <Route path="os" element={<OrdensServico />} />
            <Route path="os/:id" element={<OSDetalhe />} />
            <Route path="crediario" element={<Crediario />} />
            <Route path="agendamentos" element={<Agendamentos />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
