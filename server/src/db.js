const { Pool, types } = require('pg');

// numeric -> number (valores monetários cabem com folga em double)
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
// date -> string 'YYYY-MM-DD' (evita deslocamento de fuso)
types.setTypeParser(1082, (v) => v);
// bigint (count) -> number
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  max: 10,
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do Postgres:', err.message);
});

async function query(text, params) {
  return pool.query(text, params);
}

// Executa fn(client) dentro de uma transação. Qualquer erro desfaz tudo.
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
