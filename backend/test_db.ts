import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from './src/lib/prisma';
prisma.barbeiro.findMany({ include: { usuario: true } }).then(b => {
  console.log('Total barbeiros:', b.length);
  console.log(b);
}).catch(console.error).finally(() => process.exit(0));
