const { chromium, webkit } = require("../.qa/node_modules/playwright");
const assert = require("node:assert/strict"),
  fs = require("fs");
const site = "https://valenbarber.com.br",
  api = "https://barbearia-backend-production-f72d.up.railway.app";
(async () => {
  const results = [];
  const health = await fetch(api + "/health", {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(health.status, 200);
  results.push({ name: "Backend health", status: "passed" });
  const cors = await fetch(api + "/barbeiro/status-trabalho", {
    method: "OPTIONS",
    headers: {
      Origin: site,
      "Access-Control-Request-Method": "PATCH",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
    signal: AbortSignal.timeout(20000),
  });
  assert(cors.headers.get("access-control-allow-methods")?.includes("PATCH"));
  results.push({ name: "Production CORS PATCH", status: "passed" });
  const unauthorized = await fetch(api + "/barbeiro/perfil", {
    signal: AbortSignal.timeout(20000),
  });
  assert.equal(unauthorized.status, 401);
  results.push({
    name: "Private profile rejects anonymous access",
    status: "passed",
  });
  for (const [name, engine] of [
    ["Chromium", chromium],
    ["WebKit", webkit],
  ]) {
    const browser = await engine.launch(
      name === "Chromium"
        ? { channel: "msedge", headless: true }
        : { headless: true },
    );
    const context = await browser.newContext();
    const blocked = [],
      errors = [],
      consoleErrors = [];
    await context.route("**/*", (r) => {
      if (!["GET", "HEAD", "OPTIONS"].includes(r.request().method())) {
        blocked.push(r.request().method());
        return r.abort();
      }
      return r.continue();
    });
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });
    for (const width of [375, 768, 1920]) {
      await p.setViewportSize({ width, height: 900 });
      await p.goto(site + "/barbeiro/login", { waitUntil: "networkidle" });
      await p.locator(".bb-login").waitFor();
      assert.match(await p.title(), /Valen Barber/);
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await p.getByLabel("Email", { exact: true }).waitFor();
      await p.getByLabel("Senha", { exact: true }).waitFor();
      await p.screenshot({
        path: `qa/evidence/production-${name}-${width}.png`,
        fullPage: true,
      });
    }
    await p.goto(site + "/barbeiro/perfil", { waitUntil: "networkidle" });
    await p.waitForURL("**/barbeiro/login");
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(blocked, []);
    results.push({
      name: name + " production login/responsive/guard/console",
      status: "passed",
    });
    await browser.close();
  }
  fs.writeFileSync(
    "qa/evidence/production-smoke.json",
    JSON.stringify(
      { site, api, authenticatedBarberTested: false, mutations: 0, results },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(results));
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
