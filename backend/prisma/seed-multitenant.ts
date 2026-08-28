import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed multitenant...');

  const senhaPadrao = await bcrypt.hash('Admin123!', 10);
  const senhaCliente = await bcrypt.hash('Cliente123!', 10);

  // 1. Criar Barbearia Teste B
  const barbeariaB = await prisma.barbearia.upsert({
    where: { slug: 'barbearia-teste-b' },
    update: {},
    create: {
      nome: 'Barbearia Teste B',
      slug: 'barbearia-teste-b',
      telefone: '(11) 98888-8888',
      endereco: 'Rua Teste, 456',
    },
  });
  console.log('✅ Barbearia criada:', barbeariaB.nome);

  // 2. Admin da Barbearia Teste B
  const adminB = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'adminb@teste.com', barbeariaId: barbeariaB.id } },
    update: {},
    create: {
      nome: 'Admin Teste B',
      email: 'adminb@teste.com',
      senha: senhaPadrao,
      papel: 'ADMIN',
      barbeariaId: barbeariaB.id,
    },
  });
  console.log('✅ Admin criado:', adminB.email);

  // 3. Cliente da Barbearia Teste B ("Mariana Souza")
  const marianaUser = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'mariana.souza@email.com', barbeariaId: barbeariaB.id } },
    update: {},
    create: { nome: 'Mariana Souza', email: 'mariana.souza@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: barbeariaB.id },
  });
  
  const marianaCliente = await prisma.cliente.findFirst({
    where: { usuarioId: marianaUser.id, barbeariaId: barbeariaB.id }
  });
  
  if (!marianaCliente) {
    await prisma.cliente.create({
      data: {
        usuarioId: marianaUser.id,
        barbeariaId: barbeariaB.id,
        telefone: '(11) 98888-1111'
      }
    });
  }
  console.log('✅ Cliente criada (Barbearia B): Mariana Souza');

  // 4. Cliente na Garoa Barbearia ("Maria Silva")
  const garoa = await prisma.barbearia.findUnique({
    where: { slug: 'garoa-barbearia' }
  });
  
  if (garoa) {
    const mariaUser = await prisma.usuario.upsert({
      where: { email_barbeariaId: { email: 'maria.silva@email.com', barbeariaId: garoa.id } },
      update: {},
      create: { nome: 'Maria Silva', email: 'maria.silva@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: garoa.id },
    });

    const mariaCliente = await prisma.cliente.findFirst({
      where: { usuarioId: mariaUser.id, barbeariaId: garoa.id }
    });

    if (!mariaCliente) {
      await prisma.cliente.create({
        data: {
          usuarioId: mariaUser.id,
          barbeariaId: garoa.id,
          telefone: '(11) 99999-2222'
        }
      });
    }
    console.log('✅ Cliente criada (Garoa): Maria Silva');
  } else {
    console.log('⚠️ Garoa Barbearia não encontrada, pulei a criação da Maria Silva.');
  }

  console.log('\n🎉 Seed multitenant concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed multitenant:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
