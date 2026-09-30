const router = require('express').Router();
const { query } = require('../db');
const { ah, parse, z, zId, zTextOpt, zDateOpt, buildUpdate, HttpError } = require('../util');
const { exigir } = require('../auth');

// O PDV também precisa buscar e cadastrar clientes
router.use(exigir('clientes.gerenciar', 'vendas.criar'));

const soDigitos = (v) => (v ? String(v).replace(/\D/g, '') : v);

const schema = z.object({
  nome: z.string().trim().min(2),
  cpf: zTextOpt.transform((v) => soDigitos(v) || null),
  telefone: zTextOpt.transform((v) => soDigitos(v) || null),
  email: zTextOpt,
  data_nascimento: zDateOpt,
  endereco: zTextOpt,
  bairro: zTextOpt,
  cidade: zTextOpt,
  observacoes: zTextOpt,
});
const CAMPOS = Object.keys(schema.shape);

router.get(
  '/',
  ah(async (req, res) => {
    const { busca } = req.query;
    const params = [];
    let where = '';
    if (busca) {
      params.push(`%${busca}%`, `%${soDigitos(busca) || '§'}%`);
      where = 'where c.nome ilike $1 or c.cpf like $2 or c.telefone like $2';
    }
    const { rows } = await query(
      `select c.*,
              (select max(criado_em) from vendas v where v.cliente_id = c.id and v.status = 'concluida') as ultima_compra,
              (select coalesce(sum(valor),0) from crediario_parcelas cp where cp.cliente_id = c.id and cp.status = 'aberta') as saldo_crediario
         from clientes c ${where}
        order by c.nome limit 300`,
      params
    );
    res.json(rows);
  })
);

router.get(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const { rows } = await query('select * from clientes where id = $1', [id]);
    if (!rows[0]) throw new HttpError(404, 'Cliente não encontrado');
    const [receitas, vendas, parcelas, os] = await Promise.all([
      query('select * from receitas where cliente_id = $1 order by data_receita desc, id desc', [id]),
      query(
        `select v.id, v.total, v.status, v.criado_em,
                (select string_agg(descricao, ', ') from venda_itens vi where vi.venda_id = v.id) as itens
           from vendas v where v.cliente_id = $1 order by v.criado_em desc`,
        [id]
      ),
      query(`select * from crediario_parcelas where cliente_id = $1 and status <> 'cancelada' order by vencimento`, [id]),
      query('select id, status, previsao_entrega, criado_em, tipo_lente from ordens_servico where cliente_id = $1 order by id desc', [id]),
    ]);
    res.json({ ...rows[0], receitas: receitas.rows, vendas: vendas.rows, parcelas: parcelas.rows, ordens_servico: os.rows });
  })
);

router.post(
  '/',
  ah(async (req, res) => {
    const d = parse(schema, req.body);
    const { rows } = await query(
      `insert into clientes (${CAMPOS.join(', ')}) values (${CAMPOS.map((_, i) => `$${i + 1}`).join(', ')}) returning *`,
      CAMPOS.map((c) => (c === 'cidade' ? d.cidade || 'Vitória de Santo Antão' : d[c] ?? null))
    );
    res.status(201).json(rows[0]);
  })
);

router.put(
  '/:id',
  ah(async (req, res) => {
    const id = parse(zId, req.params.id);
    const d = parse(schema.partial(), req.body);
    const { sets, values } = buildUpdate(d, CAMPOS);
    if (!sets.length) throw new HttpError(400, 'Nada para atualizar');
    values.push(id);
    const { rows } = await query(`update clientes set ${sets.join(', ')} where id = $${values.length} returning *`, values);
    if (!rows[0]) throw new HttpError(404, 'Cliente não encontrado');
    res.json(rows[0]);
  })
);

module.exports = router;
