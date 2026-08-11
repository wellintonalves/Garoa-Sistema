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

  // 4. Barbeiro
  console.log('Garantindo que existe um barbeiro para os testes...');
  let barbeiro = await prisma.barbeiro.findFirst({
    where: { barbeariaId: barbearia.id }
  });
  if (!barbeiro) {
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
    clientesIds[c.nome.split(' ')[1]] = clienteId; // Guarda A, B, C, D

    // Ajustar pontos se necessário
    const historico = await prisma.pontoFidelidade.findMany({
      where: { clienteId }
    });

    let totalAtual = 0;
    for (const h of historico) {
      if (h.tipo === 'ACUMULO' || h.tipo === 'ESTORNO') totalAtual += h.pontos;
      if (h.tipo === 'RESGATE') totalAtual -= h.pontos;
    }

    if (totalAtual !== c.pontos) {
      const diferenca = c.pontos - totalAtual;
      if (diferenca > 0) {
        await prisma.pontoFidelidade.create({
          data: {
            clienteId,
            barbeariaId: barbearia.id,
            tipo: TipoTransacaoPontos.AJUSTE_MANUAL,
            pontos: diferenca,
            saldoApos: c.pontos,
            descricao: 'Ajuste para seed de testes de desconto'
          }
        });
      } else {
        await prisma.pontoFidelidade.create({
          data: {
            clienteId,
            barbeariaId: barbearia.id,
            tipo: TipoTransacaoPontos.AJUSTE_MANUAL, // Usaremos manual e como os pontos em BD são Int, e o sistema pode tratar como resgate?
            // Para não complicar com pontos negativos em schema que talvez não suporte,
            // podemos apenas criar um resgate.
            pontos: Math.abs(diferenca),
            saldoApos: c.pontos,
            descricao: 'Ajuste de redução para seed de testes de desconto'
          }
        });
        // IMPORTANTE: no BD o valen-barber costuma usar aggregate() em vez de saldoApos, mas como vimos a logica soma ACUMULO/ESTORNO e subtrai RESGATE.
        // Se a logica deles suportar AJUSTE_MANUAL, talvez seja tratado diferente. Para garantir, vamos usar ACUMULO/RESGATE dependendo do sinal
        await prisma.pontoFidelidade.updateMany({
           where: { descricao: 'Ajuste de redução para seed de testes de desconto' },
           data: { tipo: TipoTransacaoPontos.RESGATE }
        });
      }
    }
  }

  // 6. Limpar agendamentos anteriores do teste
  console.log('Limpando agendamentos de testes anteriores...');
  await prisma.agendamento.deleteMany({
    where: { observacoes: { contains: 'TESTE-DESCONTO' } }
  });

  // 7. Criar Agendamentos em Aberto (3 de cada)
  console.log('Criando novos agendamentos de teste...');
  const agora = new Date();
  
  const cenarios = [
    { clienteLetra: 'A', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'B', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'C', servico: 'Corte social', preco: 35.00 },
    { clienteLetra: 'D', servico: 'Corte simples', preco: 10.00 },
    { clienteLetra: 'A', servico: 'Combo completo', preco: 33.33 },
    { clienteLetra: 'D', servico: 'Barba + corte', preco: 80.00 },
  ];

  let hrOffset = 1;
  for (const cenario of cenarios) {
    const clienteId = clientesIds[cenario.clienteLetra];
    const servicoId = servicos[cenario.servico];

    for (let i = 0; i < 3; i++) {
      const dataHora = new Date(agora);
      dataHora.setHours(dataHora.getHours() + hrOffset);
      hrOffset++;

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
