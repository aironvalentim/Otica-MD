import { useEffect, useState } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { telefone, CATEGORIAS, moeda } from '../../lib/format';
import { ARREDONDAMENTOS, arredondar } from '../../lib/precos';
import { Botao, Cabecalho, Campo, Cartao, Erro, Etiqueta, Modal, Tabela, useToast } from '../../components/admin/ui';

const CAMPOS_LOJA = [
  ['loja_nome', 'Nome da loja'],
  ['loja_whatsapp', 'WhatsApp (com DDI e DDD, só números)', '5581999999999'],
  ['loja_endereco', 'Endereço completo'],
  ['loja_horario', 'Horário de funcionamento'],
  ['loja_instagram', 'Instagram (sem @)'],
];

function DadosLoja() {
  const avisar = useToast();
  const { dados } = useApi('/configuracoes');
  const [f, setF] = useState({});
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (dados) setF(dados);
  }, [dados]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.put('/configuracoes', Object.fromEntries(CAMPOS_LOJA.map(([k]) => [k, f[k] || ''])));
      avisar('Dados da loja salvos. O site já mostra as novas informações.');
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao titulo="Dados da loja (aparecem no site)">
      <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_LOJA.map(([k, l, ph]) => (
          <Campo key={k} label={l} className={k === 'loja_endereco' ? 'sm:col-span-2' : ''}>
            <input value={f[k] || ''} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="campo" />
          </Campo>
        ))}
        <div className="sm:col-span-2">
          <Botao type="submit" carregando={salvando}>
            Salvar
          </Botao>
        </div>
      </form>
    </Cartao>
  );
}

function Precificacao() {
  const avisar = useToast();
  const { dados } = useApi('/configuracoes');
  const [f, setF] = useState(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => {
    if (dados) setF(dados);
  }, [dados]);
  if (!f) return null;

  const chaves = Object.keys(CATEGORIAS).map((c) => `markup_${c}`);
  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const corpo = Object.fromEntries(chaves.map((k) => [k, String(f[k] ?? '').replace(',', '.')]));
      corpo.preco_arredondamento = f.preco_arredondamento || 'x90';
      await api.put('/configuracoes', corpo);
      avisar('Regras de preço salvas');
    } catch (err) {
      avisar(err.message, 'erro');
    } finally {
      setSalvando(false);
    }
  }
  const exemploCusto = 100;
  const mArm = parseFloat(String(f.markup_armacao || '').replace(',', '.')) || 0;

  return (
    <Cartao titulo="Precificação (preço sugerido)">
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-slate-600">
          O <strong>markup</strong> é quantas vezes o custo vira preço de venda. Ele é usado para sugerir o preço no cadastro, na importação
          por planilha e no reajuste em massa. Defina conforme os preços da concorrência.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.entries(CATEGORIAS).map(([c, l]) => {
            const m = parseFloat(String(f[`markup_${c}`] || '').replace(',', '.'));
            return (
              <Campo key={c} label={`${l} (× custo)`} dica={m > 0 ? `margem de ${Math.round((1 - 1 / m) * 100)}% sobre a venda` : ''}>
                <input
                  type="number"
                  step="0.05"
                  min="1"
                  value={f[`markup_${c}`] ?? ''}
                  onChange={(e) => setF({ ...f, [`markup_${c}`]: e.target.value })}
                  className="campo"
                />
              </Campo>
            );
          })}
        </div>
        <Campo label="Arredondamento do preço" className="max-w-sm">
          <select value={f.preco_arredondamento || 'x90'} onChange={(e) => setF({ ...f, preco_arredondamento: e.target.value })} className="campo">
            {Object.entries(ARREDONDAMENTOS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        {mArm > 0 && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm">
            Exemplo: armação com custo de {moeda(exemploCusto)} → sugerido{' '}
            <strong>{moeda(arredondar(exemploCusto * mArm, f.preco_arredondamento || 'x90'))}</strong>
          </p>
        )}
        <Botao type="submit" carregando={salvando}>
          Salvar regras
        </Botao>
      </form>
    </Cartao>
  );
}

function FormUsuario({ inicial, onSalvo }) {
  const [f, setF] = useState({ nome: inicial?.nome || '', email: inicial?.email || '', papel: inicial?.papel || 'vendedor', senha: '', ativo: inicial?.ativo ?? true });
  const [erro, setErro] = useState('');
  async function salvar(e) {
    e.preventDefault();
    setErro('');
    const corpo = { ...f };
    if (!corpo.senha) delete corpo.senha;
    try {
      if (inicial) await api.put(`/usuarios/${inicial.id}`, corpo);
      else await api.post('/usuarios', corpo);
      onSalvo();
    } catch (err) {
      setErro(err.message);
    }
  }
  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo label="Nome">
        <input required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} className="campo" />
      </Campo>
      <Campo label="E-mail">
        <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className="campo" />
      </Campo>
      <Campo label="Perfil" dica="Vendedor não acessa configurações nem cadastro de usuários">
        <select value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })} className="campo">
          <option value="vendedor">Vendedor</option>
          <option value="admin">Administrador</option>
        </select>
      </Campo>
      <Campo label={inicial ? 'Nova senha (deixe vazio para manter)' : 'Senha (mínimo 8 caracteres)'}>
        <input type="password" required={!inicial} minLength={8} value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} className="campo" />
      </Campo>
      {inicial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo
        </label>
      )}
      <Erro>{erro}</Erro>
      <Botao type="submit" className="w-full">
        Salvar
      </Botao>
    </form>
  );
}

