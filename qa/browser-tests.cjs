const { chromium, webkit } = require("../.qa/node_modules/playwright");
const isWebkit = process.env.BARBER_QA_BROWSER === "webkit";
const shotDir = isWebkit ? "qa/evidence/webkit" : "qa/evidence/after";

const AxeBuilder = require("../.qa/node_modules/@axe-core/playwright").default;
const { fixtures, today, appointments } = require("./fixtures.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const results = [];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await (isWebkit ? webkit : chromium).launch(
    isWebkit ? { headless: true } : { channel: "msedge", headless: true },
  );
  fs.mkdirSync(shotDir, { recursive: true });
  async function test(name, fn, options = {}) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      timezoneId: "America/Sao_Paulo",
    });
    const state = await fixtures(context, options);
    const page = await context.newPage();
    const runtime = [];
    page.on("pageerror", (e) => runtime.push(e.message));
    try {
      await fn(page, state, context);
      assert.deepEqual(runtime, []);
      assert.deepEqual(state.unmocked || [], []);
      results.push({ name, status: "passed" });
      console.log("PASS", name);
    } catch (e) {
      results.push({ name, status: "failed", error: e.message });
      console.log("FAIL", name, e.message.slice(0, 300));
      await page
        .screenshot({
          path: `qa/evidence/failure-${results.length}.png`,
          fullPage: true,
        })
        .catch(() => {});
    } finally {
      await context.close();
    }
  }
  const go = async (p, path, settle = true) => {
    if (settle) await p.waitForLoadState("networkidle");
    await p.goto(`http://127.0.0.1:5189/barbeiro/${path}`, {
      waitUntil: "domcontentloaded",
    });
    await p.locator("h1:visible").first().waitFor();
    if (settle) await p.waitForLoadState("networkidle");
    assert.match(await p.title(), /Valen Barber/);
  };
  const wait = async (p, text) =>
    p.getByText(text, { exact: true }).first().waitFor();
  await test("Responsividade e navegação em 360,375,390,768,1280,1440,1920", async (p, s) => {
    for (const width of [360, 375, 390, 768, 1280, 1440, 1920]) {
      await p.setViewportSize({ width, height: 900 });
      for (const path of ["hoje", "agenda", "comissoes", "perfil", "login"]) {
        await go(p, path);
        await pause(300);
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${width}/${path} overflow`,
        );
        if (width === 375 || width === 768 || width === 1920)
          await p.screenshot({
            path: `${shotDir}/${width}-${path}.png`,
            fullPage: true,
          });
      }
      await go(p, "hoje");
      for (const [label, path] of [
        ["Agenda", "agenda"],
        ["Comissões", "comissoes"],
        ["Perfil", "perfil"],
        ["Hoje", "hoje"],
      ]) {
        await p
          .getByRole("navigation", { name: "Área do barbeiro" })
          .getByRole("link", { name: label, exact: true })
          .click();
        await p.waitForURL(`**/${path}`);
        await p.waitForLoadState("networkidle");
      }
    }
  });
  await test("Agenda inclui horários arbitrários e eventos fora de 08–20h", async (p, s) => {
    s.appointments.push(
      {
        ...structuredClone(appointments[1]),
        id: "early",
        dataHora: `${today}T07:15:00-03:00`,
        cliente: { id: "early-client", usuario: { nome: "Bruno Lima" } },
      },
      {
        ...structuredClone(appointments[1]),
        id: "late",
        dataHora: `${today}T21:45:00-03:00`,
        cliente: { id: "late-client", usuario: { nome: "Felipe Rocha" } },
      },
    );
    await go(p, "agenda");
    await wait(p, "Bruno Lima");
    await wait(p, "Felipe Rocha");
    await wait(p, "07:15");
    await p.getByLabel("Buscar na agenda").fill("Felipe");
    assert.equal(await p.locator(".bb-appointment").count(), 1);
    await p.getByLabel("Buscar na agenda").fill("sem correspondência");
    await wait(p, "Nenhum evento corresponde aos filtros");
    await p.getByRole("button", { name: "limpe os filtros" }).click();
    await p.getByLabel("Exibir", { exact: true }).selectOption("CONCLUIDO");
    assert.equal(await p.locator(".bb-appointment").count(), 1);
    await p.getByLabel("Exibir", { exact: true }).selectOption("TODOS");
    await p.getByRole("button", { name: "Próximo dia", exact: true }).click();
    await wait(p, "Sem eventos neste dia");
    await p.getByRole("button", { name: "Hoje", exact: true }).click();
    await wait(p, "Bruno Lima");
  });
  await test("Criar, cancelar e excluir bloqueio com confirmação, sem duplicar", async (p, s) => {
    await go(p, "agenda");
    await p
      .getByRole("button", { name: "Bloquear horário", exact: true })
      .click();
    const d = p.getByRole("dialog");
    await d.getByLabel("Data do bloqueio").fill("2099-10-03");
    await d.getByLabel("Início", { exact: true }).fill("13:00");
    await d.getByLabel("Fim", { exact: true }).fill("12:00");
    await d.getByRole("button", { name: "Confirmar bloqueio" }).click();
    await wait(p, "O fim deve ser posterior ao início.");
    assert.equal(s.calls.filter((c) => c.method === "POST").length, 0);
    await d.getByLabel("Fim", { exact: true }).fill("14:00");
    await d.getByLabel("Motivo (opcional)").fill("Compromisso pessoal");
    s.fail = "/bloqueios";
    await d.getByRole("button", { name: "Confirmar bloqueio" }).click();
    await d.getByRole("alert").waitFor();
    assert.equal(
      await d.getByLabel("Motivo (opcional)").inputValue(),
      "Compromisso pessoal",
    );
    s.fail = "";
    s.delay = 200;
    await d.getByRole("button", { name: "Confirmar bloqueio" }).click();
    await d.waitFor({ state: "hidden" });
    await wait(p, "Compromisso pessoal");
    assert.equal(
      s.blocks.filter((b) => b.motivo === "Compromisso pessoal").length,
      1,
    );
    await p
      .getByRole("button", { name: "Remover bloqueio", exact: true })
      .click();
    await d.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(
      s.blocks.filter((b) => b.motivo === "Compromisso pessoal").length,
      1,
    );
    await p
      .getByRole("button", { name: "Remover bloqueio", exact: true })
      .click();
    assert(
      await d
        .getByRole("button", { name: "Remover bloqueio", exact: true })
        .isDisabled(),
    );
    await d.locator("input").fill("Compromisso pessoal");
    await d
      .getByRole("button", { name: "Remover bloqueio", exact: true })
      .click();
    await d.waitFor({ state: "hidden" });
    await wait(p, "Sem eventos neste dia");
  });
  await test("Checkout: token barbeiro, descontos, erro preservado e sucesso único", async (p, s) => {
    await go(p, "hoje");
    await p
      .getByRole("button", { name: "Concluir atendimento de Lucas Ferreira" })
      .click();
    const d = p.getByRole("dialog");
    await wait(p, "Total a registrar");
    assert(
      s.calls
        .filter((c) => /saldo|simular-desconto/.test(c.path))
        .every((c) => c.authorization?.startsWith("Bearer ")),
    );
    await d.getByLabel("Desconto", { exact: true }).selectOption("REAIS");
    await d.getByLabel("Desconto em reais", { exact: true }).fill("10");
    await d.getByLabel("Pontos a utilizar").fill("5");
    await pause(600);
    await d.getByRole("button", { name: "Dinheiro", exact: true }).click();
    await p.screenshot({ path: shotDir + "/checkout.png" });
    s.fail = "/concluir-agendamento";
    await d.getByRole("button", { name: "Confirmar conclusão" }).click();
    await d.getByRole("alert").waitFor();
    assert.equal(await d.getByLabel("Desconto em reais").inputValue(), "10");
    s.fail = "";
    s.delay = 150;
    await d.getByRole("button", { name: "Confirmar conclusão" }).click();
    await d.waitFor({ state: "hidden" });
    await wait(p, "Atendimento concluído. Agenda e comissões atualizadas.");
    assert.equal(s.appointments[1].status, "CONCLUIDO");
    const calls = s.calls.filter((c) =>
      c.path.includes("/concluir-agendamento"),
    );
    assert.equal(calls.length, 2);
    assert.equal(calls[1].body.tipoDesconto, "COMBINADO");
    assert.equal(calls[1].body.formaPagamento, "DINHEIRO");
    await p
      .getByRole("button", { name: "Concluir atendimento de Lucas Ferreira" })
      .waitFor({ state: "hidden" });
  });
  await test("Checkout cancela e bloqueia valor antigo durante nova simulação", async (p, s) => {
    await go(p, "hoje");
    await p
      .getByRole("button", { name: "Concluir atendimento de Pedro Santos" })
      .click();
    const d = p.getByRole("dialog");
    await wait(p, "Total a registrar");
    s.delay = 500;
    await d.getByLabel("Desconto", { exact: true }).selectOption("PERCENTUAL");
    await d.getByLabel("Desconto em percentual").fill("15");
    assert(
      await d.getByRole("button", { name: "Confirmar conclusão" }).isDisabled(),
    );
    await d.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(
      s.calls.filter((c) => c.path.includes("/concluir-agendamento")).length,
      0,
    );
    assert.equal(
      await p.evaluate(() =>
        document.activeElement?.getAttribute("aria-label"),
      ),
      "Concluir atendimento de Pedro Santos",
    );
  });
  await test("Perfil: cancelar descarta rascunho, salvar, upload e horários", async (p, s) => {
    await go(p, "perfil");
    await p.getByRole("button", { name: "Editar perfil" }).click();
    const d = p.getByRole("dialog");
    await d.getByLabel("Nome de exibição").fill("Rafael Costa");
    await d.getByRole("button", { name: "Cancelar" }).click();
    await p.getByRole("button", { name: "Editar perfil" }).click();
    assert.equal(
      await d.getByLabel("Nome de exibição").inputValue(),
      "Rafael Almeida",
    );
    await d.getByLabel("Nome de exibição").fill("Rafael Costa");
    await d.getByLabel("Telefone", { exact: true }).fill("(11) 99999-8877");
    await d.getByRole("button", { name: "Salvar perfil" }).click();
    await d.waitFor({ state: "hidden" });
    await wait(p, "Rafael Costa");
    await p
      .locator("input[type=file]")
      .setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7s8AAAAASUVORK5CYII=",
          "base64",
        ),
      });
    await wait(p, "Foto atualizada.");
    await p.getByText("Horários de trabalho", { exact: true }).click();
    await p.getByLabel("Início Segunda-feira", { exact: true }).fill("19:00");
    await p.getByRole("button", { name: "Salvar horários" }).click();
    await wait(
      p,
      "Segunda-feira: o fim do expediente deve ser posterior ao início.",
    );
    await p.getByLabel("Início Segunda-feira", { exact: true }).fill("10:00");
    await p.getByRole("button", { name: "Copiar segunda-feira" }).click();
    assert.equal(
      await p.getByLabel("Início Terça-feira", { exact: true }).inputValue(),
      "10:00",
    );
    await p.getByRole("button", { name: "Salvar horários" }).click();
    await wait(p, "Horários salvos e aplicados à agenda.");
    assert.equal(s.profile.horariosTrabalho.terca.abertura, "10:00");
  });
  await test("Comissões: intervalo inválido, filtro e semana secundária", async (p, s) => {
    await go(p, "comissoes");
    await p.getByLabel("Início", { exact: true }).fill("2099-10-10");
    await p.getByLabel("Fim", { exact: true }).fill("2099-10-01");
    const before = s.calls.filter(
      (c) => c.path === "/barbeiro/comissoes",
    ).length;
    await p.getByRole("button", { name: "Aplicar período" }).click();
    await wait(p, "A data final deve ser igual ou posterior à inicial.");
    assert.equal(
      s.calls.filter((c) => c.path === "/barbeiro/comissoes").length,
      before,
    );
    await p.getByRole("button", { name: "Este mês" }).click();
    await p
      .getByText("Atendimentos nos últimos 7 dias", { exact: true })
      .click();
    await p.locator(".bb-week").waitFor();
  });
  await test("Aprovações: revisar, cancelar, rejeitar e atualizar", async (p, s) => {
    s.approvals = [
      {
        id: "approval-fixture",
        acao: "EDITAR",
        dadosNovos: { valor: 80, valorComissao: 40 },
        lancamento: { valor: 85, servico: { nome: "Corte e barba" } },
      },
    ];
    await go(p, "hoje");
    await p.getByRole("button", { name: "Revisar solicitação" }).click();
    const d = p.getByRole("dialog");
    await d.getByRole("button", { name: "Fechar", exact: true }).click();
    assert.equal(s.approvals.length, 1);
    await p.getByRole("button", { name: "Revisar solicitação" }).click();
    await d.getByRole("button", { name: "Rejeitar" }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal(s.approvals.length, 0);
  });
  await test("Estados de erro/retry, vazio e loading das quatro telas", async (p, s) => {
    for (const [path, api] of [
      ["hoje", "/barbeiro/agenda-hoje"],
      ["agenda", "/barbeiro/agenda"],
      ["comissoes", "/barbeiro/comissoes"],
      ["perfil", "/barbeiro/perfil"],
    ]) {
      s.fail = api;
      await go(p, path);
      await p.getByRole("alert").first().waitFor();
      s.fail = "";
      await p.getByRole("button", { name: "Tentar novamente" }).first().click();
      await p.getByRole("alert").first().waitFor({ state: "hidden" });
    }
    s.appointments = [];
    s.blocks = [];
    await go(p, "hoje");
    await wait(p, "Sem agendamentos hoje");
    await go(p, "agenda");
    await wait(p, "Sem eventos neste dia");
    await go(p, "comissoes");
    await wait(p, "Sem lançamentos neste período");
    s.delay = 600;
    await go(p, "perfil", false);
    await p.getByRole("status", { name: "Carregando" }).waitFor();
  });
  await test("Login, senha visível, erro de servidor e normalização de email", async (p, s) => {
    await go(p, "login");
    await p.getByLabel("Email", { exact: true }).fill("RAFAEL@EXAMPLE.TEST");
    await p.getByLabel("Senha", { exact: true }).fill("fixture-password");
    await p.getByRole("button", { name: "Mostrar senha" }).click();
    assert.equal(
      await p.getByLabel("Senha", { exact: true }).getAttribute("type"),
      "text",
    );
    s.fail = "/barbeiro/login";
    await p.getByRole("button", { name: "Entrar como barbeiro" }).click();
    await p.getByRole("alert").waitFor();
    s.fail = "";
    await p.getByRole("button", { name: "Entrar como barbeiro" }).click();
    await p.waitForURL("**/barbeiro/hoje");
    assert.equal(
      s.calls.filter((c) => c.path === "/barbeiro/login").at(-1).body.email,
      "rafael@example.test",
    );
  });
  await test("Acessibilidade WCAG em desktop/mobile e temas", async (p, s) => {
    for (const width of [390, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      for (const path of ["hoje", "agenda", "comissoes", "perfil", "login"]) {
        await go(p, path);
        await pause(350);
        const axe = await new AxeBuilder({ page: p })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const violations = axe.violations.filter((v) => v.id !== "region");
        if (violations.length) {
          fs.writeFileSync(
            `qa/evidence/axe-${width}-${path}.json`,
            JSON.stringify(violations, null, 2),
          );
          throw new Error(
            `${width}/${path}: ${violations.map((v) => v.id).join(", ")}`,
          );
        }
      }
    }
    await go(p, "perfil");
    await p.getByRole("radio", { name: "Escuro", exact: true }).click();
    assert.equal(await p.locator("html").getAttribute("data-tema"), "escuro");
    await p.screenshot({ path: shotDir + "/dark-profile.png", fullPage: true });
    for (const path of ["hoje", "agenda", "comissoes", "perfil", "login"]) {
      await go(p, path);
      await pause(200);
      const dark = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        dark.violations.map((v) => v.id),
        [],
        "dark " + path,
      );
    }
  });

  await test("Disponibilidade, sessão e aprovação de exclusão", async (p, s) => {
    await go(p, "hoje");
    await p.getByRole("checkbox").click();
    await wait(p, "Você está ausente.");
    assert.equal(s.profile.trabalhandoAgora, false);
    await p.getByRole("checkbox").click();
    await wait(p, "Você está disponível.");
    s.approvals = [
      {
        id: "deletion-fixture",
        acao: "EXCLUIR",
        lancamento: { descricao: "Corte e barba", valor: 85 },
      },
    ];
    await go(p, "hoje");
    await p.getByRole("button", { name: "Revisar solicitação" }).click();
    const d = p.getByRole("dialog");
    assert(
      await d
        .getByRole("button", { name: "Aprovar", exact: true })
        .isDisabled(),
    );
    await d.locator("input").fill("Corte e barba");
    await d.getByRole("button", { name: "Aprovar", exact: true }).click();
    await d.waitFor({ state: "hidden" });
    assert.equal(s.approvals.length, 0);
    await go(p, "perfil");
    await p.getByRole("button", { name: "Sair da conta" }).click();
    await p.waitForURL("**/barbeiro/login");
    assert.equal(
      await p.evaluate(() => localStorage.getItem("@garoa:barbeiro_token")),
      null,
    );
  });
  await test("Conclusão futura exige confirmação e modal funciona em 375px", async (p, s) => {
    s.appointments[1].dataHora = "2099-10-03T10:30:00-03:00";
    await p.setViewportSize({ width: 375, height: 812 });
    await go(p, "hoje");
    await p
      .getByRole("button", { name: "Concluir atendimento de Lucas Ferreira" })
      .click();
    const d = p.getByRole("dialog");
    await wait(p, "Total a registrar");
    assert(
      await d.getByRole("button", { name: "Confirmar conclusão" }).isDisabled(),
    );
    await d.getByRole("checkbox").check();
    assert(
      await d.getByRole("button", { name: "Confirmar conclusão" }).isEnabled(),
    );
    const axe = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    assert.deepEqual(
      axe.violations.map((v) => v.id),
      [],
    );
    await p.screenshot({
      path: shotDir + "/mobile-checkout.png",
      fullPage: true,
    });
    await d.getByRole("button", { name: "Cancelar", exact: true }).click();
    assert.equal(
      s.calls.filter((c) => c.path.includes("/concluir-agendamento")).length,
      0,
    );
  });
  await test("Console e respostas HTTP sem falhas nos fluxos normais", async (p, s) => {
    const logs = [],
      responses = [];
    p.on("console", (m) => {
      if (m.type() === "error") logs.push(m.text());
    });
    p.on("response", (r) => {
      if (r.status() >= 400) responses.push(r.status() + " " + r.url());
    });
    for (const route of ["hoje", "agenda", "comissoes", "perfil", "login"]) {
      await go(p, route);
      await pause(400);
    }
    assert.deepEqual(logs, []);
    assert.deepEqual(responses, []);
  });
  await test("Login com vínculo em mais de uma barbearia", async (p, s) => {
    s.loginShops = [
      { id: "shop-fixture", nome: "Barbearia Alameda", slug: "alameda" },
      { id: "shop-other", nome: "Barbearia da Praça", slug: "praca" },
    ];
    await go(p, "login");
    await p.getByLabel("Email", { exact: true }).fill("rafael@example.test");
    await p.getByLabel("Senha", { exact: true }).fill("fixture-password");
    await p.getByRole("button", { name: "Entrar como barbeiro" }).click();
    await p.getByRole("combobox").selectOption("shop-other");
    await p.getByRole("button", { name: "Entrar como barbeiro" }).click();
    await p.waitForURL("**/barbeiro/hoje");
    assert.equal(
      s.calls.filter((c) => c.path === "/barbeiro/login").at(-1).body
        .barbeariaId,
      "shop-other",
    );
  });
  await test("Valéria preservada: abre, consulta status e fecha sem consumo", async (p, s) => {
    await go(p, "hoje");
    await p
      .getByRole("button", { name: "Valéria, assistente de IA", exact: true })
      .click();
    await p
      .getByText("Assistente indisponível neste ambiente de teste.", {
        exact: true,
      })
      .waitFor();
    await p
      .getByRole("button", { name: "Fechar Valéria, assistente de IA" })
      .click();
    assert.equal(
      s.calls.filter((c) => c.path.startsWith("/ia/") && c.method === "POST")
        .length,
      0,
    );
    await p
      .getByRole("navigation")
      .getByRole("link", { name: "Agenda", exact: true })
      .click();
    await p
      .getByRole("button", { name: "Valéria, assistente de IA", exact: true })
      .waitFor();
  });
  await browser.close();
  fs.writeFileSync(
    isWebkit
      ? "qa/evidence/webkit-results.json"
      : "qa/evidence/browser-results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  process.exitCode = results.some((r) => r.status === "failed") ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
