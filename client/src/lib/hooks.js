import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

// Carrega dados de um endpoint; recarrega quando `path` muda
export function useApi(path) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const atual = useRef(path);

  const recarregar = useCallback(async () => {
    if (!path) return;
    atual.current = path;
    setCarregando(true);
    try {
      const d = await api.get(path);
      if (atual.current === path) {
        setDados(d);
        setErro(null);
      }
    } catch (e) {
      if (atual.current === path) setErro(e.message);
    } finally {
      if (atual.current === path) setCarregando(false);
    }
  }, [path]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { dados, erro, carregando, recarregar, setDados };
}

export function useDebounce(valor, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

// Config pública da loja (WhatsApp, endereço...) com cache em memória
let cacheConfig = null;
export function useLojaConfig() {
  const [cfg, setCfg] = useState(cacheConfig || {});
  useEffect(() => {
    if (cacheConfig) return;
    api
      .get('/publico/config')
      .then((c) => {
        cacheConfig = c;
        setCfg(c);
      })
      .catch(() => {});
  }, []);
  return cfg;
}
