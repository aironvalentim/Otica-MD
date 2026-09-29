const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { ah, parse, z, zTextOpt, zDateOpt, HttpError } = require('../util');

// Campos seguros para o site (sem custo, fornecedor etc.)
const CAMPOS_PUBLICOS = `id, nome, slug, categoria, marca, modelo, cor, genero, formato, material,
  largura_lente, ponte, haste, descricao, preco_venda, preco_promocional, imagens, destaque,
  (not controla_estoque or estoque_atual > 0) as disponivel`;

const ORDENS = {
  recentes: 'criado_em desc',
  menor_preco: 'coalesce(preco_promocional, preco_venda) asc',
  maior_preco: 'coalesce(preco_promocional, preco_venda) desc',
  nome: 'nome asc',
};

router.get(
  '/config',
  ah(async (_req, res) => {
    const { rows } = await query(`select chave, valor from configuracoes where chave like 'loja_%'`);
    res.json(Object.fromEntries(rows.map((r) => [r.chave, r.valor])));
  })
);

router.get(
  '/produtos',
  ah(async (req, res) => {
    const { categoria, genero, formato, material, marca, busca, preco_min, preco_max, destaque, ordem } = req.query;
    const where = ['publicado', 'ativo'];
    const params = [];
    const add = (sql, v) => {
      params.push(v);
      where.push(sql.replace('?', `$${params.length}`));
    };
    const lista = (v) => String(v).split(',').filter(Boolean);
    if (categoria) add('categoria = any(?)', lista(categoria));
    if (genero) add('genero = any(?)', lista(genero));
    if (formato) add('formato = any(?)', lista(formato));
    if (material) add('material = any(?)', lista(material));
    if (marca) add('marca = any(?)', lista(marca));
    if (busca) add(`(nome || ' ' || coalesce(marca,'') || ' ' || coalesce(modelo,'') || ' ' || coalesce(cor,'')) ilike ?`, `%${busca}%`);
    if (preco_min) add('coalesce(preco_promocional, preco_venda) >= ?', Number(preco_min));
    if (preco_max) add('coalesce(preco_promocional, preco_venda) <= ?', Number(preco_max));
    if (destaque === 'true') where.push('destaque');
    const orderBy = ORDENS[ordem] || 'destaque desc, criado_em desc';
    const { rows } = await query(
      `select ${CAMPOS_PUBLICOS} from produtos where ${where.join(' and ')} order by ${orderBy} limit 200`,
      params
    );
    res.json(rows);
  })
);

// Valores existentes para montar os filtros do catálogo
router.get(
  '/filtros',
  ah(async (_req, res) => {
    const { rows } = await query(
      `select
         array_remove(array_agg(distinct categoria), null) as categorias,
         array_remove(array_agg(distinct genero), null) as generos,
         array_remove(array_agg(distinct formato), null) as formatos,
         array_remove(array_agg(distinct material), null) as materiais,
         array_remove(array_agg(distinct marca), null) as marcas,
         min(coalesce(preco_promocional, preco_venda)) as preco_min,
         max(coalesce(preco_promocional, preco_venda)) as preco_max
       from produtos where publicado and ativo`
    );
    res.json(rows[0]);
  })
);

router.get(
  '/produtos/:slug',
  ah(async (req, res) => {
    const { rows } = await query(`select ${CAMPOS_PUBLICOS} from produtos where slug = $1 and publicado and ativo`, [req.params.slug]);
    if (!rows[0]) throw new HttpError(404, 'Produto não encontrado');
    const p = rows[0];
    const { rows: relacionados } = await query(
      `select ${CAMPOS_PUBLICOS} from produtos
        where publicado and ativo and id <> $1 and categoria = $2
        order by (formato is not distinct from $3) desc, random() limit 4`,
      [p.id, p.categoria, p.formato]
    );
    res.json({ ...p, relacionados });
  })
);

const limiteAgendamento = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { erro: 'Muitos pedidos de agendamento. Fale conosco pelo WhatsApp' },
});

router.post(
  '/agendamentos',
  limiteAgendamento,
  ah(async (req, res) => {
    const d = parse(
      z.object({
        nome: z.string().trim().min(3, 'Informe seu nome'),
        telefone: z
          .string()
          .transform((v) => v.replace(/\D/g, ''))
          .refine((v) => v.length >= 10 && v.length <= 13, 'Telefone inválido'),
        data_preferida: zDateOpt,
        periodo: z.enum(['manha', 'tarde']).nullable().optional(),
        mensagem: zTextOpt,
        site: z.string().max(0).optional(), // campo-isca contra robôs (fica invisível no formulário)
      }),
      req.body
    );
    await query('insert into agendamentos (nome, telefone, data_preferida, periodo, mensagem) values ($1,$2,$3,$4,$5)', [
      d.nome,
      d.telefone,
      d.data_preferida ?? null,
      d.periodo ?? null,
      d.mensagem ?? null,
    ]);
    res.status(201).json({ ok: true });
  })
);

module.exports = router;
