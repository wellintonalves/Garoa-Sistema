// AVISO: Este script aponta para o banco configurado no .env (producao, se executado via railway run). NAO execute contra o banco de producao!  
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Apagando agendamentos de teste...');

  const resultAgendamentos = await prisma.agendamento.deleteMany({
    where: {
      observacoes: 'SEED_LANES_2026_08'
    }
  });
  console.log(`Apagados ${resultAgendamentos.count} agendamentos de teste.`);

  const clienteTeste = await prisma.usuario.findFirst({
    where: { nome: '[TESTE] Cliente Lane' }
  });

  if (clienteTeste) {
    const resultCliente = await prisma.cliente.deleteMany({
      where: { usuarioId: clienteTeste.id }
    });
    console.log(`Apagado ${resultCliente.count} vínculo(s) de cliente de teste.`);

    await prisma.usuario.delete({
      where: { id: clienteTeste.id }
    });
    console.log(`Apagado usuário de teste.`);
  }

  console.log('Limpeza finalizada com sucesso.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
