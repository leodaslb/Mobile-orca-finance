require('dotenv').config({ quiet: true });

const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('../dist/generated/prisma/client');

const categorias = [
  'Moradia',
  'Transporte',
  'Alimentação',
  'Lazer e Estilo de Vida',
  'Saúde e Autocuidado',
  'Educação e Carreira',
  'Rendas e Investimentos',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) {
    throw new Error('DATABASE_URL deve ser configurada para executar o seed.');
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    for (const [index, nome] of categorias.entries()) {
      const ordem = index + 1;
      const existente = await prisma.categoria.findFirst({ where: { nome } });

      if (existente) {
        await prisma.categoria.update({
          where: { id: existente.id },
          data: { ordem, ativa: true },
        });
      } else {
        await prisma.categoria.create({
          data: { nome, ordem, ativa: true },
        });
      }
    }

    console.log(`Catálogo de categorias atualizado: ${categorias.length} entradas.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
