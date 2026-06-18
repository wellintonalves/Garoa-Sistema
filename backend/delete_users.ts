import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.usuario.deleteMany({ where: { emailVerificado: false } })
  .then(r => { console.log('Deletados:', r.count); prisma.$disconnect(); })
  .catch(e => { console.error(e); prisma.$disconnect(); });
