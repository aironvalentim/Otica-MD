// Registro de ações importantes (quem, o quê, quando).
// Nunca derruba a operação principal: se o log falhar, só avisa no console.

async function registrar(db, req, acao, { entidade = null, entidadeId = null, detalhes = null } = {}) {
  try {
    await db.query(
      `insert into auditoria (usuario_id, usuario_nome, acao, entidade, entidade_id, detalhes, ip)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req?.usuario?.id ?? null,
        req?.usuario?.nome ?? null,
        acao,
        entidade,
        entidadeId,
        detalhes ? JSON.stringify(detalhes) : null,
        req?.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('Falha ao registrar auditoria:', err.message);
  }
}

module.exports = { registrar };
