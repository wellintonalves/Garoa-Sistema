// Seed — dados iniciais para o banco de dados
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // 0. Barbearia
  const barbearia = await prisma.barbearia.upsert({
    where: { slug: 'garoa-barbearia' },
    update: {},
    create: {
      nome: 'Garoa Barbearia',
      slug: 'garoa-barbearia',
      telefone: '(11) 99999-9999',
      endereco: 'Rua Exemplo, 123',
    },
  });
  const bId = barbearia.id;
  console.log('✅ Barbearia criada:', barbearia.nome);

  // 1. Admin
  const senhaAdmin = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'admin@barbearia.com', barbeariaId: bId } },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@barbearia.com',
      senha: senhaAdmin,
      papel: 'ADMIN',
      barbeariaId: bId,
    },
  });
  console.log('✅ Admin criado:', admin.email);

  // 2. Barbeiros
  const senhaBarbeiro = await bcrypt.hash('Barber123!', 10);

  const barbeiro1User = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'carlos@barbearia.com', barbeariaId: bId } },
    update: {},
    create: { nome: 'Carlos Silva', email: 'carlos@barbearia.com', senha: senhaBarbeiro, papel: 'BARBEIRO', barbeariaId: bId },
  });
  const barbeiro1 = await prisma.barbeiro.upsert({
    where: { usuarioId: barbeiro1User.id },
    update: {},
    create: { usuarioId: barbeiro1User.id, barbeariaId: bId, especialidades: ['Corte Degradê', 'Barba'], comissaoPercent: 50 },
  });

  const barbeiro2User = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'rafael@barbearia.com', barbeariaId: bId } },
    update: {},
    create: { nome: 'Rafael Santos', email: 'rafael@barbearia.com', senha: senhaBarbeiro, papel: 'BARBEIRO', barbeariaId: bId },
  });
  const barbeiro2 = await prisma.barbeiro.upsert({
    where: { usuarioId: barbeiro2User.id },
    update: {},
    create: { usuarioId: barbeiro2User.id, barbeariaId: bId, especialidades: ['Platinado', 'Pigmentação'], comissaoPercent: 55 },
  });

  const barbeiro3User = await prisma.usuario.upsert({
    where: { email_barbeariaId: { email: 'lucas@barbearia.com', barbeariaId: bId } },
    update: {},
    create: { nome: 'Lucas Oliveira', email: 'lucas@barbearia.com', senha: senhaBarbeiro, papel: 'BARBEIRO', barbeariaId: bId },
  });
  const barbeiro3 = await prisma.barbeiro.upsert({
    where: { usuarioId: barbeiro3User.id },
    update: {},
    create: { usuarioId: barbeiro3User.id, barbeariaId: bId, especialidades: ['Corte Social', 'Sobrancelha'], comissaoPercent: 45 },
  });
  console.log('✅ 3 barbeiros criados');

  // 3. Serviços
  const servicos = await Promise.all([
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Corte Masculino', descricao: 'Corte na máquina e tesoura', preco: 45.00, duracaoMinutos: 30, comissaoPercent: 50 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Barba', descricao: 'Barba na navalha com toalha quente', preco: 35.00, duracaoMinutos: 20, comissaoPercent: 50 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Combo Corte + Barba', descricao: 'Corte completo + barba', preco: 70.00, duracaoMinutos: 45, comissaoPercent: 50 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Hidratação Capilar', descricao: 'Tratamento de hidratação profunda', preco: 50.00, duracaoMinutos: 30, comissaoPercent: 40 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Pigmentação de Barba', descricao: 'Pigmentação para cobrir falhas', preco: 80.00, duracaoMinutos: 40, comissaoPercent: 45 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Design de Sobrancelha', descricao: 'Desenho e alinhamento', preco: 25.00, duracaoMinutos: 15, comissaoPercent: 50 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Corte Infantil', descricao: 'Corte para crianças até 12 anos', preco: 35.00, duracaoMinutos: 25, comissaoPercent: 50 } }),
    prisma.servico.create({ data: { barbeariaId: bId, nome: 'Platinado', descricao: 'Descoloração completa', preco: 120.00, duracaoMinutos: 60, comissaoPercent: 40 } }),
  ]);
  console.log('✅ 8 serviços criados');

  // 4. Clientes
  const senhaCliente = await bcrypt.hash('Cliente123!', 10);

  const clientes = await Promise.all([
    prisma.usuario.create({ data: { nome: 'João Pedro', email: 'joao@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: bId } }),
    prisma.usuario.create({ data: { nome: 'Marcos Vinícius', email: 'marcos@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: bId } }),
    prisma.usuario.create({ data: { nome: 'Felipe Souza', email: 'felipe@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: bId } }),
    prisma.usuario.create({ data: { nome: 'Gustavo Lima', email: 'gustavo@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: bId } }),
    prisma.usuario.create({ data: { nome: 'André Costa', email: 'andre@email.com', senha: senhaCliente, papel: 'CLIENTE', barbeariaId: bId } }),
  ]);

  const clientesDb = await Promise.all(
    clientes.map((c, i) =>
      prisma.cliente.create({
        data: {
          usuarioId: c.id,
          barbeariaId: bId,
          telefone: `(11) 9${9000 + i}-${1000 + i}`,
          observacoes: i === 0 ? 'Cliente fiel, vem toda semana' : undefined,
        },
      })
    )
  );
  console.log('✅ 5 clientes criados');

  // 5. Agendamentos — distribuídos na semana atual
  const hoje = new Date();
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - hoje.getDay() + 1); // Segunda-feira da semana

  const barbeiros = [barbeiro1, barbeiro2, barbeiro3];

  const agendamentosData = [
    { clienteIdx: 0, barbeiroIdx: 0, servicoIdx: 0, diaOffset: 0, hora: 9, status: 'CONCLUIDO' as const },
    { clienteIdx: 1, barbeiroIdx: 1, servicoIdx: 2, diaOffset: 0, hora: 10, status: 'CONCLUIDO' as const },
    { clienteIdx: 2, barbeiroIdx: 0, servicoIdx: 1, diaOffset: 1, hora: 14, status: 'CONCLUIDO' as const },
    { clienteIdx: 3, barbeiroIdx: 2, servicoIdx: 0, diaOffset: 1, hora: 15, status: 'CONFIRMADO' as const },
    { clienteIdx: 4, barbeiroIdx: 1, servicoIdx: 3, diaOffset: 2, hora: 9, status: 'CONFIRMADO' as const },
    { clienteIdx: 0, barbeiroIdx: 0, servicoIdx: 4, diaOffset: 2, hora: 11, status: 'AGUARDANDO' as const },
    { clienteIdx: 1, barbeiroIdx: 2, servicoIdx: 5, diaOffset: 3, hora: 10, status: 'AGUARDANDO' as const },
    { clienteIdx: 2, barbeiroIdx: 1, servicoIdx: 6, diaOffset: 3, hora: 14, status: 'AGUARDANDO' as const },
    { clienteIdx: 3, barbeiroIdx: 0, servicoIdx: 7, diaOffset: 4, hora: 9, status: 'AGUARDANDO' as const },
    { clienteIdx: 4, barbeiroIdx: 2, servicoIdx: 2, diaOffset: 4, hora: 16, status: 'CANCELADO' as const },
  ];

  for (const ag of agendamentosData) {
    const dataHora = new Date(segunda);
    dataHora.setDate(segunda.getDate() + ag.diaOffset);
    dataHora.setHours(ag.hora, 0, 0, 0);

    await prisma.agendamento.create({
      data: {
        barbeariaId: bId,
        clienteId: clientesDb[ag.clienteIdx].id,
        barbeiroId: barbeiros[ag.barbeiroIdx].id,
        servicoId: servicos[ag.servicoIdx].id,
        dataHora,
        status: ag.status,
        valorCobrado: servicos[ag.servicoIdx].preco,
      },
    });
  }
  console.log('✅ 10 agendamentos criados');

  // 6. Lançamentos financeiros
  const lancamentos = [
    { tipo: 'ENTRADA' as const, categoria: 'Serviço', descricao: 'Corte Masculino - João Pedro', valor: 45.00, formaPagamento: 'PIX' as const, diaOffset: 0 },
    { tipo: 'ENTRADA' as const, categoria: 'Serviço', descricao: 'Combo Corte + Barba - Marcos', valor: 70.00, formaPagamento: 'CARTAO_CREDITO' as const, diaOffset: 0 },
    { tipo: 'SAIDA' as const, categoria: 'Produto', descricao: 'Compra de pomada modeladora', valor: 120.00, formaPagamento: 'CARTAO_DEBITO' as const, diaOffset: 1 },
    { tipo: 'ENTRADA' as const, categoria: 'Serviço', descricao: 'Barba - Felipe Souza', valor: 35.00, formaPagamento: 'DINHEIRO' as const, diaOffset: 1 },
    { tipo: 'SAIDA' as const, categoria: 'Despesa fixa', descricao: 'Conta de energia', valor: 250.00, formaPagamento: 'PIX' as const, diaOffset: 2 },
  ];

  for (const lanc of lancamentos) {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + lanc.diaOffset);

    await prisma.lancamentoFinanceiro.create({
      data: {
        barbeariaId: bId,
        tipo: lanc.tipo,
        categoria: lanc.categoria,
        descricao: lanc.descricao,
        valor: lanc.valor,
        formaPagamento: lanc.formaPagamento,
        data,
      },
    });
  }
  console.log('✅ 5 lançamentos financeiros criados');

  // 7. Estoque
  await Promise.all([
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Pomada Modeladora', quantidade: 15, unidade: 'unidade', quantidadeMinima: 5, custo: 25.00 } }),
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Shampoo Profissional', quantidade: 8, unidade: 'litro', quantidadeMinima: 3, custo: 45.00 } }),
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Lâmina de Barbear', quantidade: 50, unidade: 'unidade', quantidadeMinima: 20, custo: 2.50 } }),
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Toalha Descartável', quantidade: 3, unidade: 'pacote', quantidadeMinima: 5, custo: 18.00 } }),
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Óleo para Barba', quantidade: 12, unidade: 'unidade', quantidadeMinima: 4, custo: 35.00 } }),
    prisma.estoque.create({ data: { barbeariaId: bId, nome: 'Descolorante', quantidade: 2, unidade: 'unidade', quantidadeMinima: 3, custo: 55.00 } }),
  ]);
  console.log('✅ 6 itens de estoque criados');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('📧 Login admin: admin@barbearia.com / Admin123!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
