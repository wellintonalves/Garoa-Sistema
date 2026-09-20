import assert from 'node:assert/strict';
import { mock } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-admin-local-com-mais-de-24-caracteres';
process.env.JWT_SECRET_CLIENTE = 'segredo-cliente-local-com-mais-de-24-caracteres';
process.env.JWT_SECRET_BARBEIRO = 'segredo-barbeiro-local-com-mais-de-24-caracteres';
process.env.ASSINATURA_PROVEDOR = 'fake';
process.env.ASSINATURA_FAKE_LOCAL_ENABLED = 'true';
process.env.ASSINATURA_PRO_DISPONIVEL = 'true';
process.env.ASAAS_WEBHOOK_TOKEN = 'token_webhook_local_com_mais_de_32_caracteres';

type Linha = Record<string, any>;
const agoraBase = new Date('2026-09-15T12:00:00-03:00');
mock.timers.enable({ apis: ['Date'], now: agoraBase });

const barbearias: Linha[] = [
  { id: 'barb-a', nome: 'Barbearia A', ativo: true },
  { id: 'barb-b', nome: 'Barbearia B', ativo: true },
  { id: 'barb-c', nome: 'Barbearia C', ativo: true },
  { id: 'barb-d', nome: 'Barbearia D', ativo: true },
];
const usuarios: Linha[] = barbearias.map((barbearia, indice) => ({
  id: `admin-${String.fromCharCode(97 + indice)}`,
  nome: `Admin ${String.fromCharCode(65 + indice)}`,
  email: `admin-${String.fromCharCode(97 + indice)}@teste.local`,
  papel: 'ADMIN',
  barbeariaId: barbearia.id,
  barbearia,
}));
const assinaturas: Linha[] = [];
const mudancas: Linha[] = [];
const eventos: Linha[] = [];
const cancelamentos: Linha[] = [];
const contagens = new Map<string, { barbeiros: number; clientes: number }>();
barbearias.forEach((barbearia) => contagens.set(barbearia.id, { barbeiros: 2, clientes: 20 }));

function id(prefixo: string, lista: Linha[]): string {
  return `${prefixo}-${lista.length + 1}`;
}

function corresponde(valor: any, condicao: any): boolean {
  if (condicao && typeof condicao === 'object' && !Array.isArray(condicao) && !(condicao instanceof Date)) {
    if ('in' in condicao) return condicao.in.includes(valor);
    if ('lte' in condicao) return valor != null && new Date(valor).getTime() <= new Date(condicao.lte).getTime();
    if ('not' in condicao) return valor !== condicao.not;
    if ('equals' in condicao) {
      return condicao.mode === 'insensitive'
        ? String(valor).toLowerCase() === String(condicao.equals).toLowerCase()
        : valor === condicao.equals;
    }
  }
  return valor === condicao;
}

function combina(linha: Linha, where: Linha = {}): boolean {
  return Object.entries(where).every(([chave, condicao]) => chave === 'OR' ? condicao.some((filtro: Linha) => combina(linha, filtro)) : corresponde(linha[chave], condicao));
}

function aplicar(linha: Linha, data: Linha): Linha {
  for (const [chave, valor] of Object.entries(data)) {
    if (valor && typeof valor === 'object' && 'increment' in valor) {
      linha[chave] = (linha[chave] || 0) + valor.increment;
    } else {
      linha[chave] = valor;
    }
  }
  linha.updatedAt = agoraBase;
  return linha;
}

function localizarUnico(lista: Linha[], where: Linha): Linha | null {
  return lista.find((linha) => combina(linha, where)) || null;
}

