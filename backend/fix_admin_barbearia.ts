import { PrismaClient } from '@prisma/client';
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  // 1. Garantir que a barbearia Garoa Barbearia existe
  let barbearia = await prisma.barbearia.findUnique({
    where: { slug: 'garoa-barbearia' }
  });

  if (!barbearia) {
    barbearia = await prisma.barbearia.create({
      data: {
        nome: 'Garoa Barbearia',
        slug: 'garoa-barbearia',
        telefone: '',
        endereco: '',
        corPrimaria: '#FF8C00'
      }
    });
    console.log('Barbearia "Garoa Barbearia" criada com sucesso!');
  } else {
    console.log('Barbearia "Garoa Barbearia" já existe.');
  }

  // 2. Vincular usuários admins existentes que não têm barbearia
  const adminsSemBarbearia = await prisma.usuario.findMany({
    where: {
      papel: 'ADMIN',
      barbeariaId: null
    }
  });

  for (const admin of adminsSemBarbearia) {
    await prisma.usuario.update({
      where: { id: admin.id },
      data: { barbeariaId: barbearia.id }
    });
    console.log(`Admin ${admin.email} vinculado à barbearia Garoa Barbearia.`);
  }

  console.log('Script finalizado com sucesso.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
