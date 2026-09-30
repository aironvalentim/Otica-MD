// Cria/atualiza as tabelas e o primeiro usuário administrador.
// Uso: npm run db:setup  (lê DATABASE_URL e ADMIN_* do .env). Pode rodar quantas vezes quiser.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Tabelas criadas/atualizadas.');

  const { ADMIN_NOME = 'Administrador', ADMIN_EMAIL, ADMIN_SENHA } = process.env;
  if (ADMIN_EMAIL && ADMIN_SENHA) {
    if (ADMIN_SENHA.length < 8) throw new Error('ADMIN_SENHA precisa de pelo menos 8 caracteres');
    const { rows } = await pool.query('select id from usuarios where email = $1', [ADMIN_EMAIL.toLowerCase()]);
    if (rows[0]) {
      console.log(`Usuário ${ADMIN_EMAIL} já existe.`);
    } else {
      await pool.query(
        `insert into usuarios (nome, email, senha_hash, papel, perfil_id)
         values ($1, $2, $3, 'admin', (select id from perfis where nome = 'Administrador'))`,
        [ADMIN_NOME, ADMIN_EMAIL.toLowerCase(), await bcrypt.hash(ADMIN_SENHA, 10)]
      );
      console.log(`Administrador ${ADMIN_EMAIL} criado.`);
    }
  } else {
    console.log('ADMIN_EMAIL/ADMIN_SENHA não definidos: nenhum usuário criado.');
  }
  await pool.end();
})().catch(async (err) => {
  console.error('Erro:', err.message);
  await pool.end();
  process.exit(1);
});
