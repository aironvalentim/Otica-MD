// Cadastra produtos, fornecedores e um cliente de exemplo para testar o sistema.
// Uso: npm run db:seed   (rode depois do db:setup; não duplica se já houver produtos)
require('dotenv').config();
const { pool } = require('../src/db');
const { slugify } = require('../src/util');


const produtos = [
  ['Armação Aurora', 'armacao', 'MD Collection', 'AU-01', 'Tartaruga', 'feminino', 'gatinho', 'acetato', 52, 18, 140, 95, 289.9, null, 6, true, null],
  ['Armação Lume', 'armacao', 'MD Collection', 'LU-02', 'Preto fosco', 'unissex', 'quadrado', 'acetato', 54, 17, 145, 85, 259.9, 229.9, 8, true, null],
  ['Armação Orbe', 'armacao', 'Visio', 'OR-11', 'Dourado', 'unissex', 'redondo', 'metal', 49, 21, 145, 110, 349.9, null, 4, true, null],
  ['Armação Prisma', 'armacao', 'Visio', 'PR-07', 'Grafite', 'masculino', 'retangular', 'titânio', 55, 17, 145, 180, 549.9, null, 3, false, null],
  ['Armação Kids Flex', 'armacao', 'FlexKids', 'KF-03', 'Azul', 'infantil', 'redondo', 'TR90', 44, 16, 125, 60, 199.9, null, 5, false, null],
  ['Solar Brisa', 'solar', 'MD Sun', 'SB-21', 'Preto', 'feminino', 'gatinho', 'acetato', 55, 17, 140, 70, 199.9, 169.9, 10, true, null],
  ['Solar Rota', 'solar', 'MD Sun', 'SR-05', 'Dourado/verde', 'masculino', 'aviador', 'metal', 58, 14, 140, 75, 229.9, null, 7, true, null],
  ['Solar Maré Polarizado', 'solar', 'MD Sun', 'SM-09', 'Marrom', 'unissex', 'quadrado', 'acetato', 53, 19, 145, 90, 279.9, null, 5, false, null],
  ['Lente Visão Simples Antirreflexo', 'lente', 'Hoya', 'VS-AR', null, null, null, null, null, null, null, 60, 180, null, 0, false, null],
  ['Lente Multifocal Digital', 'lente', 'Essilor', 'MF-DG', null, null, null, null, null, null, null, 280, 890, null, 0, false, null],
  ['Estojo rígido', 'acessorio', 'MD', 'EST-01', 'Preto', null, null, null, null, null, null, 6, 25, null, 30, false, null],
  ['Limpa-lentes spray 30 ml', 'acessorio', 'MD', 'LIM-30', null, null, null, null, null, null, null, 4, 15, null, 40, false, null],
];

(async () => {
  const { rows } = await pool.query('select count(*)::int as n from produtos');
  if (rows[0].n > 0) {
    console.log('Já existem produtos cadastrados. Seed ignorado.');
    return pool.end();
  }
  const { rows: forn } = await pool.query(
    `insert into fornecedores (nome, tipo, telefone) values
       ('Distribuidora Óptica Recife', 'fornecedor', '81999990001'),
       ('Laboratório Visão Nordeste', 'laboratorio', '81999990002')
     returning id`
  );
  for (const p of produtos) {
    const [nome, categoria, marca, modelo, cor, genero, formato, material, lente, ponte, haste, custo, venda, promo, estoque, destaque, foto] = p;
    const semEstoque = categoria === 'lente';
    const publicado = categoria === 'armacao' || categoria === 'solar';
    const { rows: ins } = await pool.query(
      `insert into produtos (sku, nome, slug, categoria, marca, modelo, cor, genero, formato, material, largura_lente, ponte, haste,
          preco_custo, preco_venda, preco_promocional, controla_estoque, estoque_atual, estoque_minimo, fornecedor_id, publicado, destaque, imagens,
          descricao)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) returning id`,
      [
        modelo,
        nome,
        slugify(`${nome} ${cor || ''}`),
        categoria,
        marca,
        modelo,
        cor,
        genero,
        formato,
        material,
        lente,
        ponte,
        haste,
        custo,
        venda,
        promo,
        !semEstoque,
        0,
        semEstoque ? 0 : 2,
        forn[0].id,
        publicado,
        destaque,
        JSON.stringify(foto ? [foto] : []),
        publicado ? 'Leve, confortável e pronta para receber suas lentes de grau.' : null,
      ]
    );
    if (!semEstoque && estoque > 0) {
      await pool.query(
        `insert into movimentacoes_estoque (produto_id, tipo, motivo, quantidade, custo_unitario, estoque_anterior, estoque_posterior, fornecedor_id, observacao)
         values ($1,'entrada','compra',$2,$3,0,$2,$4,'Carga inicial (seed)')`,
        [ins[0].id, estoque, custo, forn[0].id]
      );
      await pool.query('update produtos set estoque_atual = $1 where id = $2', [estoque, ins[0].id]);
    }
  }
  await pool.query(
    `insert into clientes (nome, cpf, telefone, data_nascimento, bairro) values ('Maria das Graças Silva', '12345678909', '81988887777', '1968-04-12', 'Matriz')`
  );
  console.log(`${produtos.length} produtos, 2 fornecedores e 1 cliente de exemplo cadastrados.`);
  await pool.end();
})().catch(async (err) => {
  console.error('Erro:', err.message);
  await pool.end();
  process.exit(1);
});
