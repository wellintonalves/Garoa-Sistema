// Executar com Vite local e Playwright disponível em NODE_PATH.
// Somente fixture local; não autentica em produção nem chama o backend.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-features=LocalNetworkAccessChecks'] });
  try {
    const page = await browser.newPage();
    page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
    page.on('requestfailed', r => console.error(r.url(), r.failure()));
    const erros = [];
    page.on('pageerror', e => { erros.push(e.message); console.error(e.message); });
    await page.route('**/__ia_fixture', route => route.fulfill({ contentType: 'text/html', body: `
      <html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head><body><div id="root"></div>
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const { default: React } = await import('/node_modules/.vite/deps/react.js');
        const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { AssistenteIa } = await import('/src/components/AssistenteIa.tsx');
        await import('/src/index.css');
        window.fixtureMode = 'ok'; window.fixtureEnabled = false; window.fixtureRequests = [];
        const api = { get: async () => {
          await new Promise(r => setTimeout(r, 350));
          if (window.fixtureMode === 'erro') throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão.');
          return { data: { mensagem: 'A assistente está em preparação.', textoDisponivel: window.fixtureEnabled, vozDisponivel: false,
            vozNoPlano: true, mensagensMensais: 200, mensagensRestantes: null, creditosMensais: null, creditosRestantes: null, vozSegundosRestantes: null } };
        }, post: async (url, body, config) => {
          window.fixtureRequests.push({ url, body, key: config.headers['Idempotency-Key'] });
          await new Promise(r => setTimeout(r, 100));
          if (window.fixtureRequests.length === 1) throw new Error('Falha de conexão simulada');
          if (window.fixtureRequests.length === 2) return { data: { estado: 'PENDENTE', texto: 'Pedido pendente fixture' } };
          return { data: { estado: 'CONCLUIDA', texto: 'Resposta fixture concluída' } };
        }};
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AssistenteIa, { api, caminho: '/fixture' }));
      </script></body></html>` }));
    for (const largura of [375, 768, 1920]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto('http://127.0.0.1:5173/__ia_fixture');
      const abrir = page.getByRole('button', { name: 'Valéria, assistente de IA', exact: true });
      try { await abrir.click({ timeout: 10000 }); } catch (erro) { console.error(await page.locator('body').innerText()); throw erro; }
      await page.getByRole('status', { name: 'Carregando saldo da assistente' }).waitFor();
      await page.getByText('A assistente está em preparação.', { exact: true }).waitFor();
      const dialogo = page.getByRole('dialog');
      const box = await dialogo.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= largura + 1);
      assert.equal(await dialogo.evaluate(el => el.scrollWidth > el.clientWidth), false);
      for (const b of await dialogo.getByRole('button').all()) {
        const dimensao = await b.boundingBox();
        assert.ok(dimensao.height >= 48 && dimensao.width >= 48);
      }
      assert.equal(await page.getByRole('button', { name: 'Enviar', exact: true }).isDisabled(), true);
      await page.keyboard.press('Escape');
      assert.equal(await abrir.evaluate(el => el === document.activeElement), true);
      await page.evaluate(() => { window.fixtureMode = 'erro'; });
      await abrir.click();
      await page.getByRole('alert').waitFor();
      await page.evaluate(() => { window.fixtureMode = 'ok'; });
      await page.getByRole('button', { name: 'Tentar novamente' }).click();
      await page.getByText('A assistente está em preparação.', { exact: true }).waitFor();
      await page.screenshot({ path: `node_modules/ia-${largura}.png` });
      await page.getByRole('button', { name: 'Fechar Valéria, assistente de IA' }).click();
      await page.evaluate(() => { window.fixtureEnabled = true; });
      await abrir.click();
      const campo = page.getByLabel('Mensagem para Valéria');
      await campo.fill('Teste de envio');
      await page.getByRole('button', { name: 'Enviar', exact: true }).click();
      await page.getByText('Falha de conexão simulada').waitFor();
      await page.getByRole('button', { name: 'Consultar pedido', exact: true }).click();
      await page.getByText('Pedido pendente fixture').waitFor();
      await page.getByRole('button', { name: 'Consultar pedido', exact: true }).click();
      await page.getByText('Resposta fixture concluída').waitFor();
      const pedidos = await page.evaluate(() => window.fixtureRequests);
      assert.equal(pedidos.length, 3);
      assert.equal(new Set(pedidos.map(p => p.key)).size, 1, 'retry não cria outra cobrança');
      assert.equal(await campo.inputValue(), '');
      console.log(`IA UI ${largura}px: abertura, skeleton, erro/retry, dimensões e foco passaram.`);
    }
    assert.deepEqual(erros, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
