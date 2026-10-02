const { chromium } = require("../.qa/node_modules/playwright");
const { fixtures, today } = require("./fixtures.cjs");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const phase = process.argv[2] || "before";
  fs.mkdirSync(`qa/evidence/${phase}`, { recursive: true });
  for (const [device, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await fixtures(context);
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date(today + "T10:15:00-03:00"));
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of ["hoje", "agenda", "comissoes", "perfil", "login"]) {
      await page.goto(
        `http://127.0.0.1:${process.env.QA_PORT || 5189}/barbeiro/${route}`,
        { waitUntil: "domcontentloaded", timeout: 60000 },
      );
      await page.locator("h1:visible").first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(700);
      if (route === "agenda") {
        await page.locator("input[type=date]").first().fill(today);
        await page.waitForTimeout(300);
      }
      await page.screenshot({
        path: `qa/evidence/${phase}/${device}-${route}.png`,
        fullPage: true,
      });
      if (route === "agenda") {
        const trigger = page.getByRole("button", { name: /Bloquear hor.rio/i });
        if (await trigger.count()) {
          await trigger.click();
          await page.screenshot({
            path: `qa/evidence/${phase}/${device}-bloqueio.png`,
            fullPage: true,
          });
        }
      }
    }
    console.log(JSON.stringify({ device, errors }));
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
