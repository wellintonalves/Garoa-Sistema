// Uso:
//   npx tsx scripts/limpar-barbeiros-teste.ts <slugDaBarbearia>          -> dry-run
//   npx tsx scripts/limpar-barbeiros-teste.ts <slugDaBarbearia> --apply  -> executa
import { prisma } from '../src/lib/prisma';

async function main() {
  const slug = process.argv[2];
  const apply = process.argv.includes('--apply');
  if (!slug) throw new Error('Informe o slug da barbearia');

  const barbearia = await prisma.barbearia.findUnique({ where: { slug } });
  if (!barbearia) throw new Error(`Barbearia com slug "${slug}" não encontrada`);

  const barbeiros = await prisma.barbeiro.findMany({
    where: { barbeariaId: barbearia.id },
    include: { usuario: { select: { id: true, nome: true, email: true } }, _count: { select: { agendamentos: true } } },
  });

  console.log(`Barbearia: ${barbearia.nome} (${barbearia.id})`);
  console.table(barbeiros.map(b => ({
    barbeiroId: b.id, nome: b.usuario.nome, email: b.usuario.email,
    ativo: b.ativo, agendamentos: b._count.agendamentos,
  })));

  if (!apply) { console.log('\nDRY-RUN. Rode com --apply para apagar.'); return; }

  // Apagar o Usuario remove o Barbeiro em cascata (onDelete: Cascade)
  const ids = barbeiros.map(b => b.usuario.id);
  const r = await prisma.usuario.deleteMany({ where: { id: { in: ids }, papel: 'BARBEIRO' } });
  console.log(`\n${r.count} barbeiro(s) removido(s) definitivamente.`);
}

main().finally(() => prisma.$disconnect());
