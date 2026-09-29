# Ótica MD — site + sistema de gestão

Site da ótica (vitrine com WhatsApp e agendamento de exame) e painel administrativo com estoque, vendas (PDV), caixa, clientes e receitas, ordens de serviço e crediário.

```
otica-md/
├── client/     React + Vite + Tailwind v4 (site público em / e painel em /admin)
├── server/     Node.js + Express (CommonJS) + PostgreSQL
└── database/   schema.sql
```

## O que já funciona

**Site público**
- Home com destaques, guia "qual armação combina com seu rosto" e seção de lentes
- Catálogo com filtros (público, formato, material, marca), busca e ordenação
- Página do produto com medidas da armação, produtos relacionados e botão "Quero este modelo" que abre o WhatsApp com a mensagem pronta
- Agendamento de exame (cai no painel em Agendamentos)
- Sem foto, o produto aparece com uma ilustração gerada pelo formato e pela cor

**Painel (/admin)**
- **Painel:** vendas do dia e do mês, ticket médio, margem, gráfico de 30 dias, alertas
- **Nova venda (PDV):** vários itens, desconto em R$ ou %, pagamento dividido (dinheiro, Pix, débito, crédito parcelado, crediário), cliente, receita e ordem de serviço na mesma tela
- **Caixa:** abertura com troco, suprimento, sangria e fechamento com conferência de sobra/falta
- **Estoque:** entradas (com custo médio ponderado), saídas, inventário e entrada de nota com vários itens. Cada movimento fica registrado com o usuário
- **Clientes e receitas:** ficha com OD/OE (esférico, cilíndrico, eixo, adição, DNP, altura), histórico de compras, OS e crediário. Também lista quem tem receita com mais de 1 ano, com lembrete pronto no WhatsApp
- **Ordens de serviço:** Aberta → No laboratório → Em montagem → Pronta → Entregue, com histórico, impressão para o laboratório e aviso ao cliente pelo WhatsApp
- **Crediário:** carnê automático, recebimento lançado no caixa, atrasados e lembrete de cobrança
- **Cancelamento de venda:** devolve o estoque, estorna no caixa e cancela parcelas e OS
- **Configurações:** dados da loja (WhatsApp, endereço, horário), fornecedores/laboratórios e usuários (admin e vendedor)

## Atalhos (rodar tudo da pasta principal)

Na pasta `otica-md`, sem precisar entrar em `server` ou `client`:

```bash
npm run setup      # instala tudo (primeira vez)
npm run db:setup   # cria tabelas e administrador
npm run db:seed    # produtos de exemplo (opcional)
npm run dev        # sobe API e site juntos no mesmo terminal
```

## Abastecer e precificar

- **Importar planilha** (Produtos → Importar planilha): baixe o modelo .xlsx, preencha uma linha por produto e envie. Aparece uma prévia; nada é gravado até confirmar. Código (SKU) já existente atualiza o produto e soma a quantidade ao estoque. Também aceita .csv com ponto e vírgula.
- **Preço sugerido** (Configurações → Precificação): markup por categoria (quantas vezes o custo) e arredondamento (,90 / ,99 / 9,90 / inteiro). Usado no cadastro, na importação e no reajuste.
- **Preços em massa** (Produtos → Preços em massa): aumentar/reduzir %, promoção %, encerrar promoção ou recalcular pelo markup, filtrando por categoria, marca ou fornecedor (ou produtos marcados na lista). Sempre com prévia e registro no histórico de preços do produto.
- **Etiquetas** (Produtos → Etiquetas): código de barras (Code 128) do SKU, com nome e preço. Folha A4 3 × 10 (63,5 × 25,4 mm) ou térmica 40 × 25 mm. Produtos sem código recebem um automático (MD00001…).
- **Leitor de código de barras** no caixa: na Nova venda, bipe a etiqueta no campo de busca que o produto entra direto (o leitor USB funciona como teclado).

## Rodar no computador (passo a passo manual)

Pré-requisitos: Node 20+ e um banco Postgres (o do Supabase serve).

```bash
# 1. API
cd server
npm install
cp .env.example .env      # preencha DATABASE_URL, JWT_SECRET e ADMIN_*
npm run db:setup          # cria as tabelas e o usuário administrador
npm run db:seed           # opcional: produtos e cliente de exemplo
npm run dev               # http://localhost:3001

# 2. Front (em outro terminal)
cd client
npm install
npm run dev               # http://localhost:5173  (painel em /admin)
```

No Windows/PowerShell use `copy .env.example .env` no lugar de `cp`.

Teste de ponta a ponta da API (com a API rodando e um banco recém-criado com o seed):

```bash
cd server
npm test
```

## Configurar o Supabase

1. Crie um projeto em supabase.com.
2. Em **Project Settings → Database → Connection string → URI**, copie a string e coloque em `DATABASE_URL` (troque `[YOUR-PASSWORD]` pela senha do banco).
3. Para as fotos: em **Storage**, crie um bucket **público** chamado `produtos`. Em **Project Settings → API**, copie a `service_role key` para `SUPABASE_SERVICE_KEY` e a URL do projeto para `SUPABASE_URL`.
   Sem essas variáveis as fotos ficam na pasta `server/uploads`. Isso serve para testes, mas **não em produção**: o disco do Render é apagado a cada deploy.
4. Rode `npm run db:setup`.

A `service_role key` fica **só no servidor**. Nunca coloque no `client`.

## Publicar

**API no Render** (Web Service)
- Root directory: `server`
- Build: `npm install` · Start: `npm start`
- Variáveis: as do `.env.example`, com `CLIENT_URL` apontando para o domínio do site (ex.: `https://oticamd.com.br,https://otica-md.vercel.app`)

**Site na Vercel**
- Root directory: `client` · Framework: Vite
- Variável `VITE_API_URL` = URL da API no Render (ex.: `https://otica-md-api.onrender.com`)
- O `vercel.json` já redireciona as rotas para o React Router

No plano gratuito do Render a API "dorme" após 15 minutos sem uso, e a primeira abertura depois disso demora uns 30 segundos. Para uso na loja o dia inteiro vale o plano pago mais barato.

## Antes de abrir a loja

- Em **Configurações**, coloque o WhatsApp, endereço e horário reais
- O texto "10x sem juros" aparece na faixa do topo (`client/src/components/site/SiteLayout.jsx`) e nos cards (`ProductCard.jsx`, `Produto.jsx`). Ajuste se a condição for outra
- Cadastre os laboratórios em **Configurações → Fornecedores e laboratórios**
- Crie um usuário para cada vendedor (perfil Vendedor não acessa Configurações)
- Troque a senha do administrador inicial

## Fase 2 (preparado, ainda não implementado)

- **NFC-e:** a tabela `vendas` já tem `nfce_status`, `nfce_chave` e `nfce_url`. A integração com Focus NFe ou PlugNotas entra quando a loja tiver CNPJ, inscrição estadual e certificado A1
- Envio automático de WhatsApp (hoje os botões abrem o WhatsApp com a mensagem pronta)
- Relatórios em PDF e exportação para planilha
- Comissão por vendedor
