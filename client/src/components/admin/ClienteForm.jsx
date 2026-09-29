import { useState } from 'react';
import { api } from '../../lib/api';
import { Botao, Campo, Erro } from './ui';

const VAZIO = { nome: '', cpf: '', telefone: '', email: '', data_nascimento: '', endereco: '', bairro: '', cidade: 'Vitória de Santo Antão', observacoes: '' };

export default function ClienteForm({ inicial, onSalvo }) {
  const [f, setF] = useState({ ...VAZIO, ...Object.fromEntries(Object.entries(inicial || {}).filter(([k]) => k in VAZIO).map(([k, v]) => [k, v ?? ''])) });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function salvar(e) {
    e.preventDefault();
    e.stopPropagation();
    setErro('');
    setSalvando(true);
    try {
      const c = inicial?.id ? await api.put(`/clientes/${inicial.id}`, f) : await api.post('/clientes', f);
      onSalvo(c);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
      <Campo label="Nome completo *" className="sm:col-span-2">
        <input required autoFocus value={f.nome} onChange={set('nome')} className="campo" />
      </Campo>
      <Campo label="WhatsApp">
        <input type="tel" value={f.telefone} onChange={set('telefone')} className="campo" placeholder="(81) 9 0000-0000" />
      </Campo>
      <Campo label="CPF" dica="Obrigatório para crediário">
        <input value={f.cpf} onChange={set('cpf')} className="campo" />
      </Campo>
      <Campo label="Nascimento">
        <input type="date" value={f.data_nascimento} onChange={set('data_nascimento')} className="campo" />
      </Campo>
      <Campo label="E-mail">
        <input type="email" value={f.email} onChange={set('email')} className="campo" />
      </Campo>
      <Campo label="Endereço" className="sm:col-span-2">
        <input value={f.endereco} onChange={set('endereco')} className="campo" />
      </Campo>
      <Campo label="Bairro">
        <input value={f.bairro} onChange={set('bairro')} className="campo" />
      </Campo>
      <Campo label="Cidade">
        <input value={f.cidade} onChange={set('cidade')} className="campo" />
      </Campo>
      <Campo label="Observações" className="sm:col-span-2">
        <textarea rows={2} value={f.observacoes} onChange={set('observacoes')} className="campo" />
      </Campo>
      <div className="sm:col-span-2">
        <Erro>{erro}</Erro>
        <Botao type="submit" carregando={salvando} className="mt-2 w-full">
          Salvar cliente
        </Botao>
      </div>
    </form>
  );
}
