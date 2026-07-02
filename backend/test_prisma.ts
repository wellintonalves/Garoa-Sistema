import { prisma } from './src/lib/prisma';
prisma.barbeiro.findMany().then(b => {
  console.log('Barbeiros: ', b.length);
  console.log(b);
}).catch(console.error).finally(() => process.exit(0));
