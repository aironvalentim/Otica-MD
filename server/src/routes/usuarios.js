const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../db');
const { ah, parse, z, zId, HttpError } = require('../util');
const { exigir } = require('../auth');
const { registrar } = require('../auditoria');

router.use(exigir('usuarios.gerenciar'));

const SELECT = `select u.id, u.nome, u.email, u.ativo, u.criado_em, u.ultimo_acesso, u.perfil_id,
                       p.nome as perfil_nome, p.sistema as perfil_sistema
                  from usuarios u left join perfis p on p.id = u.perfil_id`;

router.get(
  '/',
  ah(async (_req, res) => {
    const { rows } = await query(`${SELECT} order by u.ativo desc, u.nome`);
    res.json(rows);
  })
);

const schema = z.object({
  nome: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  perfil_id: zId,
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').optional(),
  ativo: z.boolean().optional(),
});

// Garante que sempre sobra pelo menos um administrador ativo
async function garantirAdministrador(client) {
  const { rows } = await client.query(
    `select count(*)::int as n from usuarios u join perfis p on p.id = u.perfil_id where u.ativo and p.sistema`
  );
  if (rows[0].n < 1) throw new HttpError(400, 'O sistema precisa de pelo menos um usuário ativo com o perfil Administrador');
}

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, req.body);
    if (!d.senha) throw new HttpError(400, 'Informe uma senha inicial');
    const { rows: perfil } = await query('select id, nome from perfis where id = $1', [d.perfil_id]);
    if (!perfil[0]) throw new HttpError(400, 'Perfil não encontrado');
    const { rows } = await query(
      `insert into usuarios (nome, email, perfil_id, senha_hash, papel) values ($1,$2,$3,$4,'vendedor') returning id`,
      [d.nome, d.email, d.perfil_id, await bcrypt.hash(d.senha, 10)]
    );
    await registrar({ query }, req, 'usuario_criado', {
      entidade: 'usuario',
      entidadeId: rows[0].id,
      detalhes: { nome: d.nome, email: d.email, perfil: perfil[0].nome },
    });
    const { rows: u } = await query(`${SELECT} where u.id = $1`, [rows[0].id]);
    res.status(201).json(u[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), req.body);
    if (id === req.usuario.id && d.ativo === false) throw new HttpError(400, 'Você não pode desativar o próprio usuário');

    const usuario = await transaction(async (client) => {
      const { rows: antes } = await client.query(`${SELECT} where u.id = $1 for update of u`, [id]);
      if (!antes[0]) throw new HttpError(404, 'Usuário não encontrado');
      const campos = [];
      const valores = [];
      for (const k of ['nome', 'email', 'perfil_id', 'ativo']) {
        if (d[k] !== undefined) {
          valores.push(d[k]);
          campos.push(`${k} = $${valores.length}`);
        }
      }
      if (d.senha) {
        valores.push(await bcrypt.hash(d.senha, 10));
        campos.push(`senha_hash = $${valores.length}`);
      }
      if (!campos.length) throw new HttpError(400, 'Nada para atualizar');
      valores.push(id);
      await client.query(`update usuarios set ${campos.join(', ')} where id = $${valores.length}`, valores);
      await garantirAdministrador(client);
      const { rows: depois } = await client.query(`${SELECT} where u.id = $1`, [id]);

      const mudou = {};
      if (d.perfil_id !== undefined && d.perfil_id !== antes[0].perfil_id) mudou.perfil = `${antes[0].perfil_nome} → ${depois[0].perfil_nome}`;
      if (d.ativo !== undefined && d.ativo !== antes[0].ativo) mudou.ativo = d.ativo;
      if (d.nome && d.nome !== antes[0].nome) mudou.nome = d.nome;
      if (d.email && d.email !== antes[0].email) mudou.email = d.email;
      if (d.senha) mudou.senha = 'redefinida';
      await registrar(client, req, 'usuario_alterado', { entidade: 'usuario', entidadeId: id, detalhes: { usuario: depois[0].nome, ...mudou } });
      return depois[0];
    });
    res.json(usuario);
  })
);

module.exports = router;
