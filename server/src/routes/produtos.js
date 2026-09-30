const router = require('express').Router();
const multer = require('multer');
const { query, transaction } = require('../db');
const { ah, parse, z, zId, zIdOpt, zMoney, zTextOpt, slugify, buildUpdate, vazio, round2, HttpError } = require('../util');
const { registrarMovimentacao } = require('./estoque');
const { exigir } = require('../auth');
const { registrar } = require('../auditoria');
const { carregarRegras, precoSugerido, arredondar, registrarPreco } = require('../precificacao');
const { gerarModelo, lerPlanilha, normalizar } = require('../importacao');

const CATEGORIAS = ['armacao', 'solar', 'lente', 'lente_contato', 'acessorio', 'servico'];

const zIntOpt = vazio(z.coerce.number().int().min(0).max(300).nullable().optional());

const schema = z.object({
  sku: zTextOpt,
  nome: z.string().trim().min(2),
  categoria: z.enum(CATEGORIAS),
  marca: zTextOpt,
  modelo: zTextOpt,
  cor: zTextOpt,
  genero: z.enum(['feminino', 'masculino', 'unissex', 'infantil']).nullable().optional().or(z.literal('').transform(() => null)),
  formato: zTextOpt,
  material: zTextOpt,
  largura_lente: zIntOpt,
  ponte: zIntOpt,
  haste: zIntOpt,
  descricao: zTextOpt,
  preco_custo: vazio(zMoney.nullable().optional()),
  preco_venda: vazio(zMoney.nullable().optional()),
  preco_promocional: vazio(zMoney.nullable().optional()),
  controla_estoque: z.boolean().default(true),
  estoque_minimo: z.coerce.number().int().min(0).default(0),
  fornecedor_id: zIdOpt,
  publicado: z.boolean().default(false),
  destaque: z.boolean().default(false),
  imagens: z.array(z.string().url()).max(10).default([]),
  ativo: z.boolean().default(true),
});

const CAMPOS = Object.keys(schema.shape);

async function slugUnico(db, base, ignorarId) {
  const raiz = slugify(base) || 'produto';
  let slug = raiz;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await db.query('select id from produtos where slug = $1 and id is distinct from $2', [slug, ignorarId || null]);
    if (!rows.length) return slug;
    n += 1;
    slug = `${raiz}-${n}`;
  }
}

// Código automático para quem não tem SKU: MD00001, MD00002...
async function garantirSku(db, produto) {
  if (produto.sku) return produto;
  const { rows } = await db.query(`update produtos set sku = 'MD' || lpad(id::text, 5, '0') where id = $1 returning *`, [produto.id]);
  return rows[0];
}

