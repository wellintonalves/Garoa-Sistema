import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const agendamento = await prisma.agendamento.findUnique({
    where: { id: '4d4a8561-d8ad-49b7-b46a-e36989a2c55a' },
    include: {
      servico: true,
      lancamentos: true
    }
  });
  
  if (agendamento) {
    const servicosExtra = await prisma.servico.findMany({
      where: { id: { in: agendamento.servicosIds } }
    });
    console.log("=== AGENDAMENTO 4d4a8561 ===");
    console.log(`valorCobrado no agendamento: ${agendamento.valorCobrado}`);
    console.log(`valorBruto no agendamento: ${agendamento.valorBruto}`);
    console.log(`lancamentos: ${JSON.stringify(agendamento.lancamentos, null, 2)}`);
    console.log(`servicosIds: ${JSON.stringify(agendamento.servicosIds)}`);
    console.log(`preços dos serviços na DB: ${servicosExtra.map(s => s.preco).join(', ')}`);
  }

  // question 1.3: how many have more than one service and are completed
  const multipleServices = await prisma.agendamento.findMany({
    where: {
      status: 'CONCLUIDO'
    },
    include: {
      lancamentos: true
    }
  });
  
  const affected = multipleServices.filter(a => a.servicosIds.length > 1);
  console.log("\n=== AFETADOS ===");
  console.log("Affected count:", affected.length);
  for (const aff of affected) {
    console.log(`ID: ${aff.id}, ValorCobrado: ${aff.valorCobrado}, ServicosIds count: ${aff.servicosIds.length}, Lancamentos: ${aff.lancamentos.map(l => l.valor).join(', ')}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
