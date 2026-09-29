-- =====================================================================
-- Ótica MD — schema PostgreSQL
-- Rodar uma vez no SQL Editor do Supabase (ou via `npm run db:setup` no server)
-- =====================================================================

create extension if not exists pgcrypto;

-- "Hoje" e "este mês" sempre no horário de Pernambuco (vale para novas conexões)
do $$ begin
  execute format('alter database %I set timezone to %L', current_database(), 'America/Recife');
end $$;

-- ---------------------------------------------------------------------
-- Usuários do painel
-- ---------------------------------------------------------------------
create table if not exists usuarios (
  id            integer generated always as identity primary key,
  nome          text not null,
  email         text not null unique,
  senha_hash    text not null,
  papel         text not null default 'vendedor' check (papel in ('admin', 'vendedor')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Fornecedores e laboratórios
-- ---------------------------------------------------------------------
create table if not exists fornecedores (
  id            integer generated always as identity primary key,
  nome          text not null,
  tipo          text not null default 'fornecedor' check (tipo in ('fornecedor', 'laboratorio')),
  cnpj          text,
  telefone      text,
  email         text,
  observacoes   text,
  criado_em     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Produtos (armações, óculos de sol, lentes, lentes de contato, acessórios, serviços)
-- ---------------------------------------------------------------------
create table if not exists produtos (
  id              integer generated always as identity primary key,
  sku             text unique,
  nome            text not null,
  slug            text not null unique,
  categoria       text not null check (categoria in ('armacao', 'solar', 'lente', 'lente_contato', 'acessorio', 'servico')),
  marca           text,
  modelo          text,
  cor             text,
  genero          text check (genero in ('feminino', 'masculino', 'unissex', 'infantil')),
  formato         text,            -- redondo, quadrado, retangular, gatinho, aviador, hexagonal, oval
  material        text,            -- acetato, metal, titânio, TR90, misto
  largura_lente   integer,         -- mm
  ponte           integer,         -- mm
  haste           integer,         -- mm
  descricao       text,
  preco_custo     numeric(12,2) not null default 0,
  preco_venda     numeric(12,2) not null default 0,
  preco_promocional numeric(12,2),
  controla_estoque boolean not null default true,
  estoque_atual   integer not null default 0,
  estoque_minimo  integer not null default 0,
  fornecedor_id   integer references fornecedores(id) on delete set null,
  publicado       boolean not null default false,
  destaque        boolean not null default false,
  imagens         jsonb not null default '[]'::jsonb,   -- lista de URLs
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists idx_produtos_categoria on produtos(categoria);
create index if not exists idx_produtos_publicado on produtos(publicado) where publicado;

-- ---------------------------------------------------------------------
-- Movimentações de estoque (toda alteração de estoque passa por aqui)
-- ---------------------------------------------------------------------
create table if not exists movimentacoes_estoque (
  id              integer generated always as identity primary key,
  produto_id      integer not null references produtos(id) on delete cascade,
  tipo            text not null check (tipo in ('entrada', 'saida', 'ajuste')),
  motivo          text not null check (motivo in ('compra', 'venda', 'devolucao_cliente', 'devolucao_fornecedor', 'perda', 'uso_interno', 'inventario', 'cancelamento_venda', 'outro')),
  quantidade      integer not null check (quantidade > 0),
  custo_unitario  numeric(12,2),
  estoque_anterior integer not null,
  estoque_posterior integer not null,
  fornecedor_id   integer references fornecedores(id) on delete set null,
  venda_id        integer,
  documento       text,            -- nº da nota de compra, etc.
  observacao      text,
  usuario_id      integer references usuarios(id) on delete set null,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_mov_produto on movimentacoes_estoque(produto_id, criado_em desc);

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists clientes (
  id              integer generated always as identity primary key,
  nome            text not null,
  cpf             text unique,
  telefone        text,
  email           text,
  data_nascimento date,
  endereco        text,
  bairro          text,
  cidade          text default 'Vitória de Santo Antão',
  observacoes     text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_clientes_nome on clientes using gin (to_tsvector('portuguese', nome));

-- ---------------------------------------------------------------------
-- Receitas ópticas
-- ---------------------------------------------------------------------
create table if not exists receitas (
  id              integer generated always as identity primary key,
  cliente_id      integer not null references clientes(id) on delete cascade,
  medico          text,
  crm             text,
  data_receita    date not null default current_date,
  validade        date,
  od_esferico     numeric(5,2),
  od_cilindrico   numeric(5,2),
  od_eixo         integer check (od_eixo between 0 and 180),
  od_adicao       numeric(4,2),
  od_dnp          numeric(4,1),
  od_altura       numeric(4,1),
  oe_esferico     numeric(5,2),
  oe_cilindrico   numeric(5,2),
  oe_eixo         integer check (oe_eixo between 0 and 180),
  oe_adicao       numeric(4,2),
  oe_dnp          numeric(4,1),
  oe_altura       numeric(4,1),
  observacoes     text,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_receitas_cliente on receitas(cliente_id, data_receita desc);

-- ---------------------------------------------------------------------
-- Caixa
-- ---------------------------------------------------------------------
create table if not exists caixas (
  id              integer generated always as identity primary key,
  aberto_por      integer references usuarios(id) on delete set null,
  fechado_por     integer references usuarios(id) on delete set null,
  valor_abertura  numeric(12,2) not null default 0,
  valor_fechamento_informado numeric(12,2),
  valor_fechamento_calculado numeric(12,2),
  aberto_em       timestamptz not null default now(),
  fechado_em      timestamptz,
  observacoes     text
);
-- só pode existir um caixa aberto por vez
create unique index if not exists idx_caixa_unico_aberto on caixas((true)) where fechado_em is null;

create table if not exists caixa_lancamentos (
  id              integer generated always as identity primary key,
  caixa_id        integer not null references caixas(id) on delete cascade,
  tipo            text not null check (tipo in ('venda', 'recebimento_crediario', 'suprimento', 'sangria', 'estorno')),
  forma_pagamento text not null check (forma_pagamento in ('dinheiro', 'pix', 'debito', 'credito', 'crediario')),
  valor           numeric(12,2) not null,    -- positivo = entra, negativo = sai
  descricao       text,
  venda_id        integer,
  parcela_id      integer,
  usuario_id      integer references usuarios(id) on delete set null,
  criado_em       timestamptz not null default now()
);
create index if not exists idx_caixa_lanc on caixa_lancamentos(caixa_id);

-- ---------------------------------------------------------------------
-- Vendas
-- ---------------------------------------------------------------------
create table if not exists vendas (
  id              integer generated always as identity primary key,
  cliente_id      integer references clientes(id) on delete set null,
  receita_id      integer references receitas(id) on delete set null,
  vendedor_id     integer references usuarios(id) on delete set null,
  caixa_id        integer references caixas(id) on delete set null,
  subtotal        numeric(12,2) not null,
  desconto        numeric(12,2) not null default 0,
  total           numeric(12,2) not null,
  status          text not null default 'concluida' check (status in ('concluida', 'cancelada')),
  observacoes     text,
  -- preparado para NFC-e (fase 2)
  nfce_status     text,
  nfce_chave      text,
  nfce_url        text,
  criado_em       timestamptz not null default now(),
  cancelada_em    timestamptz
);
create index if not exists idx_vendas_data on vendas(criado_em desc);

create table if not exists venda_itens (
  id              integer generated always as identity primary key,
  venda_id        integer not null references vendas(id) on delete cascade,
  produto_id      integer references produtos(id) on delete set null,
  descricao       text not null,
  quantidade      integer not null check (quantidade > 0),
  preco_unitario  numeric(12,2) not null,
  custo_unitario  numeric(12,2) not null default 0,
  total           numeric(12,2) not null
);

create table if not exists venda_pagamentos (
  id              integer generated always as identity primary key,
  venda_id        integer not null references vendas(id) on delete cascade,
  forma           text not null check (forma in ('dinheiro', 'pix', 'debito', 'credito', 'crediario')),
  valor           numeric(12,2) not null check (valor > 0),
  parcelas        integer not null default 1 check (parcelas between 1 and 24)
);

-- ---------------------------------------------------------------------
-- Crediário (carnê próprio da loja)
-- ---------------------------------------------------------------------
create table if not exists crediario_parcelas (
  id              integer generated always as identity primary key,
  venda_id        integer not null references vendas(id) on delete cascade,
  cliente_id      integer not null references clientes(id) on delete restrict,
  numero          integer not null,
  total_parcelas  integer not null,
  valor           numeric(12,2) not null,
  vencimento      date not null,
  pago_em         timestamptz,
  valor_pago      numeric(12,2),
  forma_pagamento text,
  status          text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada'))
);
create index if not exists idx_parcelas_venc on crediario_parcelas(status, vencimento);

-- ---------------------------------------------------------------------
-- Ordens de serviço (montagem de óculos com laboratório)
-- ---------------------------------------------------------------------
create table if not exists ordens_servico (
  id              integer generated always as identity primary key,
  venda_id        integer references vendas(id) on delete set null,
  cliente_id      integer not null references clientes(id) on delete restrict,
  receita_id      integer references receitas(id) on delete set null,
  laboratorio_id  integer references fornecedores(id) on delete set null,
  descricao       text,
  tipo_lente      text,           -- visão simples, multifocal, bifocal, ocupacional
  tratamentos     text,           -- antirreflexo, filtro azul, fotossensível...
  status          text not null default 'aberta' check (status in ('aberta', 'enviada_laboratorio', 'em_montagem', 'pronta', 'entregue', 'cancelada')),
  previsao_entrega date,
  entregue_em     timestamptz,
  observacoes     text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists idx_os_status on ordens_servico(status);

create table if not exists os_historico (
  id              integer generated always as identity primary key,
  os_id           integer not null references ordens_servico(id) on delete cascade,
  status          text not null,
  observacao      text,
  usuario_id      integer references usuarios(id) on delete set null,
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Agendamentos de exame (vindos do site)
-- ---------------------------------------------------------------------
create table if not exists agendamentos (
  id              integer generated always as identity primary key,
  nome            text not null,
  telefone        text not null,
  data_preferida  date,
  periodo         text check (periodo in ('manha', 'tarde')),
  mensagem        text,
  status          text not null default 'novo' check (status in ('novo', 'confirmado', 'realizado', 'cancelado')),
  cliente_id      integer references clientes(id) on delete set null,
  criado_em       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Configurações da loja (chave/valor)
-- ---------------------------------------------------------------------
create table if not exists configuracoes (
  chave           text primary key,
  valor           text
);

insert into configuracoes (chave, valor) values
  ('loja_nome', 'Ótica MD'),
  ('loja_whatsapp', '5581999999999'),
  ('loja_endereco', 'Nº 546, Centro — Vitória de Santo Antão - PE'),
  ('loja_horario', 'Seg a Sex 8h às 18h · Sáb 8h às 13h'),
  ('loja_instagram', 'oticamd'),
  ('crediario_juros_mes', '0')
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------
-- Histórico de preços (cadastro, reajuste em massa, importação)
-- ---------------------------------------------------------------------
create table if not exists precos_historico (
  id                   integer generated always as identity primary key,
  produto_id           integer not null references produtos(id) on delete cascade,
  custo_anterior       numeric(12,2),
  custo_novo           numeric(12,2),
  venda_anterior       numeric(12,2),
  venda_nova           numeric(12,2),
  promocional_anterior numeric(12,2),
  promocional_novo     numeric(12,2),
  motivo               text,
  usuario_id           integer references usuarios(id) on delete set null,
  criado_em            timestamptz not null default now()
);
create index if not exists idx_precos_hist on precos_historico(produto_id, criado_em desc);

-- Todo produto tem código (usado na etiqueta com código de barras)
update produtos set sku = 'MD' || lpad(id::text, 5, '0') where sku is null or sku = '';

-- Regras de precificação (markup = quantas vezes o custo; ajuste em Configurações)
insert into configuracoes (chave, valor) values
  ('markup_armacao', '2.5'),
  ('markup_solar', '2.5'),
  ('markup_lente', '2.5'),
  ('markup_lente_contato', '2'),
  ('markup_acessorio', '2.5'),
  ('markup_servico', '1'),
  ('preco_arredondamento', 'x90')
on conflict (chave) do nothing;
