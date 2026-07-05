import { PrismaClient } from '@prisma/client';
import { tenantStorage } from './als';

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

const basePrisma = globalParaPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalParaPrisma.prisma = basePrisma;
}

// Extensão para injetar barbeariaId automaticamente em queries que suportam
export const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const store = tenantStorage.getStore();
        const barbeariaId = store?.barbeariaId;

        // Modelos globais ou multi-tenant explícitos que não devem ter isolamento automático rígido
        const ignoredModels = ['Barbearia', 'Usuario', 'Cliente', 'ClienteBarbearia', 'AprovacaoEdicao', 'BloqueioAgenda'];
        
        if (barbeariaId && !ignoredModels.includes(model)) {
          if (['findMany', 'findFirst', 'findUnique', 'count', 'updateMany', 'deleteMany', 'aggregate', 'groupBy'].includes(operation)) {
            (args as any).where = { ...(args as any).where, barbeariaId };
          } else if (['create', 'createMany'].includes(operation)) {
            if (operation === 'create') {
              // Barbeiro usa BarbeiroCreateInput (modo relação, por causa de usuario: { create })
              // Nesse modo, barbeariaId escalar é inválido — deve usar barbearia: { connect }
              if (model === 'Barbeiro') {
                (args as any).data = { ...(args as any).data, barbearia: { connect: { id: barbeariaId } } };
              } else {
                (args as any).data = { ...(args as any).data, barbeariaId };
              }
            } else if (operation === 'createMany' && Array.isArray((args as any).data)) {
              (args as any).data = (args as any).data.map((d: any) => ({ ...d, barbeariaId }));
            }
          } else if (['update', 'upsert', 'delete'].includes(operation)) {
             (args as any).where = { ...(args as any).where, barbeariaId };
          }
        }
        return query(args);
      },
    },
  },
}) as unknown as PrismaClient; // Cast to PrismaClient to avoid TS issues in existing code

