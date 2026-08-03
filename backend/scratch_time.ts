import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getHoraMinutoBrasilia } from './src/lib/timezone';

const prisma = new PrismaClient();

async function main() {
  const agendamentos = await prisma.agendamento.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { cliente: true, servico: true }
  });

  for (const ag of agendamentos) {
    console.log(`[${ag.id}] Cliente: ${ag.cliente?.nome}, DataHora (DB): ${ag.dataHora.toISOString()}`);
    const agDate = new Date(ag.dataHora);
    const agHM = getHoraMinutoBrasilia(agDate);
    console.log(`  -> getHoraMinutoBrasilia: ${agHM.hora}:${agHM.minuto}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