// Cria um produto (usado pelo cadastro e pela importação). Deve rodar dentro de transação.
async function criarProduto(client, d, usuarioId, { quantidade = 0, motivoEntrada = 'inventario', documento } = {}) {
  const slug = await slugUnico(client, [d.nome, d.cor].filter(Boolean).join(' '));
  const cols = [...CAMPOS, 'slug'];
  const vals = cols.map((c) => (c === 'slug' ? slug : c === 'imagens' ? JSON.stringify(d.imagens || []) : d[c] ?? null));
  const { rows } = await client.query(
    `insert into produtos (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
    vals.map((v, i) => (cols[i] === 'preco_custo' && v == null ? 0 : v))
  );
  let p = await garantirSku(client, rows[0]);
  if (quantidade > 0 && p.controla_estoque) {
    await registrarMovimentacao(client, {
      produto_id: p.id,
      tipo: 'entrada',
      motivo: motivoEntrada,
      quantidade,
      custo_unitario: d.preco_custo || null,
      documento,
      observacao: motivoEntrada === 'inventario' ? 'Estoque inicial no cadastro' : null,
      usuario_id: usuarioId,
    });
    p = (await client.query('select * from produtos where id = $1', [p.id])).rows[0];
  }
  return p;
}

// ---------------------------------------------------------------------
// Listagem e consultas
// ---------------------------------------------------------------------
router.get(
  '/',
  ah(async (req, res) => {
    const { busca, categoria, estoque, ativo, marca, fornecedor_id, ids } = req.query;
    const where = [];
    const params = [];
    if (busca) {
      params.push(`%${busca}%`);
      where.push(
        `(p.nome ilike $${params.length} or p.sku ilike $${params.length} or p.marca ilike $${params.length} or p.modelo ilike $${params.length} or p.cor ilike $${params.length})`
      );
    }
    if (categoria) {
      params.push(categoria);
      where.push(`p.categoria = $${params.length}`);
    }
    if (marca) {
      params.push(marca);
      where.push(`p.marca = $${params.length}`);
    }
    if (fornecedor_id) {
      params.push(fornecedor_id);
      where.push(`p.fornecedor_id = $${params.length}`);
    }
    if (ids) {
      params.push(String(ids).split(',').map(Number).filter(Boolean));
      where.push(`p.id = any($${params.length})`);
    }
    if (estoque === 'baixo') where.push('p.controla_estoque and p.estoque_atual <= p.estoque_minimo');
    if (estoque === 'zerado') where.push('p.controla_estoque and p.estoque_atual <= 0');
    if (ativo !== 'todos') where.push('p.ativo');
    const { rows } = await query(
      `select p.*, f.nome as fornecedor_nome
         from produtos p left join fornecedores f on f.id = p.fornecedor_id
        ${where.length ? 'where ' + where.join(' and ') : ''}
        order by p.nome, p.cor
        limit 2000`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/marcas',
  ah(async (_req, res) => {
    const { rows } = await query(`select distinct marca from produtos where marca is not null and ativo order by marca`);
    res.json(rows.map((r) => r.marca));
  })
);

// Busca exata pelo código (leitor de código de barras no PDV)
router.get(
  '/codigo/:codigo',
  ah(async (req, res) => {
    const { rows } = await query('select * from produtos where upper(sku) = upper($1) and ativo', [req.params.codigo.trim()]);
    if (!rows[0]) throw new HttpError(404, `Nenhum produto com o código ${req.params.codigo}`);
    res.json(rows[0]);
  })
);

// Preço sugerido pelas regras de markup (usado pelo cadastro no painel)
router.get(
  '/preco-sugerido',
  ah(async (req, res) => {
    const regras = await carregarRegras({ query });
    const custo = Number(req.query.custo);
    const categoria = CATEGORIAS.includes(req.query.categoria) ? req.query.categoria : 'armacao';
    res.json({ preco: precoSugerido(custo, categoria, regras), markup: regras[`markup_${categoria}`], arredondamento: regras.preco_arredondamento });
  })
);

// ---------------------------------------------------------------------
// Importação por planilha
// ---------------------------------------------------------------------
router.get(
  '/importacao/modelo',
  exigir('produtos.importar'),
  ah(async (_req, res) => {
    const buf = await gerarModelo();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modelo-produtos-otica-md.xlsx"');
    res.send(Buffer.from(buf));
  })
);

const uploadPlanilha = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    /\.(xlsx|csv)$/i.test(file.originalname) ? cb(null, true) : cb(new HttpError(400, 'Envie um arquivo .xlsx ou .csv')),
});

router.post(
  '/importacao',
  exigir('produtos.importar'),
  uploadPlanilha.single('arquivo'),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Selecione a planilha');
    const simular = req.query.simular === '1';
    const registros = await lerPlanilha(req.file.buffer, req.file.originalname);
    if (registros.length > 2000) throw new HttpError(400, 'Máximo de 2.000 linhas por importação');
    const regras = await carregarRegras({ query });

    // Produtos existentes pelos códigos informados
    const skus = registros.map((r) => String(r.bruto.sku ?? '').trim()).filter(Boolean);
    const { rows: existentes } = await query('select * from produtos where upper(sku) = any($1)', [skus.map((s) => s.toUpperCase())]);
    const porSku = new Map(existentes.map((p) => [p.sku.toUpperCase(), p]));
    const vistos = new Map();

    const linhas = registros.map(({ linha, bruto }) => {
      const { dados: d, erros } = normalizar(bruto);
      const chave = d.sku ? d.sku.toUpperCase() : null;
      if (chave) {
        if (vistos.has(chave)) erros.push(`Código repetido na planilha (também na linha ${vistos.get(chave)})`);
        else vistos.set(chave, linha);
      }
      const atual = chave ? porSku.get(chave) : null;
      const categoria = d.categoria || atual?.categoria;
      const custo = d.preco_custo ?? atual?.preco_custo ?? null;
      let venda = d.preco_venda ?? null;
      let sugerido = false;
      if (venda == null && !atual && !erros.length) {
        venda = precoSugerido(custo, categoria, regras);
        sugerido = venda != null;
        if (venda == null) erros.push('Informe o preço de venda ou o custo');
      }
      return {
        linha,
        acao: erros.length ? 'erro' : atual ? 'atualizar' : 'novo',
        produto_id: atual?.id ?? null,
        dados: { ...d, preco_venda: venda },
        sugerido,
        erros,
        resumo: {
          sku: d.sku || atual?.sku || '(automático)',
          nome: d.nome || atual?.nome,
          cor: d.cor ?? atual?.cor ?? null,
          categoria,
          custo,
          venda: venda ?? atual?.preco_venda ?? null,
          quantidade: d.quantidade || 0,
        },
      };
    });

    const total = {
      novos: linhas.filter((l) => l.acao === 'novo').length,
      atualizar: linhas.filter((l) => l.acao === 'atualizar').length,
      erros: linhas.filter((l) => l.acao === 'erro').length,
      unidades: linhas.filter((l) => l.acao !== 'erro').reduce((s, l) => s + (l.dados.quantidade || 0), 0),
    };
    const saida = linhas.map(({ linha, acao, resumo, sugerido, erros }) => ({ linha, acao, ...resumo, sugerido, erros }));

    if (simular) return res.json({ simulacao: true, total, linhas: saida });
    if (total.erros) return res.status(400).json({ erro: `Corrija as ${total.erros} linha(s) com erro antes de importar`, total, linhas: saida });

    const documento = `Planilha ${req.file.originalname}`.slice(0, 120);
    await transaction(async (client) => {
      for (const l of linhas) {
        const d = l.dados;
        if (l.acao === 'novo') {
          await criarProduto(
            client,
            {
              ...d,
              preco_custo: d.preco_custo ?? 0,
              controla_estoque: d.controla_estoque ?? !['lente', 'servico'].includes(d.categoria),
              publicado: d.publicado ?? false,
              destaque: d.destaque ?? false,
              estoque_minimo: d.estoque_minimo ?? 0,
              imagens: [],
              ativo: true,
            },
            req.usuario.id,
            { quantidade: d.quantidade || 0, motivoEntrada: 'compra', documento }
          );
        } else {
          const antes = (await client.query('select * from produtos where id = $1 for update', [l.produto_id])).rows[0];
          const campos = {};
          for (const k of ['nome', 'categoria', 'marca', 'modelo', 'cor', 'genero', 'formato', 'material', 'largura_lente', 'ponte', 'haste', 'descricao', 'estoque_minimo', 'preco_venda', 'preco_promocional']) {
            if (d[k] != null) campos[k] = d[k];
          }
          for (const k of ['controla_estoque', 'publicado', 'destaque']) if (d[k] !== undefined) campos[k] = d[k];
          // Sem entrada de mercadoria, o custo informado substitui o atual; com entrada, entra no custo médio
          if (d.preco_custo != null && !(d.quantidade > 0)) campos.preco_custo = d.preco_custo;
          const { sets, values } = buildUpdate(campos, Object.keys(campos));
          if (sets.length) {
            values.push(l.produto_id);
            await client.query(`update produtos set ${sets.join(', ')}, ativo = true, atualizado_em = now() where id = $${values.length}`, values);
          }
          if (d.quantidade > 0) {
            await registrarMovimentacao(client, {
              produto_id: l.produto_id,
              tipo: 'entrada',
              motivo: 'compra',
              quantidade: d.quantidade,
              custo_unitario: d.preco_custo || null,
              documento,
              usuario_id: req.usuario.id,
            });
          }
          const depois = (await client.query('select * from produtos where id = $1', [l.produto_id])).rows[0];
          await registrarPreco(client, antes, depois, 'Importação por planilha', req.usuario.id);
        }
      }
      await registrar(client, req, 'importacao_planilha', { detalhes: { arquivo: req.file.originalname, ...total } });
    });
    res.json({ simulacao: false, total, linhas: saida });
  })
);

// ---------------------------------------------------------------------
// Reajuste de preços em massa
// ---------------------------------------------------------------------
const schemaReajuste = z.object({
  filtro: z
    .object({
      categoria: z.enum(CATEGORIAS).optional().or(z.literal('').transform(() => undefined)),
      marca: zTextOpt,
      fornecedor_id: zIdOpt,
      somente_publicados: z.boolean().optional(),
      ids: z.array(zId).optional(),
    })
    .default({}),
  acao: z.enum(['aumentar_pct', 'reduzir_pct', 'aplicar_markup', 'promocao_pct', 'remover_promocao']),
  valor: vazio(z.coerce.number().positive().max(1000).nullable().optional()),
  arredondamento: z.enum(['nenhum', 'inteiro', 'x90', 'x99', 'd90']).optional(),
  simular: z.boolean().default(true),
});

router.post(
  '/reajuste',
  exigir('precos.massa'),
  ah(async (req, res) => {
    const d = parse(schemaReajuste, req.body);
    if (d.acao !== 'remover_promocao' && d.acao !== 'aplicar_markup' && !d.valor) throw new HttpError(400, 'Informe o percentual');
    if (['reduzir_pct', 'promocao_pct'].includes(d.acao) && d.valor >= 100) throw new HttpError(400, 'O percentual precisa ser menor que 100');
    const regras = await carregarRegras({ query });
    const modo = d.arredondamento || regras.preco_arredondamento;

    const where = ['ativo'];
    const params = [];
    const f = d.filtro;
    if (f.categoria) where.push(`categoria = $${params.push(f.categoria)}`);
    if (f.marca) where.push(`marca = $${params.push(f.marca)}`);
    if (f.fornecedor_id) where.push(`fornecedor_id = $${params.push(f.fornecedor_id)}`);
    if (f.somente_publicados) where.push('publicado');
    if (f.ids?.length) where.push(`id = any($${params.push(f.ids)})`);
    const { rows: produtos } = await query(`select * from produtos where ${where.join(' and ')} order by nome, cor`, params);

    const itens = [];
    for (const p of produtos) {
      let venda = p.preco_venda;
      let promo = p.preco_promocional;
      if (d.acao === 'aumentar_pct') venda = arredondar(p.preco_venda * (1 + d.valor / 100), modo);
      if (d.acao === 'reduzir_pct') venda = arredondar(p.preco_venda * (1 - d.valor / 100), modo);
      if (d.acao === 'aplicar_markup') {
        if (!p.preco_custo) continue; // sem custo não há como calcular
        const m = d.valor || regras[`markup_${p.categoria}`];
        venda = arredondar(p.preco_custo * m, modo);
      }
      if (d.acao === 'promocao_pct') promo = arredondar(p.preco_venda * (1 - d.valor / 100), modo);
      if (d.acao === 'remover_promocao') promo = null;
      if (promo != null && promo >= venda) promo = null; // promoção precisa ser menor que o preço cheio
      if (venda === p.preco_venda && promo === p.preco_promocional) continue;
      const margem = venda > 0 ? round2((1 - p.preco_custo / (promo ?? venda)) * 100) : null;
      itens.push({
        id: p.id,
        sku: p.sku,
        nome: p.nome,
        cor: p.cor,
        custo: p.preco_custo,
        venda_antes: p.preco_venda,
        venda_depois: venda,
        promo_antes: p.preco_promocional,
        promo_depois: promo,
        margem_depois: margem,
      });
    }

    if (!d.simular && itens.length) {
      const motivos = {
        aumentar_pct: `Reajuste +${d.valor}%`,
        reduzir_pct: `Reajuste -${d.valor}%`,
        aplicar_markup: `Markup ${d.valor ? d.valor + '×' : 'da categoria'}`,
        promocao_pct: `Promoção ${d.valor}%`,
        remover_promocao: 'Fim da promoção',
      };
      await transaction(async (client) => {
        for (const i of itens) {
          const antes = (await client.query('select * from produtos where id = $1 for update', [i.id])).rows[0];
          const { rows } = await client.query(
            'update produtos set preco_venda = $1, preco_promocional = $2, atualizado_em = now() where id = $3 returning *',
            [i.venda_depois, i.promo_depois, i.id]
          );
          await registrarPreco(client, antes, rows[0], motivos[d.acao], req.usuario.id);
        }
        await registrar(client, req, 'reajuste_precos', { detalhes: { acao: d.acao, motivo: motivos[d.acao], valor: d.valor ?? null, total: itens.length } });
      });
    }
    res.json({ simulacao: d.simular, total: itens.length, abaixo_do_custo: itens.filter((i) => i.margem_depois != null && i.margem_depois < 0).length, itens });
  })
);

// ---------------------------------------------------------------------
// Produto individual
// ---------------------------------------------------------------------
router.get(
  '/:id/precos',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query(
      `select h.*, u.nome as usuario_nome from precos_historico h left join usuarios u on u.id = h.usuario_id
        where h.produto_id = $1 order by h.criado_em desc limit 50`,
      [id]
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query(
      'select p.*, f.nome as fornecedor_nome from produtos p left join fornecedores f on f.id = p.fornecedor_id where p.id = $1',
      [id]
    );
    if (!rows[0]) throw new HttpError(404, 'Produto não encontrado');
    res.json(rows[0]);
  })
);

router.post(
  '/',
  exigir('produtos.editar'),
  ah(async (req, res) => {
    const d = parse(schema.extend({ estoque_inicial: z.coerce.number().int().min(0).default(0) }), req.body);
    if (!req.pode('custos.ver')) delete d.preco_custo;
    if (d.preco_venda == null) {
      const regras = await carregarRegras({ query });
      d.preco_venda = precoSugerido(d.preco_custo, d.categoria, regras);
      if (d.preco_venda == null) throw new HttpError(400, 'Informe o preço de venda ou o custo');
    }
    const produto = await transaction(async (client) => {
      const p = await criarProduto(client, d, req.usuario.id, { quantidade: d.estoque_inicial });
      await registrar(client, req, 'produto_criado', {
        entidade: 'produto',
        entidadeId: p.id,
        detalhes: { nome: p.nome, sku: p.sku, preco_venda: p.preco_venda, estoque_inicial: d.estoque_inicial },
      });
      return p;
    });
    res.status(201).json(produto);
  })
);

router.put(
  '/:id',
  exigir('produtos.editar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), req.body);
    if (!req.pode('custos.ver')) delete d.preco_custo;
    if ('preco_venda' in d && d.preco_venda == null) throw new HttpError(400, 'Informe o preço de venda');
    if ('preco_custo' in d && d.preco_custo == null) d.preco_custo = 0;
    const produto = await transaction(async (client) => {
      const antes = (await client.query('select * from produtos where id = $1 for update', [id])).rows[0];
      if (!antes) throw new HttpError(404, 'Produto não encontrado');
      const { sets, values } = buildUpdate(d, CAMPOS);
      if (d.nome) {
        values.push(await slugUnico(client, [d.nome, d.cor ?? antes.cor].filter(Boolean).join(' '), id));
        sets.push(`slug = $${values.length}`);
      }
      if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
      values.push(id);
      const { rows } = await client.query(
        `update produtos set ${sets.join(', ')}, atualizado_em = now() where id = $${values.length} returning *`,
        values
      );
      const depois = await garantirSku(client, rows[0]);
      await registrarPreco(client, antes, depois, 'Edição no cadastro', req.usuario.id);
      const mudou = {};
      for (const c of Object.keys(d)) {
        if (String(antes[c] ?? '') !== String(depois[c] ?? '')) mudou[c] = { de: antes[c], para: depois[c] };
      }
      if (Object.keys(mudou).length) {
        await registrar(client, req, 'produto_alterado', { entidade: 'produto', entidadeId: id, detalhes: { nome: depois.nome, ...mudou } });
      }
      return depois;
    });
    res.json(produto);
  })
);

// Não apaga de fato (o produto pode estar em vendas antigas): apenas desativa e tira do site
router.delete(
  '/:id',
  exigir('produtos.editar'),
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query('update produtos set ativo = false, publicado = false, atualizado_em = now() where id = $1 returning nome, sku', [id]);
    if (!rows[0]) throw new HttpError(404, 'Produto não encontrado');
    await registrar({ query }, req, 'produto_desativado', { entidade: 'produto', entidadeId: id, detalhes: rows[0] });
    res.status(204).end();
  })
);

module.exports = router;