const fake: Linha = {
  $queryRaw: async () => [],
  usuario: {
    findFirst: async ({ where }: Linha) => localizarUnico(usuarios, where),
    findMany: async ({ where, take }: Linha) => usuarios.filter((linha) => combina(linha, where)).slice(0, take),
  },
  barbearia: {
    findUnique: async ({ where }: Linha) => localizarUnico(barbearias, where),
  },
  assinaturaSaas: {
    updateMany: async ({ where, data }: Linha) => { const linhas = assinaturas.filter(linha => combina(linha, where)); linhas.forEach(linha => aplicar(linha, data)); return { count: linhas.length }; },
    findUnique: async ({ where, include }: Linha) => {
      const linha = localizarUnico(assinaturas, where);
      if (!linha) return null;
      return include?.mudancas
        ? { ...linha, mudancas: mudancas.filter((m) => m.assinaturaId === linha.id && combina(m, include.mudancas.where)) }
        : linha;
    },
    findMany: async ({ where }: Linha) => assinaturas.filter((linha) => combina(linha, where)),
    create: async ({ data }: Linha) => {
      if (assinaturas.some((linha) => linha.barbeariaId === data.barbeariaId || linha.contratacaoIdempotencia === data.contratacaoIdempotencia)) throw { code: 'P2002' };
      const linha = {
        id: id('ass', assinaturas),
        status: 'PRE_CADASTRO',
        renovacaoAutomatica: true,
        checkoutExternoId: null,
        checkoutUrl: null,
        checkoutExpiraEm: null,
        assinaturaExternaId: null,
        clienteExternoId: null,
        testeInicio: null,
        testeFim: null,
        cicloInicio: null,
        cicloFim: null,
        proximaCobrancaEm: null,
        avisoPagamentoEm: null,
        toleranciaAte: null,
        fimAcessoEm: null,
        consultaExportacaoAte: null,
        ultimoEventoProvedorEm: null,
        createdAt: agoraBase,
        updatedAt: agoraBase,
        ...data,
      };
      assinaturas.push(linha);
      return linha;
    },
    update: async ({ where, data }: Linha) => {
      const linha = localizarUnico(assinaturas, where);
      if (!linha) throw new Error('Assinatura fake não encontrada.');
      return aplicar(linha, data);
    },
  },
  mudancaAssinatura: {
    findFirst: async ({ where }: Linha) => localizarUnico(mudancas, where),
    updateMany: async ({ where, data }: Linha) => { const linhas = mudancas.filter(linha => combina(linha, where)); linhas.forEach(linha => aplicar(linha, data)); return { count: linhas.length }; },
    findUnique: async ({ where }: Linha) => localizarUnico(mudancas, where),
    findMany: async ({ where, include }: Linha) => mudancas
      .filter((linha) => combina(linha, where))
      .map((linha) => include?.assinatura ? { ...linha, assinatura: localizarUnico(assinaturas, { id: linha.assinaturaId }) } : linha),
    create: async ({ data }: Linha) => {
      if (mudancas.some((linha) => linha.chaveIdempotencia === data.chaveIdempotencia)) throw { code: 'P2002' };
      const linha = {
        id: id('mud', mudancas),
        checkoutExternoId: null,
        checkoutUrl: null,
        checkoutExpiraEm: null,
        createdAt: agoraBase,
        updatedAt: agoraBase,
        ...data,
      };
      mudancas.push(linha);
      return linha;
    },
    update: async ({ where, data }: Linha) => {
      const linha = localizarUnico(mudancas, where);
      if (!linha) throw new Error('Mudança fake não encontrada.');
      return aplicar(linha, data);
    },
  },
  eventoWebhookAsaas: {
    create: async ({ data }: Linha) => {
      if (eventos.some((linha) => linha.eventoExternoId === data.eventoExternoId)) throw { code: 'P2002' };
      const linha = {
        id: id('evt-local', eventos),
        status: 'PENDENTE',
        tentativas: 0,
        recebidoEm: agoraBase,
        processadoEm: null,
        ultimoErro: null,
        createdAt: agoraBase,
        updatedAt: agoraBase,
        ...data,
      };
      eventos.push(linha);
      return linha;
    },
    findUnique: async ({ where, select }: Linha) => {
      const linha = localizarUnico(eventos, where);
      if (!linha || !select) return linha;
      return Object.fromEntries(Object.keys(select).map((chave) => [chave, linha[chave]]));
    },
    findMany: async ({ where, take }: Linha) => eventos.filter((linha) => combina(linha, where)).slice(0, take),
    updateMany: async ({ where, data }: Linha) => {
      const encontradas = eventos.filter((linha) => combina(linha, where));
      encontradas.forEach((linha) => aplicar(linha, data));
      return { count: encontradas.length };
    },
    update: async ({ where, data }: Linha) => {
      const linha = localizarUnico(eventos, where);
      if (!linha) throw new Error('Evento fake não encontrado.');
      return aplicar(linha, data);
    },
  },
  solicitacaoCancelamentoAssinatura: {
    findUnique: async ({ where, include }: Linha) => {
      const linha = localizarUnico(cancelamentos, where);
      if (!linha) return null;
      return include?.assinatura
        ? { ...linha, assinatura: localizarUnico(assinaturas, { id: linha.assinaturaId }) }
        : linha;
    },
    findFirst: async ({ where }: Linha) => [...cancelamentos].reverse().find((linha) => combina(linha, where)) || null,
    create: async ({ data }: Linha) => {
      if (cancelamentos.some((linha) => linha.chaveIdempotencia === data.chaveIdempotencia || (linha.barbeariaId === data.barbeariaId && linha.aberta === true))) throw { code: 'P2002' };
      const linha = {
        id: id('can', cancelamentos),
        canal: 'SISTEMA',
        status: 'PROCESSAMENTO_PENDENTE',
        aberta: true,
        recebidoEm: agoraBase,
        updatedAt: agoraBase,
        provedor: 'ASAAS',
        tentativasProvedor: 0,
        ultimaTentativaEm: null,
        ultimoErroProvedor: null,
        cancelamentoConfirmadoEm: null,
        fimAcessoEm: null,
        ...data,
      };
      cancelamentos.push(linha);
      return linha;
    },
    update: async ({ where, data }: Linha) => {
      const linha = localizarUnico(cancelamentos, where);
      if (!linha) throw new Error('Cancelamento fake não encontrado.');
      return aplicar(linha, data);
    },
    updateMany: async ({ where, data }: Linha) => {
      const encontradas = cancelamentos.filter((linha) => combina(linha, where));
      encontradas.forEach((linha) => aplicar(linha, data));
      return { count: encontradas.length };
    },
  },
  barbeiro: {
    count: async ({ where }: Linha) => contagens.get(where.barbeariaId)?.barbeiros || 0,
  },
  clienteBarbearia: {
    count: async ({ where }: Linha) => contagens.get(where.barbeariaId)?.clientes || 0,
  },
  $transaction: async (operacoes: any) => typeof operacoes === 'function' ? operacoes(fake) : Promise.all(operacoes),
};

