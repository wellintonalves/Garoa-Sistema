const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const barbearias = await prisma.barbearia.findMany();
  if (!barbearias.length) {
    console.log("No barbearias found.");
    return;
  }
  const barbeariaId = barbearias[0].id;
  console.log("Barbearia ID:", barbeariaId);

  const { ClienteService } = require('./src/services/cliente.service');
  
  // Test resumo
  const resumo = await ClienteService.resumo(barbeariaId);
  console.log("Resumo:", resumo);
  
  // Test listarTodos without filter
  let list = await ClienteService.listarTodos(barbeariaId);
  console.log("List (no filter):", list.length, "clients", list.map(c => c.usuario.nome));

  // Test listarTodos with filter
  list = await ClienteService.listarTodos(barbeariaId, { busca: 'well' });
  console.log("List ('well'):", list.length, "clients", list.map(c => c.usuario.nome));
}

test().catch(console.error).finally(() => prisma.$disconnect());
