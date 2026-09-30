const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { ah, parse, z, HttpError } = require('../util');
const { assinarToken, autenticar, carregarUsuario } = require('../auth');
const { registrar } = require('../auditoria');

const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { erro: 'Muitas tentativas. Tente em 15 minutos' } });

router.post(
  '/login',
  limiteLogin,
  ah(async (req, res) => {
    const { email, senha } = parse(z.object({ email: z.string().trim().toLowerCase().email(), senha: z.string().min(1) }), req.body);
    const { rows } = await query('select * from usuarios where email = $1', [email]);
    const u = rows[0];
    const ok = u && (await bcrypt.compare(senha, u.senha_hash));
    if (!ok) {
      await registrar({ query }, { ip: req.ip, usuario: u ? { id: u.id, nome: u.nome } : null }, 'login_falhou', {
        detalhes: { email },
      });
      throw new HttpError(401, 'E-mail ou senha incorretos');
    }
    if (!u.ativo) throw new HttpError(401, 'Usuário desativado. Fale com o administrador');
    const usuario = await carregarUsuario(u.id);
    await query('update usuarios set ultimo_acesso = now() where id = $1', [u.id]);
    await registrar({ query }, { ip: req.ip, usuario }, 'login');
    res.json({ token: assinarToken(usuario), usuario });
  })
);

router.get(
  '/me',
  autenticar,
  ah(async (req, res) => {
    res.json(req.usuario);
  })
);

// Cada pessoa troca a própria senha
router.post(
  '/senha',
  autenticar,
  ah(async (req, res) => {
    const d = parse(
      z.object({ atual: z.string().min(1), nova: z.string().min(8, 'A nova senha precisa de pelo menos 8 caracteres') }),
      req.body
    );
    const { rows } = await query('select senha_hash from usuarios where id = $1', [req.usuario.id]);
    if (!(await bcrypt.compare(d.atual, rows[0].senha_hash))) throw new HttpError(400, 'Senha atual incorreta');
    await query('update usuarios set senha_hash = $1 where id = $2', [await bcrypt.hash(d.nova, 10), req.usuario.id]);
    await registrar({ query }, req, 'senha_alterada', { entidade: 'usuario', entidadeId: req.usuario.id });
    res.json({ ok: true });
  })
);

module.exports = router;
