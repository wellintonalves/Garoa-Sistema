// AVISO: Este script aponta para o banco configurado no .env (producao, se executado via railway run). NAO execute contra o banco de producao!  
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Buscando Barbearia...');
  const barbearia = await prisma.barbearia.findFirst();
  if (!barbearia) throw new Error('Nenhuma barbearia encontrada');

  console.log(`Usando Barbearia: ${barbearia.id}`);

  // Pegar 3 barbeiros ativos
  const barbeiros = await prisma.barbeiro.findMany({
    where: { barbeariaId: barbearia.id, ativo: true },
    take: 3
  });
  if (barbeiros.length < 3) throw new Error('Menos de 3 barbeiros ativos encontrados na barbearia');

  // Pegar 1 servico
  const servico = await prisma.servico.findFirst({
    where: { barbeariaId: barbearia.id, ativo: true }
  });
  if (!servico) throw new Error('Nenhum serviço encontrado na barbearia');

  // Pegar ou criar 1 cliente de teste
  let cliente = await prisma.cliente.findFirst({
    where: { barbeariaId: barbearia.id, usuario: { nome: '[TESTE] Cliente Lane' } }
  });

  if (!cliente) {
    const usuario = await prisma.usuario.create({
      data: {
        nome: '[TESTE] Cliente Lane',
        email: 'cliente.teste.lane@valenbarber.com.br',
        senhaHash: 'dummy',
        role: 'CLIENTE',
        telefone: '11999999999',
      }
    });
    cliente = await prisma.cliente.create({
      data: {
        usuarioId: usuario.id,
        barbeariaId: barbearia.id,
      }
    });
  }

  const baseDateStr = '2026-08-10'; // Segunda-feira
  
  // 1. 3 agendamentos de barbeiros diferentes as 11:30 no mesmo dia
  const dt1130 = new Date(`${baseDateStr}T11:30:00-03:00`);
  for (let i = 0; i < 3; i++) {
    await prisma.agendamento.create({
      data: {
        dataHora: dt1130,
        status: 'AGUARDANDO',
        origem: 'PRESENCIAL',
        observacoes: 'SEED_LANES_2026_08',
        clienteId: cliente.id,
        barbeiroId: barbeiros[i].id,
        servicoId: servico.id,
        barbeariaId: barbearia.id,
      }
    });
  }
  console.log('Criados 3 agendamentos às 11:30 (Barbeiros diferentes)');

  // 2. 2 agendamentos com sobreposição PARCIAL (11:30-12:00 e 11:45-12:15) no dia 11
  const dt11_1130 = new Date('2026-08-11T11:30:00-03:00');
  const dt11_1145 = new Date('2026-08-11T11:45:00-03:00');
  
  await prisma.agendamento.create({
    data: {
      dataHora: dt11_1130, status: 'AGUARDANDO', origem: 'PRESENCIAL', observacoes: 'SEED_LANES_2026_08',
      clienteId: cliente.id, barbeiroId: barbeiros[0].id, servicoId: servico.id, barbeariaId: barbearia.id
    }
  });
  // Supondo que o servico tenha 30min, o proximo de 30min sobrepoe o primeiro em 15min.
  await prisma.agendamento.create({
    data: {
      dataHora: dt11_1145, status: 'AGUARDANDO', origem: 'PRESENCIAL', observacoes: 'SEED_LANES_2026_08',
      clienteId: cliente.id, barbeiroId: barbeiros[1].id, servicoId: servico.id, barbeariaId: barbearia.id
    }
  });
  console.log('Criados 2 agendamentos com sobreposição parcial no dia 11');

  // 3. 1 dia com 8 agendamentos no mesmo horario (dia 12, 14:00) para testar o "+N"
  const dt12_1400 = new Date('2026-08-12T14:00:00-03:00');
  for (let i = 0; i < 8; i++) {
    // Usamos o barbeiro[0] para todos, simulando a Visão Semana empilhando tudo no mesmo dia
    // Ou barbeiros variados, tanto faz. A visão semana agrupa pelo dia.
    await prisma.agendamento.create({
      data: {
        dataHora: dt12_1400,
        status: 'AGUARDANDO',
        origem: 'PRESENCIAL',
        observacoes: 'SEED_LANES_2026_08',
        clienteId: cliente.id,
        barbeiroId: barbeiros[i % 3].id, // distribui nos 3 barbeiros
        servicoId: servico.id,
        barbeariaId: barbearia.id,
      }
    });
  }
  console.log('Criados 8 agendamentos simultâneos no dia 12 às 14:00');

  // 4. 1 agendamento às 19:30 no dia 13
  const dt13_1930 = new Date('2026-08-13T19:30:00-03:00');
  await prisma.agendamento.create({
    data: {
      dataHora: dt13_1930,
      status: 'AGUARDANDO',
      origem: 'PRESENCIAL',
      observacoes: 'SEED_LANES_2026_08',
      clienteId: cliente.id,
      barbeiroId: barbeiros[0].id,
      servicoId: servico.id,
      barbeariaId: barbearia.id,
    }
  });
  console.log('Criado 1 agendamento às 19:30 no dia 13');

  console.log('Seed de agendamentos finalizado com sucesso.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
