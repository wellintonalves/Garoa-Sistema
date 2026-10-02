require("./integration-env.cjs").configure();
const { PrismaClient } = require("@prisma/client"),
  bcrypt = require("bcryptjs"),
  fs = require("fs");
const db = new PrismaClient();
const password = "Only-local-fixture-2026";
(async () => {
  if (process.env.BARBER_QA_RESET === "1") {
    const shops = await db.barbearia.findMany({ select: { slug: true } });
    if (shops.some((s) => !s.slug.startsWith("barber-ui-qa-")))
      throw new Error("Unexpected nonfixture record");
    await db.$executeRawUnsafe("TRUNCATE TABLE barbearias CASCADE");
  }
  if (await db.barbearia.count())
    throw new Error("Expected newly created empty fixture database");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const shops = [];
  for (const [i, name] of [
    "Alameda Homologação",
    "Praça Homologação",
  ].entries()) {
    const shop = await db.barbearia.create({
      data: { nome: name, slug: "barber-ui-qa-" + i },
    });
    shops.push(shop);
    await db.configuracao.create({ data: { barbeariaId: shop.id } });
    await db.configuracaoFidelidade.create({
      data: {
        barbeariaId: shop.id,
        ativo: true,
        resgatePontosAtivo: true,
        valorPorPonto: 1,
        percentualMaxPontos: 30,
        descontoMaxReais: 50,
        permitirCombinarDescontos: true,
      },
    });
  }
  const hash = await bcrypt.hash(password, 10);
  async function barber(shop, name, email) {
    const user = await db.usuario.create({
      data: {
        nome: name,
        email,
        senha: hash,
        papel: "BARBEIRO",
        barbeariaId: shop.id,
      },
    });
    return db.barbeiro.create({
      data: {
        usuarioId: user.id,
        barbeariaId: shop.id,
        especialidades: ["Corte", "Barba"],
        comissaoPercent: 50,
        trabalhandoAgora: true,
      },
      include: { usuario: true },
    });
  }
  const main = await barber(
      shops[0],
      "Rafael Almeida",
      "rafael@barber-qa.invalid",
    ),
    colleague = await barber(shops[0], "Bruno Lima", "bruno@barber-qa.invalid"),
    other = await barber(shops[1], "Carlos Rocha", "carlos@barber-qa.invalid");
  const admin = await db.usuario.create({
    data: {
      nome: "Gestora Alameda",
      email: "gestora@barber-qa.invalid",
      senha: hash,
      papel: "ADMIN",
      barbeariaId: shops[0].id,
    },
  });
  const services = [];
  for (const shop of shops)
    services.push(
      await db.servico.create({
        data: {
          barbeariaId: shop.id,
          nome: "Corte e barba",
          preco: 80,
          duracaoMinutos: 60,
        },
      }),
    );
  const appointments = [];
  for (const [i, name] of [
    "Lucas Ferreira",
    "Marcos Oliveira",
    "Pedro Santos",
    "Cliente outra unidade",
  ].entries()) {
    const shop = shops[i === 3 ? 1 : 0],
      barber = i === 3 ? other : i === 2 ? colleague : main,
      service = services[i === 3 ? 1 : 0];
    const user = await db.usuario.create({
      data: {
        nome: name,
        email: "cliente" + i + "@barber-qa.invalid",
        senha: hash,
        papel: "CLIENTE",
        barbeariaId: shop.id,
      },
    });
    const client = await db.cliente.create({
      data: { usuarioId: user.id, barbeariaId: shop.id },
    });
    await db.clienteBarbearia.create({
      data: { clienteId: client.id, barbeariaId: shop.id },
    });
    await db.pontoFidelidade.create({
      data: {
        clienteId: client.id,
        barbeariaId: shop.id,
        pontos: 100,
        saldoApos: 100,
        descricao: "Saldo fictício de homologação",
        tipo: "AJUSTE_MANUAL",
      },
    });
    appointments.push(
      await db.agendamento.create({
        data: {
          barbeariaId: shop.id,
          clienteId: client.id,
          barbeiroId: barber.id,
          servicoId: service.id,
          servicosIds: [service.id],
          dataHora: new Date(
            today + "T" + ["10:15", "14:00", "16:00", "17:00"][i] + ":00-03:00",
          ),
          status: "CONFIRMADO",
          valorCobrado: 80,
          valorBruto: 80,
          valorLiquido: 80,
        },
      }),
    );
  }
  fs.writeFileSync(
    ".tmp/integration-fixtures.json",
    JSON.stringify(
      {
        today,
        shops: shops.map((s) => ({ id: s.id })),
        main: { id: main.id, email: main.usuario.email },
        colleague: { id: colleague.id, email: colleague.usuario.email },
        other: { id: other.id, email: other.usuario.email },
        admin: { id: admin.id, barbeariaId: admin.barbeariaId },
        services: services.map((s) => ({ id: s.id })),
        appointments: appointments.map((a) => ({
          id: a.id,
          clienteId: a.clienteId,
        })),
        password,
      },
      null,
      2,
    ),
  );
  console.log(
    "Seeded two isolated shops, three barbers and four fictional clients.",
  );
})()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
