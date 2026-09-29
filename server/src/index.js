require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { HttpError } = require('./util');
const { autenticar } = require('./auth');

const app = express();

const origens = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origens.includes(origin)) return cb(null, true);
      cb(new HttpError(403, `Origem não permitida: ${origin}`));
    },
  })
);
app.use(express.json({ limit: '1mb' }));

// Fotos salvas localmente (somente quando o Supabase Storage não está configurado)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Rotas públicas (site)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/publico', require('./routes/publico'));

// Rotas do painel (exigem login)
app.use('/api', autenticar);
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/fornecedores', require('./routes/fornecedores'));
app.use('/api/estoque', require('./routes/estoque'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/receitas', require('./routes/receitas'));
app.use('/api/vendas', require('./routes/vendas'));
app.use('/api/caixa', require('./routes/caixa'));
app.use('/api/os', require('./routes/os'));
app.use('/api/crediario', require('./routes/crediario'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/configuracoes', require('./routes/configuracoes'));
app.use('/api/upload', require('./routes/upload'));

app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Rota não encontrada')));

// Tratamento central de erros
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ erro: err.message, detalhes: err.details });
  }
  // Violações de constraint do Postgres
  if (err.code === '23505') return res.status(409).json({ erro: 'Registro duplicado', detalhes: err.detail });
  if (err.code === '23503') return res.status(409).json({ erro: 'Registro está em uso ou referência inválida', detalhes: err.detail });
  if (err.code === '23514') return res.status(400).json({ erro: 'Valor fora do permitido', detalhes: err.constraint });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno no servidor' });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => console.log(`API da Ótica MD rodando na porta ${PORT}`));
}

module.exports = app;
