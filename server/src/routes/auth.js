const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { ah, parse, z, HttpError } = require('../util');
const { assinarToken, autenticar } = require('../auth');

const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, message: { erro: 'Muitas tentativas. Tente em 15 minutos' } });

router.post(
  '/login',
  limiteLogin,
  ah(async (req, res) => {
    const { email, senha } = parse(z.object({ email: z.string().trim().toLowerCase().email(), senha: z.string().min(1) }), req.body);
    const { rows } = await query('select * from usuarios where email = $1 and ativo', [email]);
    const usuario = rows[0];
    if (!usuario || !(await bcrypt.compare(senha, usuario.senha_hash))) {
      throw new HttpError(401, 'E-mail ou senha incorretos');
    }
    res.json({
      token: assinarToken(usuario),
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel },
    });
  })
);

router.get(
  '/me',
  autenticar,
  ah(async (req, res) => {
    const { rows } = await query('select id, nome, email, papel from usuarios where id = $1 and ativo', [req.usuario.id]);
    if (!rows[0]) throw new HttpError(401, 'Usuário desativado');
    res.json(rows[0]);
  })
);

module.exports = router;
