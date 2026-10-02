const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
}).format(new Date());
const auth = {
  barbeiroId: "barber-fixture",
  usuarioId: "user-fixture",
  barbeariaId: "shop-fixture",
  nome: "Rafael Almeida",
  email: "rafael@example.test",
};
const profile = {
  id: auth.barbeiroId,
  usuario: auth,
  foto: null,
  especialidades: ["Corte masculino", "Barba", "Degradê"],
  telefone: "(11) 98888-4321",
  avaliacaoMedia: 4.8,
  horariosTrabalho: {},
  comissaoPercent: 50,
  trabalhandoAgora: true,
  barbearia: { nome: "Barbearia Alameda", slug: "alameda", logo: null },
};
const appointments = [
  ["09:00", "CONCLUIDO", "Marcos Oliveira", "Corte e barba", 60, 85],
  ["10:30", "CONFIRMADO", "Lucas Ferreira", "Degradê", 45, 55],
  ["11:30", "AGUARDANDO", "André Costa", "Corte masculino", 30, 45],
  ["14:00", "CONFIRMADO", "Pedro Santos", "Corte e barba", 60, 85],
  ["15:30", "CONFIRMADO", "João Rodrigues", "Barba", 30, 35],
].map(([time, status, name, service, duration, value], i) => ({
  id: `appointment-${i}`,
  dataHora: `${today}T${time}:00-03:00`,
  status,
  valorCobrado: String(value),
  servico: { nome: service, duracaoMinutos: duration, preco: value },
  cliente: { id: "client-" + i, usuario: { nome: name } },
}));
async function fixtures(context, options = {}) {
  const state = {
    appointments: structuredClone(appointments),
    profile: structuredClone(profile),
    blocks: [
      {
        id: "block-1",
        dataInicio: `${today}T12:30:00-03:00`,
        dataFim: `${today}T13:30:00-03:00`,
        motivo: "Almoço",
      },
    ],
    approvals: [],
    calls: [],
    fail: "",
    delay: 0,
    ...options,
  };
  await context.addInitScript(
    ({ auth }) => {
      if (sessionStorage.getItem("barber-qa-seeded")) return;
      sessionStorage.setItem("barber-qa-seeded", "true");
      localStorage.setItem(
        "@garoa:barbeiro_token",
        "eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.fixture",
      );
      localStorage.setItem("@garoa:barbeiro_dados", JSON.stringify(auth));
      localStorage.setItem("garoa-modo-tema", "light");
    },
    { auth },
  );
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    if (
      url.hostname === "127.0.0.1" &&
      ["5187", "5188", "5189"].includes(url.port)
    )
      return route.continue();
    if (url.hostname !== "localhost" || url.port !== "3001")
      return route.abort();
    const path = url.pathname,
      method = req.method();
    const cors = {
      "access-control-allow-origin":
        req.headers().origin || "http://127.0.0.1:5189",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
    };
    if (method === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors });
    state.calls.push({
      path,
      method,
      body: req.headers()["content-type"]?.includes("application/json")
        ? req.postDataJSON()
        : null,
      authorization: req.headers().authorization,
    });
    const send = (body, status = 200) =>
      route.fulfill({
        status,
        headers: cors,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
    if (state.fail && path.includes(state.fail))
      return send({ erro: "Não foi possível conectar. Tente novamente." }, 500);
    if (path === "/ia/barbeiro/status")
      return send({
        mensagem: "Assistente indisponível neste ambiente de teste.",
        textoDisponivel: false,
        vozDisponivel: false,
        vozNoPlano: false,
        creditosMensais: null,
        creditosRestantes: null,
        mensagensMensais: null,
        mensagensRestantes: null,
        vozSegundosRestantes: null,
      });
    if (
      path === "/barbeiro/login" &&
      state.loginShops &&
      !req.postDataJSON().barbeariaId
    )
      return send(
        { codigo: "ESCOLHER_BARBEARIA", barbearias: state.loginShops },
        409,
      );
    if (path === "/barbeiro/login")
      return send({
        token: "eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.fixture",
        barbeiro: auth,
      });
    if (path === "/barbeiro/resumo-semana")
      return send([{ data: today, atendimentos: 1 }]);
    if (path === "/barbeiro/perfil") {
      if (method === "PUT") {
        const p = req.postDataJSON();
        state.profile = {
          ...state.profile,
          ...p,
          usuario: {
            ...state.profile.usuario,
            nome: p.nome || state.profile.usuario.nome,
          },
        };
      }
      return send(state.profile);
    }
    if (path === "/barbeiro/status-trabalho") {
      state.profile.trabalhandoAgora = req.postDataJSON().trabalhandoAgora;
      return send({ trabalhandoAgora: state.profile.trabalhandoAgora });
    }
    if (path === "/barbeiro/foto") {
      state.profile.foto =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7s8AAAAASUVORK5CYII=";
      return send(state.profile);
    }
    if (path.startsWith("/fidelidade/clientes/"))
      return send({
        saldoPontos: 100,
        maxPontosUtilizaveis: 20,
        resgatePontosAtivo: true,
        permitirCombinarDescontos: true,
      });
    if (path.endsWith("/simular-desconto")) {
      const a = state.appointments.find((a) => a.id === path.split("/")[2]);
      const p = req.postDataJSON();
      const manual =
        p.descontoReais ||
        (Number(a.valorCobrado) * (p.descontoPercentual || 0)) / 100;
      return send({
        valorBruto: Number(a.valorCobrado),
        descontoManual: manual,
        descontoPontos: p.pontosUsados || 0,
        valorLiquido: Math.max(
          0,
          Number(a.valorCobrado) - manual - (p.pontosUsados || 0),
        ),
        maxPontosUtilizaveis: 20,
      });
    }
    if (path.includes("/concluir-agendamento/")) {
      const a = state.appointments.find((a) => a.id === path.split("/").pop());
      if (a.status === "CONCLUIDO") return send({ erro: "Já concluído" }, 400);
      a.status = "CONCLUIDO";
      return send({ agendamento: a });
    }
    if (path === "/barbeiro/agenda-hoje") return send(state.appointments);
    if (path === "/barbeiro/agenda")
      return send(
        url.searchParams.get("data") === today ? state.appointments : [],
      );
    if (path === "/barbeiro/comissoes") {
      const rows = state.appointments
        .filter((a) => a.status === "CONCLUIDO")
        .map((a) => ({
          id: a.id,
          data: a.dataHora,
          valor: Number(a.valorCobrado),
          valorComissao: Number(a.valorCobrado) / 2,
          servico: a.servico.nome,
          cliente: a.cliente.usuario.nome,
        }));
      return send({
        totalAtendimentos: rows.length,
        valorBruto: rows.reduce((s, r) => s + r.valor, 0),
        percentualComissao: 50,
        valorComissao: rows.reduce((s, r) => s + r.valorComissao, 0),
        lancamentos: rows,
      });
    }
    if (path.endsWith("/bloqueios") && method === "GET")
      return send(state.blocks);
    if (path.endsWith("/bloqueios") && method === "POST") {
      const block = {
        ...req.postDataJSON(),
        id: `block-${state.blocks.length + 1}`,
      };
      state.blocks.push(block);
      return send(block, 201);
    }
    if (path.includes("/bloqueios/") && method === "DELETE") {
      state.blocks = state.blocks.filter((b) => b.id !== path.split("/").pop());
      return route.fulfill({ status: 204, headers: cors });
    }
    if (path === "/aprovacoes/pendentes") return send(state.approvals);
    if (path.startsWith("/aprovacoes/")) {
      state.approvals = state.approvals.filter(
        (a) => a.id !== path.split("/")[2],
      );
      return send({});
    }
    (state.unmocked ??= []).push(path);
    return send({ erro: `Unmocked: ${path}` }, 501);
  });
  return state;
}
module.exports = { fixtures, today, auth, appointments };
