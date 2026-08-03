const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const s = await prisma.servico.findFirst({where: {nome: {contains: 'botox', mode: 'insensitive'}}});
  console.log('DURACAO:', s ? s.duracaoMinutos : 'NAO ENCONTRADO');
}
main();