(globalThis as typeof globalThis & { prisma?: unknown }).prisma = { $extends: () => fake };

function usuario(indice: number) {
  const item = usuarios[indice];
  return { id: item.id, nome: item.nome, email: item.email, papel: item.papel, barbeariaId: item.barbeariaId };
}

function payloadEvento(entrada: {
  id: string;
  tipo: string;
  data: Date;
  recurso: 'checkout' | 'subscription' | 'payment';
  recursoId: string;
  referencia?: string;
  assinaturaId?: string;
  customer?: string;
  dueDate?: string;
}) {
  const recurso: Linha = {
    id: entrada.recursoId,
    externalReference: entrada.referencia,
    customer: entrada.customer,
    dueDate: entrada.dueDate,
    subscription: entrada.assinaturaId,
  };
  return {
    id: entrada.id,
    event: entrada.tipo,
    dateCreated: entrada.data.toISOString(),
    [entrada.recurso]: recurso,
  };
}

async function registrarEProcessar(WebhookAsaasService: any, payload: unknown, agora: Date) {
  const registrado = await WebhookAsaasService.registrar(payload);
  if (!registrado.duplicado) await WebhookAsaasService.processar(registrado.eventoId, agora);
  return registrado;
}

async function main() {
  const express = (await import('express')).default;
  const jwt = (await import('jsonwebtoken')).default;
  const assinaturaRoutes = (await import('../src/routes/assinatura.routes')).default;
  const { errorMiddleware } = await import('../src/middlewares/error.middleware');
  const { AssinaturaOperacionalService } = await import('../src/services/assinaturaOperacional.service');
  const { AssinaturaService } = await import('../src/services/assinatura.service');
  const { WebhookAsaasService } = await import('../src/services/webhookAsaas.service');
  const { provedorAssinatura, ProvedorAssinaturaFakeLocal } = await import('../src/integrations/assinaturas/provedorAssinatura');
  const { validarEscritaAssinatura } = await import('../src/services/acessoAssinatura.service');

  assert.equal(provedorAssinatura.ambiente, 'LOCAL_FAKE');
  const app = express();
  app.use(express.json());
  app.use('/assinatura', assinaturaRoutes);
  app.use(errorMiddleware);
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => servidor.once('listening', resolve));
  const endereco = servidor.address();
  if (!endereco || typeof endereco === 'string') throw new Error('Servidor HTTP local não iniciou.');
  const base = `http://127.0.0.1:${endereco.port}`;
  const token = jwt.sign(usuario(0), process.env.JWT_SECRET!);

  try {
    const resumoVazio = await fetch(`${base}/assinatura`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal(resumoVazio.status, 200);

    const contratacaoHttp = await fetch(`${base}/assinatura/contratacao`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': 'contratacao-http-0001',
      },
      body: JSON.stringify({
        plano: 'BASICO',
        periodicidade: 'MENSAL',
        formasPagamento: ['CREDIT_CARD'],
        termosVersao: '2026-09-15',
        ofertaVersao: '2026-09-15',
        aceite: true,
      }),
    });
    assert.equal(contratacaoHttp.status, 201);
    const corpoContratacao = await contratacaoHttp.json() as Linha;
    assert.equal(corpoContratacao.assinatura.status, 'PRE_CADASTRO');
    assert.match(corpoContratacao.checkout.checkoutUrl, /^http:\/\/127\.0\.0\.1/);
    const assinaturaA = assinaturas[0];

    const eventoCheckout = payloadEvento({
      id: 'evt-checkout-a',
      tipo: 'CHECKOUT_PAID',
      data: agoraBase,
      recurso: 'checkout',
      recursoId: assinaturaA.checkoutExternoId,
      referencia: assinaturaA.id,
      assinaturaId: 'sub-fake-a',
      customer: 'cus-fake-a',
    });
    const webhookHttp = await fetch(`${base}/assinatura/webhooks/asaas`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN!,
      },
      body: JSON.stringify(eventoCheckout),
    });
    assert.equal(webhookHttp.status, 200);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(assinaturaA.status, 'TESTE');
    assert.equal(assinaturaA.testeFim.toISOString(), new Date(new Date(assinaturaA.aceiteEm).getTime() + 7 * 86400000).toISOString(), 'o vencimento contratado não reinicia no webhook');

    const webhookDuplicado = await fetch(`${base}/assinatura/webhooks/asaas`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'asaas-access-token': process.env.ASAAS_WEBHOOK_TOKEN! },
      body: JSON.stringify(eventoCheckout),
    });
    assert.equal(webhookDuplicado.status, 200);
    assert.equal((await webhookDuplicado.json() as Linha).duplicate, true);

    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-atrasado-a',
      tipo: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
      data: new Date('2026-09-14T12:00:00-03:00'),
      recurso: 'payment',
      recursoId: 'pay-antigo-a',
      assinaturaId: 'sub-fake-a',
    }), agoraBase);
    assert.equal(assinaturaA.status, 'TESTE', 'evento antigo não pode regredir o estado');

    const dataRecusa = new Date('2026-09-22T12:00:00-03:00');
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-recusa-a',
      tipo: 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED',
      data: dataRecusa,
      recurso: 'payment',
      recursoId: 'pay-a',
      assinaturaId: 'sub-fake-a',
    }), dataRecusa);
    assert.equal(assinaturaA.status, 'PAGAMENTO_PENDENTE');
    assert.ok(!assinaturaA.toleranciaAte, 'webhook não comprova aviso ao administrador');
    const { AvisoPagamentoService } = await import('../src/services/avisoPagamento.service');
    await AvisoPagamentoService.registrar(usuario(0), dataRecusa);
    assert.equal(assinaturaA.toleranciaAte.toISOString(), '2026-09-29T15:00:00.000Z');

    const dataPagamento = new Date('2026-09-24T12:00:00-03:00');
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-pagamento-a',
      tipo: 'PAYMENT_CONFIRMED',
      data: dataPagamento,
      recurso: 'payment',
      recursoId: 'pay-a',
      assinaturaId: 'sub-fake-a',
      dueDate: '2026-09-24',
    }), dataPagamento);
    assert.equal(assinaturaA.status, 'ATIVA');
    assert.equal(assinaturaA.cicloFim.toISOString(), '2026-10-24T15:00:00.000Z');
    assert.equal(assinaturaA.toleranciaAte, null);

    const upgrade = await AssinaturaOperacionalService.solicitarMudanca(usuario(0), {
      planoDestino: 'PRO',
      ofertaVersao: '2026-09-15',
      aceite: true,
      formasPagamento: ['PIX'],
      chaveIdempotencia: 'upgrade-local-0001',
    }, provedorAssinatura, new Date('2026-09-25T12:00:00-03:00'));
    assert.equal(upgrade.mudanca.status, 'AGUARDANDO_PAGAMENTO');
    assert.ok(upgrade.mudanca.valorAdicionalCentavos > 0);
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-upgrade-a',
      tipo: 'CHECKOUT_PAID',
      data: new Date('2026-09-25T12:05:00-03:00'),
      recurso: 'checkout',
      recursoId: upgrade.mudanca.checkoutExternoId,
      referencia: `mudanca:${upgrade.mudanca.id}`,
    }), new Date('2026-09-25T12:05:00-03:00'));
    assert.equal(assinaturaA.plano, 'PRO');
    assert.equal(upgrade.mudanca.status, 'EFETIVADA');

    const periodicidade = await AssinaturaOperacionalService.solicitarMudanca(usuario(0), {
      periodicidadeDestino: 'ANUAL',
      ofertaVersao: '2026-09-15',
      aceite: true,
      chaveIdempotencia: 'periodo-local-0001',
    }, provedorAssinatura, new Date('2026-09-26T12:00:00-03:00'));
    assert.equal(periodicidade.mudanca.status, 'AGENDADA');
    await AssinaturaOperacionalService.processarMudancasAgendadas(new Date('2026-10-24T12:01:00-03:00'));
    assert.equal(assinaturaA.periodicidade, 'ANUAL');
    assert.equal(assinaturaA.cicloFim.toISOString(), '2026-10-24T15:00:00.000Z', 'mudança não cria período pago sem confirmação');
    await registrarEProcessar(WebhookAsaasService, payloadEvento({ id: 'evt-renovacao-anual-a', tipo: 'PAYMENT_CONFIRMED', data: new Date('2026-10-24T12:02:00-03:00'), recurso: 'payment', recursoId: 'pay-anual-a', assinaturaId: 'sub-fake-a', dueDate: '2026-10-24' }), new Date('2026-10-24T12:02:00-03:00'));
    assert.equal(assinaturaA.cicloFim.toISOString(), '2027-10-24T15:00:00.000Z');

    contagens.set('barb-a', { barbeiros: 9, clientes: 201 });
    const downgrade = await AssinaturaOperacionalService.solicitarMudanca(usuario(0), {
      planoDestino: 'BASICO',
      ofertaVersao: '2026-09-15',
      aceite: true,
      chaveIdempotencia: 'downgrade-local-0001',
    }, provedorAssinatura, new Date('2026-11-01T12:00:00-03:00'));
    assert.equal(downgrade.mudanca.status, 'AGENDADA');
    assert.equal(assinaturaA.renovacaoAutomatica, true, 'cancelamento por excesso aguarda data e confirmação externa');
    await AssinaturaOperacionalService.processarMudancasAgendadas(new Date('2027-10-24T12:01:00-03:00'));
    assert.equal(assinaturaA.status, 'CONSULTA_EXPORTACAO');
    assert.equal(assinaturaA.consultaExportacaoAte.toISOString(), '2027-11-23T15:00:00.000Z');
    await validarEscritaAssinatura('barb-a', 'GET', '/relatorios');
    await assert.rejects(validarEscritaAssinatura('barb-a', 'POST', '/servicos'), /consulta e exportação/);

    const fakeB = new ProvedorAssinaturaFakeLocal('test');
    const contratoB = await AssinaturaOperacionalService.iniciarContratacao(usuario(1), {
      plano: 'BASICO', periodicidade: 'ANUAL', formasPagamento: ['CREDIT_CARD'],
      termosVersao: '2026-09-15', ofertaVersao: '2026-09-15', aceite: true,
      chaveIdempotencia: 'contrato-local-b-0001',
    }, fakeB, agoraBase);
    const assinaturaB = localizarUnico(assinaturas, { barbeariaId: 'barb-b' })!;
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-checkout-b', tipo: 'CHECKOUT_PAID', data: agoraBase, recurso: 'checkout',
      recursoId: assinaturaB.checkoutExternoId, referencia: assinaturaB.id, assinaturaId: 'sub-fake-b',
    }), agoraBase);
    const recusaB = new Date('2026-09-22T12:00:00-03:00');
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-recusa-b', tipo: 'PAYMENT_OVERDUE', data: recusaB, recurso: 'payment',
      recursoId: 'pay-b', assinaturaId: 'sub-fake-b',
    }), recusaB);
    await AvisoPagamentoService.registrar(usuario(1), recusaB);
    await AssinaturaOperacionalService.processarToleranciasVencidas(fakeB, new Date('2026-09-29T12:01:00-03:00'));
    assert.equal(assinaturaB.status, 'CONSULTA_EXPORTACAO');
    assert.equal(assinaturaB.consultaExportacaoAte.toISOString(), '2026-10-29T15:00:00.000Z');
    assert.equal('divida' in assinaturaB, false, 'o fluxo não cria dívida interna');

    const fakeC = new ProvedorAssinaturaFakeLocal('test');
    const contratoC = await AssinaturaOperacionalService.iniciarContratacao(usuario(2), {
      plano: 'BASICO', periodicidade: 'MENSAL', formasPagamento: ['CREDIT_CARD'],
      termosVersao: '2026-09-15', ofertaVersao: '2026-09-15', aceite: true,
      chaveIdempotencia: 'contrato-local-c-0001',
    }, fakeC, agoraBase);
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-checkout-c', tipo: 'CHECKOUT_PAID', data: agoraBase, recurso: 'checkout',
      recursoId: contratoC.assinatura.checkoutExternoId, referencia: contratoC.assinatura.id, assinaturaId: 'sub-fake-c',
    }), agoraBase);
    const cancelamentoTeste = await AssinaturaService.solicitarCancelamento(usuario(2), {
      confirmacaoNome: 'Barbearia C', motivo: 'Teste local', chaveIdempotencia: 'cancelar-local-c-0001',
    }, fakeC);
    assert.equal(cancelamentoTeste.solicitacao.status, 'RENOVACAO_CANCELADA');
    assert.equal(cancelamentoTeste.solicitacao.fimAcessoEm.toISOString(), '2026-09-22T15:00:00.000Z', 'cancelamento durante teste preserva os 7 dias');

    const fakeD = new ProvedorAssinaturaFakeLocal('test');
    const contratoD = await AssinaturaOperacionalService.iniciarContratacao(usuario(3), {
      plano: 'BASICO', periodicidade: 'MENSAL', formasPagamento: ['CREDIT_CARD'],
      termosVersao: '2026-09-15', ofertaVersao: '2026-09-15', aceite: true,
      chaveIdempotencia: 'contrato-local-d-0001',
    }, fakeD, agoraBase);
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-checkout-d', tipo: 'CHECKOUT_PAID', data: agoraBase, recurso: 'checkout',
      recursoId: contratoD.assinatura.checkoutExternoId, referencia: contratoD.assinatura.id, assinaturaId: 'sub-fake-d',
    }), agoraBase);
    await registrarEProcessar(WebhookAsaasService, payloadEvento({
      id: 'evt-pago-d', tipo: 'PAYMENT_RECEIVED', data: new Date('2026-09-22T12:00:00-03:00'), recurso: 'payment',
      recursoId: 'pay-d', assinaturaId: 'sub-fake-d', dueDate: '2026-09-22',
    }), new Date('2026-09-22T12:00:00-03:00'));
    const cancelamentoPago = await AssinaturaService.registrarCancelamentoRecebidoPorEmail({
      emailAdministrador: 'ADMIN-D@TESTE.LOCAL',
      motivo: 'Solicitação por e-mail',
      chaveIdempotencia: 'cancelar-email-d-0001',
    }, fakeD);
    assert.equal(cancelamentoPago.solicitacao.canal, 'EMAIL');
    assert.equal(cancelamentoPago.solicitacao.fimAcessoEm.toISOString(), '2026-10-22T15:00:00.000Z', 'cancelamento após pagamento preserva o ciclo');

    console.log('✅ Fluxo local ponta a ponta: HTTP, teste 7 dias, mensal/anual, aprovação/recusa, tolerância sem dívida, 30 dias, upgrade, downgrade, periodicidade, cancelamento sistema/e-mail e eventos duplicados/fora de ordem.');
  } finally {
    await new Promise<void>((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()));
  }
}

main().finally(() => mock.timers.reset()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
