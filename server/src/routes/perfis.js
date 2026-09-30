const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z, zId, HttpError } = require('../util');
const { exigir } = require('../auth');
const { CATALOGO, TODAS } = require('../permissoes');
const { registrar } = require('../auditoria');

// Catálogo de permissões (para montar a tabela de perfis no painel)
router.get('/permissoes', exigir('usuarios.gerenciar'), (_req, res) => res.json(CATALOGO));

router.get(
  '/',
  exigir('usuarios.gerenciar'),
  ah(async (_req, res) => {
    const { rows } = await query(
      `select p.*, (select count(*)::int from usuarios u where u.perfil_id = p.id and u.ativo) as usuarios_ativos
         from perfis p order by p.sistema desc, p.nome`
    );
    res.json(rows);
  })
);

const schema = z.object({
  nome: z.string().trim().min(2).max(40),
  descricao: z.string().trim().max(200).nullable().optional(),
  permissoes: z.array(z.string()).refine((l) => l.every((p) => TODAS.includes(p)), 'Permissão desconhecida'),
  desconto_max_pct: z.coerce.number().min(0).max(100).default(0),
});

function normalizar(d) {
  const set = new Set(d.permissoes);
  // Importar planilha mostra custos, então exige também ver custos
  if (set.has('produtos.importar')) set.add('custos.ver');
  return { ...d, permissoes: [...set] };
}

router.post(
  '/',
  exigir('usuarios.gerenciar'),
  ah(async (req, res) => {
    const d = normalizar(parse(schema, req.body));
    const { rows } = await query(
      'insert into perfis (nome, descricao, permissoes, desconto_max_pct) values ($1,$2,$3,$4) returning *',
      [d.nome, d.descricao ?? null, JSON.stringify(d.permissoes), d.desconto_max_pct]
    );
    await registrar({ query }, req, 'perfil_criado', { entidade: 'perfil', entidadeId: rows[0].id, detalhes: d });
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  exigir('usuarios.gerenciar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows: atual } = await query('select * from perfis where id = $1', [id]);
    if (!atual[0]) throw new HttpError(404, 'Perfil não encontrado');
    if (atual[0].sistema) throw new HttpError(400, 'O perfil Administrador tem acesso total e não pode ser alterado');
    const d = normalizar(parse(schema, req.body));
    const { rows } = await query(
      'update perfis set nome = $1, descricao = $2, permissoes = $3, desconto_max_pct = $4 where id = $5 returning *',
      [d.nome, d.descricao ?? null, JSON.stringify(d.permissoes), d.desconto_max_pct, id]
    );
    const adicionadas = d.permissoes.filter((p) => !atual[0].permissoes.includes(p));
    const removidas = atual[0].permissoes.filter((p) => !d.permissoes.includes(p));
    await registrar({ query }, req, 'perfil_alterado', {
      entidade: 'perfil',
      entidadeId: id,
      detalhes: {
        perfil: d.nome,
        adicionadas,
        removidas,
        ...(Number(atual[0].desconto_max_pct) !== d.desconto_max_pct ? { desconto_max_pct: `${atual[0].desconto_max_pct} → ${d.desconto_max_pct}` } : {}),
      },
    });
    res.json(rows[0]);
  })
);

router.delete(
  '/:id',
  exigir('usuarios.gerenciar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query('select p.*, (select count(*)::int from usuarios u where u.perfil_id = p.id) as usuarios from perfis p where id = $1', [id]);
    if (!rows[0]) throw new HttpError(404, 'Perfil não encontrado');
    if (rows[0].sistema) throw new HttpError(400, 'O perfil Administrador não pode ser excluído');
    if (rows[0].usuarios > 0) throw new HttpError(409, `Há ${rows[0].usuarios} usuário(s) com este perfil. Mude o perfil deles antes de excluir`);
    await query('delete from perfis where id = $1', [id]);
    await registrar({ query }, req, 'perfil_excluido', { entidade: 'perfil', entidadeId: id, detalhes: { perfil: rows[0].nome } });
    res.status(204).end();
  })
);

module.exports = router;
