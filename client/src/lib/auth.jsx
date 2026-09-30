import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(!!tokenStore.get());

  useEffect(() => {
    if (!tokenStore.get()) return;
    api
      .get('/auth/me')
      .then(setUsuario)
      .catch(() => tokenStore.set(null))
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    const sair = () => setUsuario(null);
    window.addEventListener('oticamd:logout', sair);
    return () => window.removeEventListener('oticamd:logout', sair);
  }, []);

  const login = useCallback(async (email, senha) => {
    const r = await api.post('/auth/login', { email, senha });
    tokenStore.set(r.token);
    setUsuario(r.usuario);
  }, []);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUsuario(null);
  }, []);

  // pode('custos.ver') ou pode('a', 'b') = tem pelo menos uma das permissões
  const pode = useCallback(
    (...chaves) => {
      const lista = usuario?.permissoes || [];
      return lista.includes('*') || chaves.some((c) => lista.includes(c));
    },
    [usuario],
  );

  const recarregar = useCallback(
    () =>
      api
        .get('/auth/me')
        .then(setUsuario)
        .catch(() => {}),
    [],
  );

  return <AuthContext.Provider value={{ usuario, carregando, login, logout, pode, recarregar }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
