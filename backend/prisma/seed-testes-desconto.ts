import { PrismaClient, Papel, TipoTransacaoPontos, StatusAgendamento, TipoDesconto } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- INICIANDO SEED DE TESTES DE DESCONTO ---');

  // 1. Obter barbearia padrão
  const barbearia = await prisma.barbearia.findFirst();
  if (!barbearia) {
    throw new Error('Nenhuma barbearia encontrada. Rode o seed principal antes.');
  }

  // 2. Configuração de fidelidade
  console.log('Configurando regras de fidelidade...');
  await prisma.configuracaoFidelidade.upsert({
    where: { barbeariaId: barbearia.id },
    create: {
      barbeariaId: barbearia.id,
      ativo: true,
      resgatePontosAtivo: true,
      valorPorPonto: 0.10,
      percentualMaxPontos: 30,
      descontoMaxReais: 0,
      descontoMaxPercentual: 100,
      permitirCombinarDescontos: false,
    },
    update: {
      ativo: true,
      resgatePontosAtivo: true,
      valorPorPonto: 0.10,
      percentualMaxPontos: 30,
      descontoMaxReais: 0,
      descontoMaxPercentual: 100,
      permitirCombinarDescontos: false,
    }
  });

  // 3. Criar Serviços
  console.log('Criando serviços de teste...');
  const servicosData = [
    { nome: 'Corte social', preco: 35.00 },
    { nome: 'Corte simples', preco: 10.00 },
    { nome: 'Combo completo', preco: 33.33 },
    { nome: 'Barba + corte', preco: 80.00 },
  ];

  const servicos: Record<string, string> = {};
  for (const s of servicosData) {
    // Busca se já existe com esse nome para não duplicar, ou cria
    let serv = await prisma.servico.findFirst({
      where: { nome: s.nome, preco: s.preco, barbeariaId: barbearia.id }
    });
    if (!serv) {
      serv = await prisma.servico.create({
        data: {
          nome: s.nome,
          preco: s.preco,
          duracaoMinutos: 30,
          barbeariaId: barbearia.id,
          ativo: true
        }
      });
    }
    servicos[s.nome] = serv.id;
  }

  // 4. Barbeiros
  console.log('Obtendo barbeiros para os testes...');
  const barbeiros = await prisma.barbeiro.findMany({
    where: { barbeariaId: barbearia.id }
  });
  if (barbeiros.length === 0) {
    throw new Error('Nenhum barbeiro encontrado.');
  }

  // 5. Clientes e Pontos
  console.log('Garantindo clientes e seus saldos de pontos...');
  const clientesData = [
    { nome: 'Cliente A (Teste)', email: 'clientea@teste.com', pontos: 240 },
    { nome: 'Cliente B (Teste)', email: 'clienteb@teste.com', pontos: 0 },
    { nome: 'Cliente C (Teste)', email: 'clientec@teste.com', pontos: 20 },
    { nome: 'Cliente D (Teste)', email: 'cliented@teste.com', pontos: 5000 },
  ];

  const clientesIds: Record<string, string> = {};
  const senhaHash = await bcrypt.hash('senha123', 10);

  for (const c of clientesData) {
    let user = await prisma.usuario.findFirst({ where: { email: c.email } });
    
    if (!user) {
      user = await prisma.usuario.create({
        data: {
          nome: c.nome,
          email: c.email,
          senha: senhaHash,
          papel: Papel.CLIENTE,
          barbeariaId: barbearia.id,
          cliente: {
            create: {
              barbeariaId: barbearia.id,
              telefone: '11999999999'
            }
          }
        },
        include: { cliente: true }
      });
    }

    const clienteId = user.cliente?.id || (await prisma.cliente.findUnique({ where: { usuarioId: user.id } }))!.id;
    clientesIds[c.nome.split(' ')[1]] = clienteId; 

    // Limpar histórico antigo dos clientes de teste para garantir o saldo exato
    await prisma.pontoFidelidade.deleteMany({
      where: { clienteId }
    });

    if (c.pontos > 0) {
      await prisma.pontoFidelidade.create({
        data: {
          clienteId,
          barbeariaId: barbearia.id,
          tipo: TipoTransacaoPontos.AJUSTE_MANUAL,
          pontos: c.pontos,
          saldoApos: c.pontos,
          descricao: 'Ajuste inicial para seed de testes de desconto'
        }
      });
    }
  }

  // 6. Limpar agendamentos anteriores
  console.log('Limpando agendamentos de testes anteriores...');
  await prisma.agendamento.deleteMany({
    where: { observacoes: { contains: 'TESTE-DESCONTO' } }
  });

  // 7. Criar Agendamentos
  console.log('Criando novos agendamentos de teste (distribuídos)...');
  
  const cenarios = [
    { clienteLetra: 'A', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'B', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'C', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'D', servico: 'Corte simples', preco: 10.00 },
    { clienteLetra: 'A', servico: 'Combo completo', preco: 33.33 },
    { clienteLetra: 'D', servico: 'Barba + corte', preco: 80.00 },
  ];

  let barbeiroIndex = 0;
  
  // Vamos começar às 09:00 de hoje
  const dataBase = new Date();
  dataBase.setHours(9, 0, 0, 0);

  // Nós temos 18 agendamentos. Para distribuir sem sobrepor no mesmo barbeiro, 
  // podemos avançar 30 mins e rodar o barbeiro.
  let slotMinutos = 0;

  for (const cenario of cenarios) {
    const clienteId = clientesIds[cenario.clienteLetra];
    const servicoId = servicos[cenario.servico];

    for (let i = 0; i < 3; i++) {
      const barbeiro = barbeiros[barbeiroIndex % barbeiros.length];
      
      const dataHora = new Date(dataBase);
      dataHora.setMinutes(dataHora.getMinutes() + slotMinutos);

      await prisma.agendamento.create({
        data: {
          barbeariaId: barbearia.id,
          clienteId,
          barbeiroId: barbeiro.id,
          servicoId,
          dataHora,
          status: StatusAgendamento.AGUARDANDO,
          observacoes: `[TESTE-DESCONTO] Cenario: Cliente ${cenario.clienteLetra} + ${cenario.servico}`,
          valorCobrado: cenario.preco,
          origem: 'SISTEMA',
        }
      });
      
      barbeiroIndex++;
      slotMinutos += 30; // 30 min de incremento global garante que não sobreponha 
    }
  }

  console.log('--- SEED DE TESTES DE DESCONTO CONCLUÍDO COM SUCESSO ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
