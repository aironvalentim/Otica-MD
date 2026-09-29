import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Botao, Campo, Erro } from '../../components/admin/ui';

export default function Login() {
  const { usuario, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (usuario) return <Navigate to={location.state?.de || '/admin'} replace />;

  async function entrar(e) {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await login(email, senha);
      navigate(location.state?.de || '/admin', { replace: true });
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="font-display text-3xl font-semibold">
          Ótica <span className="text-gold-dark">MD</span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">Acesso da equipe</p>
        <div className="mt-6 space-y-4">
          <Campo label="E-mail">
            <input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} className="campo" />
          </Campo>
          <Campo label="Senha">
            <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)} className="campo" />
          </Campo>
          <Erro>{erro}</Erro>
          <Botao type="submit" carregando={carregando} className="w-full" tamanho="lg">
            Entrar
          </Botao>
        </div>
      </form>
    </div>
  );
}
