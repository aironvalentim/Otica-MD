const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api';
const CHAVE_TOKEN = 'oticamd_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(CHAVE_TOKEN);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      if (t) localStorage.setItem(CHAVE_TOKEN, t);
      else localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* navegador sem storage */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, detalhes) {
    super(message);
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function request(method, path, body) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  const isForm = body instanceof FormData;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') {
      tokenStore.set(null);
      window.dispatchEvent(new Event('oticamd:logout'));
    }
    const detalhe = Array.isArray(data.detalhes) ? data.detalhes.map((d) => `${d.campo}: ${d.erro}`).join('; ') : '';
    throw new ApiError(res.status, [data.erro || 'Erro inesperado', detalhe].filter(Boolean).join(' — '), data.detalhes);
  }
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b ?? {}),
  put: (p, b) => request('PUT', p, b),
  del: (p) => request('DELETE', p),
  // Envia um arquivo único num campo específico (ex.: planilha de importação)
  enviarArquivo: (p, campo, arquivo) => {
    const fd = new FormData();
    fd.append(campo, arquivo);
    return request('POST', p, fd);
  },
  // Baixa um arquivo autenticado e dispara o download no navegador
  baixar: async (p, nomeArquivo) => {
    const token = tokenStore.get();
    const res = await fetch(BASE + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, 'Não foi possível baixar o arquivo');
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  upload: (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('arquivos', f));
    return request('POST', '/upload', fd);
  },
};

// Monta query string ignorando valores vazios
export function qs(params) {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false)).toString();
  return s ? `?${s}` : '';
}
