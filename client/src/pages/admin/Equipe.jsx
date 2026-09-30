import { useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { dataHora } from '../../lib/format';
import { Botao, Cabecalho, Campo, Cartao, Erro, Etiqueta, Modal, Tabela, useToast } from '../../components/admin/ui';

// ---------------------------------------------------------------------
// Usuários
// ---------------------------------------------------------------------
function FormUsuario({ inicial, perfis, souEu, onSalvo }) {
  const [f, setF] = useState({
    nome: inicial?.nome || '',
    email: inicial?.email || '',
    perfil_id: inicial?.perfil_id || perfis.find((p) => !p.sistema)?.id || perfis[0]?.id || '',
    senha: '',
    ativo: inicial?.ativo ?? true,
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const perfil = perfis.find((p) => p.id === Number(f.perfil_id));

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    const corpo = { ...f, perfil_id: Number(f.perfil_id) };
    if (!corpo.senha) delete corpo.senha;
    try {
      if (inicial) await api.put(`/usuarios/${inicial.id}`, corpo);
      else await api.post('/usuarios', corpo);
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <form onSubmit={salvar} className="space-y-4">
      <Campo label="Nome">
        <input required value={f.nome} onChange={set('nome')} className="campo" />
      </Campo>
      <Campo label="E-mail (usado para entrar)">
        <input required type="email" value={f.email} onChange={set('email')} className="campo" />
      </Campo>
      <Campo
        label="Perfil de acesso"
        dica={
          perfil &&
          (perfil.sistema
            ? 'Acesso total ao sistema'
            : `${perfil.permissoes.length} permissões · desconto até ${Number(perfil.desconto_max_pct)}%`)
        }
      >
        <select value={f.perfil_id} onChange={set('perfil_id')} className="campo">
          {perfis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo
        label={inicial ? 'Nova senha (deixe vazio para manter a atual)' : 'Senha inicial (mínimo 8 caracteres)'}
        dica="A pessoa pode trocar depois em “Minha senha”"
      >
        <input
          type="password"
          autoComplete="new-password"
          required={!inicial}
          minLength={8}
          value={f.senha}
          onChange={set('senha')}
          className="campo"
        />
      </Campo>
      {inicial && !souEu && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} /> Ativo (desmarque para
          bloquear o acesso na hora)
        </label>
      )}
      <Erro>{erro}</Erro>
      <Botao type="submit" carregando={salvando} className="w-full">
        Salvar
      </Botao>
    </form>
  );
}

function Usuarios({ perfis, onMudou }) {
  const avisar = useToast();
  const { usuario } = useAuth();
  const { dados, recarregar } = useApi('/usuarios');
  const [editar, setEditar] = useState(null);

  return (
    <Cartao
      titulo="Usuários"
      semPadding
      acoes={
        <Botao tamanho="sm" variante="secundario" onClick={() => setEditar({})} disabled={!perfis}>
          <Plus size={14} /> Usuário
        </Botao>
      }
    >
      <Tabela
        linhas={dados}
        onLinha={setEditar}
        colunas={[
          {
            titulo: 'Nome',
            render: (u) => (
              <span className={u.ativo ? '' : 'text-slate-400'}>
                {u.nome} {u.id === usuario.id && <span className="text-xs text-slate-400">(você)</span>}
              </span>
            ),
          },
          { titulo: 'E-mail', render: (u) => <span className="text-slate-600">{u.email}</span> },
          { titulo: 'Perfil', render: (u) => <Etiqueta cor={u.perfil_sistema ? 'gold' : 'slate'}>{u.perfil_nome || '—'}</Etiqueta> },
          {
            titulo: 'Último acesso',
            render: (u) => (
              <span className="whitespace-nowrap text-slate-600">{u.ultimo_acesso ? dataHora(u.ultimo_acesso) : 'Nunca entrou'}</span>
            ),
          },
          {
            titulo: 'Situação',
            render: (u) => (u.ativo ? <Etiqueta cor="green">Ativo</Etiqueta> : <Etiqueta cor="zinc">Bloqueado</Etiqueta>),
          },
          { titulo: '', direita: true, render: () => <Pencil size={15} className="inline text-slate-400" /> },
        ]}
      />
      <Modal aberto={!!editar} onFechar={() => setEditar(null)} titulo={editar?.id ? 'Editar usuário' : 'Novo usuário'}>
        {editar && perfis && (
          <FormUsuario
            inicial={editar.id ? editar : null}
            perfis={perfis}
            souEu={editar.id === usuario.id}
            onSalvo={() => {
              setEditar(null);
              avisar('Usuário salvo');
              recarregar();
              onMudou();
            }}
          />
        )}
      </Modal>
    </Cartao>
  );
}

// ---------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------
function FormPerfil({ inicial, catalogo, perfis, onSalvo, onExcluido }) {
  const [f, setF] = useState({
    nome: inicial?.nome || '',
    descricao: inicial?.descricao || '',
    desconto_max_pct: inicial ? Number(inicial.desconto_max_pct) : 5,
    permissoes: new Set(inicial?.permissoes || ['vendas.criar', 'vendas.ver', 'caixa.operar', 'clientes.gerenciar']),
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const marcar = (chave, sim) => {
    const s = new Set(f.permissoes);
    if (sim) s.add(chave);
    else s.delete(chave);
    // Importar planilha mostra custos
    if (chave === 'produtos.importar' && sim) s.add('custos.ver');
    if (chave === 'custos.ver' && !sim) s.delete('produtos.importar');
    setF({ ...f, permissoes: s });
  };
  const marcarGrupo = (g, sim) => {
    const s = new Set(f.permissoes);
    g.itens.forEach((i) => (sim ? s.add(i.chave) : s.delete(i.chave)));
    if (s.has('produtos.importar')) s.add('custos.ver');
    setF({ ...f, permissoes: s });
  };
  const copiarDe = (id) => {
    const p = perfis.find((x) => x.id === Number(id));
    if (p) setF({ ...f, permissoes: new Set(p.permissoes), desconto_max_pct: Number(p.desconto_max_pct) });
  };

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    const corpo = {
      nome: f.nome,
      descricao: f.descricao || null,
      desconto_max_pct: Number(f.desconto_max_pct) || 0,
      permissoes: [...f.permissoes],
    };
    try {
      if (inicial) await api.put(`/perfis/${inicial.id}`, corpo);
      else await api.post('/perfis', corpo);
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!window.confirm(`Excluir o perfil “${inicial.nome}”?`)) return;
    try {
      await api.del(`/perfis/${inicial.id}`);
      onExcluido();
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Nome do perfil">
          <input
            required
            minLength={2}
            maxLength={40}
            value={f.nome}
            onChange={(e) => setF({ ...f, nome: e.target.value })}
            className="campo"
            placeholder="Ex.: Gerente, Caixa, Optometrista"
          />
        </Campo>
        <Campo label="Desconto máximo no PDV (%)" dica="Acima disso, a venda precisa de alguém com limite maior">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={f.desconto_max_pct}
            onChange={(e) => setF({ ...f, desconto_max_pct: e.target.value })}
            className="campo"
          />
        </Campo>
        <Campo label="Descrição (opcional)" className="sm:col-span-2">
          <input maxLength={200} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} className="campo" />
        </Campo>
        {!inicial && perfis.length > 0 && (
          <Campo label="Começar com as permissões de" className="sm:col-span-2">
            <select defaultValue="" onChange={(e) => copiarDe(e.target.value)} className="campo">
              <option value="">—</option>
              {perfis
                .filter((p) => !p.sistema)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
            </select>
          </Campo>
        )}
      </div>

      <div className="space-y-4">
        {catalogo.map((g) => {
          const todas = g.itens.every((i) => f.permissoes.has(i.chave));
          return (
            <fieldset key={g.grupo} className="rounded-lg border border-slate-200">
              <legend className="ml-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.grupo}</legend>
              <div className="flex justify-end px-3 pt-1">
                <button type="button" onClick={() => marcarGrupo(g, !todas)} className="text-xs text-slate-500 hover:text-ink">
                  {todas ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {g.itens.map((i) => (
                  <label key={i.chave} className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={f.permissoes.has(i.chave)}
                      onChange={(e) => marcar(i.chave, e.target.checked)}
                    />
                    <span>
                      <span className="block text-sm font-medium text-ink">{i.nome}</span>
                      <span className="block text-xs text-slate-500">{i.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      <Erro>{erro}</Erro>
      <div className="flex flex-wrap gap-2">
        <Botao type="submit" carregando={salvando} className="flex-1">
          Salvar perfil
        </Botao>
        {inicial && (
          <Botao type="button" variante="secundario" onClick={excluir} className="text-red-600">
            <Trash2 size={15} /> Excluir
          </Botao>
        )}
      </div>
    </form>
  );
}

function Perfis({ perfis, catalogo, recarregar }) {
  const avisar = useToast();
  const [editar, setEditar] = useState(null);
  const total = catalogo?.reduce((s, g) => s + g.itens.length, 0) || 0;

  return (
    <Cartao
      titulo="Perfis de acesso"
      acoes={
        <Botao tamanho="sm" variante="secundario" onClick={() => setEditar({})} disabled={!catalogo}>
          <Plus size={14} /> Perfil
        </Botao>
      }
    >
      {!perfis ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {perfis.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => !p.sistema && setEditar(p)}
              className={`rounded-lg border p-4 text-left transition ${p.sistema ? 'cursor-default border-amber-200 bg-amber-50/50' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-ink">
                  {p.sistema ? <ShieldCheck size={16} className="text-amber-700" /> : null}
                  {p.nome}
                </span>
                {p.sistema ? <Lock size={14} className="text-slate-400" /> : <Pencil size={14} className="text-slate-400" />}
              </div>
              {p.descricao && <p className="mt-1 text-xs text-slate-500">{p.descricao}</p>}
              <p className="mt-3 text-xs text-slate-600">
                {p.sistema ? 'Acesso total' : `${p.permissoes.length} de ${total} permissões`} · desconto até {Number(p.desconto_max_pct)}%
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {p.usuarios_ativos} usuário{p.usuarios_ativos === 1 ? '' : 's'} ativo{p.usuarios_ativos === 1 ? '' : 's'}
              </p>
            </button>
          ))}
        </div>
      )}
      <Modal
        aberto={!!editar}
        onFechar={() => setEditar(null)}
        titulo={editar?.id ? `Perfil: ${editar.nome}` : 'Novo perfil'}
        largura="max-w-2xl"
      >
        {editar && catalogo && (
          <FormPerfil
            inicial={editar.id ? editar : null}
            catalogo={catalogo}
            perfis={perfis}
            onSalvo={() => {
              setEditar(null);
              avisar('Perfil salvo. Vale para os usuários na próxima ação que fizerem');
              recarregar();
            }}
            onExcluido={() => {
              setEditar(null);
              avisar('Perfil excluído');
              recarregar();
            }}
          />
        )}
      </Modal>
    </Cartao>
  );
}

export default function Equipe() {
  const { dados: perfis, recarregar } = useApi('/perfis');
  const { dados: catalogo } = useApi('/perfis/permissoes');
  return (
    <>
      <Cabecalho
        titulo="Equipe e perfis"
        subtitulo="Cada pessoa entra com o próprio e-mail e senha. O perfil define o que ela pode ver e fazer."
      />
      <div className="space-y-6">
        <Usuarios perfis={perfis} onMudou={recarregar} />
        <Perfis perfis={perfis} catalogo={catalogo} recarregar={recarregar} />
      </div>
    </>
  );
}
