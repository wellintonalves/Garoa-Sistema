require("./integration-env.cjs").configure();
const { chromium, webkit } = require("../.qa/node_modules/playwright"),
  { PrismaClient } = require("@prisma/client"),
  jwt = require("jsonwebtoken"),
  assert = require("node:assert/strict"),
  fs = require("fs");
const f = JSON.parse(fs.readFileSync(".tmp/integration-fixtures.json", "utf8")),
  db = new PrismaClient(),
  base = "http://127.0.0.1:3001";
const results = [];
let token;
async function api(path, method = "GET", body, auth = token) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: "Bearer " + auth } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json() };
}
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, status: "passed" });
    console.log("PASS", name);
  } catch (e) {
    results.push({ name, status: "failed", error: e.message });
    console.log("FAIL", name, e.message);
  }
}
(async () => {
  await test("Autenticação real, senha incorreta, token inválido e acesso sem token", async () => {
    assert.equal(
      (await api("/barbeiro/perfil", "GET", null, null)).status,
      401,
    );
    assert.equal(
      (await api("/barbeiro/perfil", "GET", null, "invalid")).status,
      401,
    );
    assert.equal(
      (
        await api(
          "/barbeiro/login",
          "POST",
          { email: f.main.email, senha: "wrong" },
          null,
        )
      ).status,
      401,
    );
    const login = await api(
      "/barbeiro/login",
      "POST",
      { email: f.main.email.toUpperCase(), senha: f.password },
      null,
    );
    assert.equal(login.status, 200);
    token = login.data.token;
    assert.equal(login.data.barbeiro.barbeiroId, f.main.id);
  });
  await test("Isolamento de agenda, bloqueios e conclusão entre profissionais/unidades", async () => {
    const list = await api("/barbeiro/agenda?data=" + f.today);
    assert.equal(list.status, 200);
    assert.equal(list.data.length, 2);
    assert(list.data.every((a) => a.barbeiroId === f.main.id));
    assert.equal(
      (
        await api(
          "/barbeiro/concluir-agendamento/" + f.appointments[2].id,
          "POST",
          { formaPagamento: "PIX" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await api(
          "/barbeiro/concluir-agendamento/" + f.appointments[3].id,
          "POST",
          { formaPagamento: "PIX" },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await api("/bloqueios", "POST", {
          barbeiroId: f.colleague.id,
          dataInicio: "2099-10-05T12:00:00-03:00",
          dataFim: "2099-10-05T13:00:00-03:00",
        })
      ).status,
      403,
    );
    assert.equal((await api("/fidelidade/configuracao")).status, 403);
    assert.equal(
      (
        await api(
          "/fidelidade/clientes/" +
            f.appointments[3].clienteId +
            "/saldo?valorServico=80",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await api(
          "/agendamentos/" + f.appointments[3].id + "/simular-desconto",
          "POST",
          { tipoDesconto: "NENHUM" },
        )
      ).status,
      400,
    );
  });
  await test("CORS permite PATCH usado na disponibilidade do barbeiro", async () => {
    const r = await fetch(base + "/barbeiro/status-trabalho", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:5189",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "authorization,content-type",
      },
    });
    assert(
      r.headers.get("access-control-allow-methods")?.includes("PATCH"),
      "PATCH ausente no CORS",
    );
  });
  await test("CRUD real de agendamento auxiliar, conflito e cancelamento persistido", async () => {
    const adminToken = jwt.sign(
      {
        ...f.admin,
        nome: "Gestora Alameda",
        email: "gestora@barber-qa.invalid",
        papel: "ADMIN",
      },
      process.env.JWT_SECRET,
    );
    const body = {
      clienteId: f.appointments[0].clienteId,
      barbeiroId: f.main.id,
      servicoId: f.services[0].id,
      dataHora: "2099-10-05T10:00:00-03:00",
    };
    const created = await api("/agendamentos", "POST", body, adminToken);
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.equal(
      (await api("/agendamentos", "POST", body, adminToken)).status,
      400,
    );
    const changed = await api(
      "/agendamentos/" + created.data.id,
      "PUT",
      { observacoes: "Preferência: acabamento natural" },
      adminToken,
    );
    assert.equal(changed.status, 200);
    assert.equal(
      (await db.agendamento.findUnique({ where: { id: created.data.id } }))
        .observacoes,
      "Preferência: acabamento natural",
    );
    assert.equal(
      (
        await api(
          "/agendamentos/" + created.data.id,
          "DELETE",
          null,
          adminToken,
        )
      ).status,
      200,
    );
    assert.equal(
      (await db.agendamento.findUnique({ where: { id: created.data.id } }))
        .status,
      "CANCELADO",
    );
  });
  const isWebkit = process.env.BARBER_QA_BROWSER === "webkit";
  const browser = await (isWebkit ? webkit : chromium).launch(
    isWebkit ? { headless: true } : { channel: "msedge", headless: true },
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: "America/Sao_Paulo",
  });
  await context.route("**/*", (route) => {
    const u = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(u.hostname)
      ? route.continue()
      : route.abort();
  });
  const p = await context.newPage();
  const runtime = [];
  p.on("pageerror", (e) => runtime.push(e.message));
  const go = async (path) => {
    await p.goto("http://127.0.0.1:5189/barbeiro/" + path);
    await p.locator("h1:visible").first().waitFor();
  };
  await test("Login de navegador real e perfil/horários persistem após recarregar", async () => {
    await go("login");
    await p.getByLabel("Email", { exact: true }).fill(f.main.email);
    await p.getByLabel("Senha", { exact: true }).fill(f.password);
    await p.getByRole("button", { name: "Entrar como barbeiro" }).click();
    await p.waitForURL("**/hoje");
    await go("perfil");
    await p.getByRole("button", { name: "Editar perfil" }).click();
    const d = p.getByRole("dialog");
    await d.getByLabel("Nome de exibição").fill("Rafael Almeida QA");
    await d.getByLabel("Telefone", { exact: true }).fill("(11) 98888-1234");
    await d.getByRole("button", { name: "Salvar perfil" }).click();
    await d.waitFor({ state: "hidden" });
    await p.reload();
    await p
      .getByRole("heading", { name: "Rafael Almeida QA", exact: true })
      .waitFor();
    const barber = await db.barbeiro.findUnique({
      where: { id: f.main.id },
      include: { usuario: true },
    });
    assert.equal(barber.usuario.nome, "Rafael Almeida QA");
    assert.equal(barber.telefone, "(11) 98888-1234");
    await p.getByText("Horários de trabalho", { exact: true }).click();
    await p.getByLabel("Início Segunda-feira", { exact: true }).fill("09:30");
    await p.getByRole("button", { name: "Salvar horários" }).click();
    await p
      .getByText("Horários salvos e aplicados à agenda.", { exact: true })
      .waitFor();
    assert.equal(
      (await db.barbeiro.findUnique({ where: { id: f.main.id } }))
        .horariosTrabalho.segunda.abertura,
      "09:30",
    );
  });
  await test("Disponibilidade real persiste com preflight do navegador", async () => {
    await go("hoje");
    await p.getByRole("checkbox").click();
    await p
      .getByText("Você está ausente.", { exact: true })
      .waitFor({ timeout: 8000 });
    assert.equal(
      (await db.barbeiro.findUnique({ where: { id: f.main.id } }))
        .trabalhandoAgora,
      false,
    );
  });
  await test("Bloqueio criado/excluído pela interface persiste no PostgreSQL", async () => {
    await go("agenda");
    await p
      .getByRole("button", { name: "Bloquear horário", exact: true })
      .click();
    const d = p.getByRole("dialog");
    await d.getByLabel("Data do bloqueio").fill("2099-10-05");
    await d.getByLabel("Início", { exact: true }).fill("12:30");
    await d.getByLabel("Fim", { exact: true }).fill("13:30");
    await d.getByLabel("Motivo (opcional)").fill("Almoço de homologação");
    await d.getByRole("button", { name: "Confirmar bloqueio" }).click();
    await d.waitFor({ state: "hidden" });
    await p.getByText("Almoço de homologação", { exact: true }).waitFor();
    assert.equal(
      await db.bloqueioAgenda.count({
        where: { barbeiroId: f.main.id, motivo: "Almoço de homologação" },
      }),
      1,
    );
    await p.reload();
    await p.locator("input[type=date]").fill("2099-10-05");
    await p
      .getByRole("button", { name: "Remover bloqueio", exact: true })
      .click();
    await d.locator("input").fill("Almoço de homologação");
    await d
      .getByRole("button", { name: "Remover bloqueio", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    assert.equal(
      await db.bloqueioAgenda.count({
        where: { barbeiroId: f.main.id, motivo: "Almoço de homologação" },
      }),
      0,
    );
  });
  await test("Checkout real: simulação, desconto/pontos, lançamento, comissão e repetição", async () => {
    await go("hoje");
    await p
      .getByRole("button", { name: "Concluir atendimento de Lucas Ferreira" })
      .click();
    const d = p.getByRole("dialog");
    await d.getByText("Total a registrar", { exact: true }).waitFor();
    await d.getByLabel("Desconto", { exact: true }).selectOption("REAIS");
    await d.getByLabel("Desconto em reais", { exact: true }).fill("10");
    await d.getByLabel("Pontos a utilizar").fill("5");
    await d.getByRole("button", { name: "Dinheiro", exact: true }).click();
    if (await d.getByRole("checkbox").count())
      await d.getByRole("checkbox").check();
    await d.getByRole("button", { name: "Confirmar conclusão" }).click();
    await d.waitFor({ state: "hidden" });
    await p
      .getByText("Atendimento concluído. Agenda e comissões atualizadas.", {
        exact: true,
      })
      .waitFor();
    const a = await db.agendamento.findUnique({
      where: { id: f.appointments[0].id },
      include: { lancamentos: true },
    });
    assert.equal(a.status, "CONCLUIDO");
    assert.equal(Number(a.valorCobrado), 65);
    assert.equal(a.pontosUtilizados, 5);
    assert.equal(a.lancamentos.length, 1);
    assert.equal(Number(a.lancamentos[0].valorComissao), 32.5);
    assert.equal(
      (
        await api("/barbeiro/concluir-agendamento/" + a.id, "POST", {
          formaPagamento: "PIX",
        })
      ).status,
      409,
    );
    assert.equal(
      await db.lancamentoFinanceiro.count({ where: { agendamentoId: a.id } }),
      1,
    );
    await go("comissoes");
    await p.locator("td").filter({ hasText: "Lucas Ferreira" }).waitFor();
    assert.equal(
      (await api("/barbeiro/comissoes?inicio=" + f.today + "&fim=" + f.today))
        .data.valorComissao,
      32.5,
    );
  });
  await test("Rejeição de aprovação persiste e não altera lançamento", async () => {
    const row = await db.lancamentoFinanceiro.findFirstOrThrow({
      where: { agendamentoId: f.appointments[0].id },
    });
    const approval = await db.aprovacaoEdicao.create({
      data: {
        barbeiroId: f.main.id,
        lancamentoId: row.id,
        acao: "EDITAR",
        dadosNovos: { valor: 60 },
      },
    });
    await go("hoje");
    await p.getByRole("button", { name: "Revisar solicitação" }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Rejeitar" })
      .click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await db.aprovacaoEdicao.findUnique({ where: { id: approval.id } }))
        .status,
      "REJEITADO",
    );
    assert.equal(
      Number(
        (await db.lancamentoFinanceiro.findUnique({ where: { id: row.id } }))
          .valor,
      ),
      65,
    );
  });

  await test("Aprovação real atualiza pagamento e preserva valor financeiro", async () => {
    const row = await db.lancamentoFinanceiro.findFirstOrThrow({
      where: { agendamentoId: f.appointments[0].id },
    });
    const approval = await db.aprovacaoEdicao.create({
      data: {
        barbeiroId: f.main.id,
        lancamentoId: row.id,
        acao: "EDITAR",
        dadosNovos: { formaPagamento: "PIX" },
      },
    });
    await go("hoje");
    await p.getByRole("button", { name: "Revisar solicitação" }).click();
    await p
      .getByRole("dialog")
      .getByRole("button", { name: "Aprovar", exact: true })
      .click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal(
      (await db.aprovacaoEdicao.findUnique({ where: { id: approval.id } }))
        .status,
      "APROVADO",
    );
    const saved = await db.lancamentoFinanceiro.findUnique({
      where: { id: row.id },
    });
    assert.equal(saved.formaPagamento, "PIX");
    assert.equal(Number(saved.valor), 65);
  });
  await test("Foto maior que 2MB bloqueada antes da API e erro de storage tratado", async () => {
    await go("perfil");
    let uploads = 0;
    p.on("request", (r) => {
      if (r.url().endsWith("/barbeiro/foto")) uploads++;
    });
    await p
      .locator("input[type=file]")
      .setInputFiles({
        name: "large.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
      });
    await p
      .getByText("Escolha uma foto JPG, PNG ou WebP de até 2 MB.", {
        exact: true,
      })
      .waitFor();
    assert.equal(uploads, 0);
    await p
      .locator("input[type=file]")
      .setInputFiles({
        name: "portrait.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7s8AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await p
      .getByRole("alert")
      .filter({ hasText: "Erro no servidor" })
      .waitFor();
    assert.equal(
      (await db.barbeiro.findUnique({ where: { id: f.main.id } })).foto,
      null,
    );
  });
  await test("Navegação rápida com API real", async () => {
    for (let i = 0; i < 2; i++)
      for (const path of ["hoje", "agenda", "comissoes", "perfil"])
        await go(path);
  });
  await test("Runtime integrado sem exceções não tratadas", async () =>
    assert.deepEqual(runtime, []));
  await p.screenshot({
    path: "qa/evidence/integrated-mobile.png",
    fullPage: true,
  });
  await browser.close();
  await db.$disconnect();
  fs.writeFileSync(
    isWebkit
      ? "qa/evidence/integration-webkit-results.json"
      : "qa/evidence/integration-results.json",
    JSON.stringify(results, null, 2),
  );
  process.exitCode = results.some((r) => r.status === "failed") ? 1 : 0;
})().catch(async (e) => {
  console.error(e.message);
  await db.$disconnect();
  process.exit(1);
});