function Usuarios() {
  const avisar = useToast();
  const { dados, recarregar } = useApi('/usuarios');
  const [editar, setEditar] = useState(null);
  return (
    <Cartao
      titulo="Equipe"
      semPadding
      acoes={
        <Botao tamanho="sm" variante="secundario" onClick={() => setEditar({})}>
          <Plus size={14} /> Usuário
        </Botao>
      }
    >
      <Tabela
        linhas={dados}
        colunas={[
          { titulo: 'Nome', campo: 'nome' },
          { titulo: 'E-mail', campo: 'email' },
          { titulo: 'Perfil', render: (u) => <Etiqueta cor={u.papel === 'admin' ? 'gold' : 'slate'}>{u.papel === 'admin' ? 'Administrador' : 'Vendedor'}</Etiqueta> },
          { titulo: 'Situação', render: (u) => (u.ativo ? 'Ativo' : <span className="text-slate-400">Inativo</span>) },
          {
            titulo: '',
            direita: true,
            render: (u) => (
              <button onClick={() => setEditar(u)} className="text-slate-500 hover:text-ink" aria-label="Editar">
                <Pencil size={15} />
              </button>
            ),
          },
        ]}
      />
      <Modal aberto={!!editar} onFechar={() => setEditar(null)} titulo={editar?.id ? 'Editar usuário' : 'Novo usuário'}>
        {editar && (
          <FormUsuario
            inicial={editar.id ? editar : null}
            onSalvo={() => {
              setEditar(null);
              avisar('Usuário salvo');
              recarregar();
            }}
          />
        )}
      </Modal>
    </Cartao>
  );
}

function Fornecedores() {
  const avisar = useToast();
  const { dados, recarregar } = useApi('/fornecedores');
  const [editar, setEditar] = useState(null);
  const [f, setF] = useState({});
  const [erro, setErro] = useState('');

  const abrir = (x) => {
    setErro('');
    setF({ nome: x.nome || '', tipo: x.tipo || 'fornecedor', cnpj: x.cnpj || '', telefone: x.telefone || '', email: x.email || '', observacoes: x.observacoes || '' });
    setEditar(x);
  };

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    try {
      if (editar.id) await api.put(`/fornecedores/${editar.id}`, f);
      else await api.post('/fornecedores', f);
      setEditar(null);
      avisar('Salvo');
      recarregar();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <Cartao
      titulo="Fornecedores e laboratórios"
      semPadding
      acoes={
        <Botao tamanho="sm" variante="secundario" onClick={() => abrir({})}>
          <Plus size={14} /> Cadastrar
        </Botao>
      }
    >
      <Tabela
        linhas={dados}
        onLinha={abrir}
        colunas={[
          { titulo: 'Nome', campo: 'nome' },
          { titulo: 'Tipo', render: (x) => (x.tipo === 'laboratorio' ? 'Laboratório' : 'Fornecedor') },
          { titulo: 'Telefone', render: (x) => telefone(x.telefone) },
          { titulo: 'E-mail', campo: 'email' },
        ]}
      />
      <Modal aberto={!!editar} onFechar={() => setEditar(null)} titulo={editar?.id ? 'Editar' : 'Novo fornecedor ou laboratório'}>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome" className="sm:col-span-2">
            <input required value={f.nome || ''} onChange={(e) => setF({ ...f, nome: e.target.value })} className="campo" />
          </Campo>
          <Campo label="Tipo">
            <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })} className="campo">
              <option value="fornecedor">Fornecedor</option>
              <option value="laboratorio">Laboratório</option>
            </select>
          </Campo>
          <Campo label="CNPJ">
            <input value={f.cnpj || ''} onChange={(e) => setF({ ...f, cnpj: e.target.value })} className="campo" />
          </Campo>
          <Campo label="Telefone">
            <input value={f.telefone || ''} onChange={(e) => setF({ ...f, telefone: e.target.value })} className="campo" />
          </Campo>
          <Campo label="E-mail">
            <input type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} className="campo" />
          </Campo>
          <Campo label="Observações" className="sm:col-span-2">
            <input value={f.observacoes || ''} onChange={(e) => setF({ ...f, observacoes: e.target.value })} className="campo" />
          </Campo>
          <div className="sm:col-span-2">
            <Erro>{erro}</Erro>
            <Botao type="submit" className="mt-2 w-full">
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>
    </Cartao>
  );
}

export default function Configuracoes() {
  return (
    <>
      <Cabecalho titulo="Configurações" />
      <div className="space-y-6">
        <DadosLoja />
        <Precificacao />
        <Fornecedores />
        <Usuarios />
      </div>
    </>
  );
}
