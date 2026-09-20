import {
  Prisma,
  StatusAssinatura,
  StatusCancelamentoAssinatura,
  StatusEventoWebhookAsaas,
  StatusMudancaAssinatura,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { provedorAssinatura } from '../integrations/assinaturas/provedorAssinatura';
import { EVENTOS_REVERSAO } from '../domain/assinatura/eventosFinanceiros';
import {
  calcularFimCiclo,
  calcularFimConsultaExportacao,
  calcularFimTeste,
  obterPrecoCiclo,
  avaliarDowngradeParaBasico,
} from '../domain/assinatura/regrasAssinatura';

type Registro = Record<string, unknown>;

interface EventoNormalizado {
  eventoExternoId: string;
  tipo: string;
  ocorridoEm: Date | null;
  recursoTipo: 'checkout' | 'subscription' | 'payment' | null;
  recursoExternoId: string | null;
  referenciaExterna: string | null;
  resumo: Registro;
}

function objeto(valor: unknown): Registro | null {
  return valor && typeof valor === 'object' && !Array.isArray(valor)
    ? valor as Registro
    : null;
}

function texto(valor: unknown, maximo = 250): string | null {
  return typeof valor === 'string' && valor.trim()
    ? valor.trim().slice(0, maximo)
    : null;
}

function numero(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

function dataProvedor(valor: unknown): Date | null {
  const dataTexto = texto(valor, 40);
  if (!dataTexto) return null;
  const normalizada = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dataTexto)
    ? `${dataTexto.replace(' ', 'T')}-03:00`
    : dataTexto;
  const data = new Date(normalizada);
  return Number.isNaN(data.getTime()) ? null : data;
}

function normalizarEvento(payload: unknown): EventoNormalizado {
  const raiz = objeto(payload);
  const eventoExternoId = texto(raiz?.id, 200);
  const tipo = texto(raiz?.event, 100);
  if (!eventoExternoId || !tipo) throw new Error('Evento Asaas sem identificador ou tipo válido.');

  const recursoTipo = raiz?.checkout ? 'checkout'
    : raiz?.subscription ? 'subscription'
      : raiz?.payment ? 'payment'
        : null;
  const recurso = recursoTipo ? objeto(raiz?.[recursoTipo]) : null;
  const assinaturaAninhada = objeto(recurso?.subscription);
  const referenciaExterna =
    texto(recurso?.externalReference, 200) ||
    texto(assinaturaAninhada?.externalReference, 200);
  const recursoExternoId = texto(recurso?.id, 200);

  const resumo: Registro = {
    evento: tipo,
    recursoTipo,
    recursoId: recursoExternoId,
    referenciaExterna,
    status: texto(recurso?.status, 80),
    customer: texto(recurso?.customer, 200),
    value: numero(recurso?.value),
    dueDate: texto(recurso?.dueDate, 40),
    nextDueDate: texto(recurso?.nextDueDate, 40),
    cycle: texto(recurso?.cycle, 40),
    billingType: texto(recurso?.billingType, 40),
    subscriptionId:
      texto(recurso?.subscription, 200) || texto(assinaturaAninhada?.id, 200),
    checkoutUrl: texto(recurso?.link, 1000) || texto(recurso?.url, 1000),
  };

  return {
    eventoExternoId,
    tipo,
    ocorridoEm: dataProvedor(raiz?.dateCreated),
    recursoTipo,
    recursoExternoId,
    referenciaExterna,
    resumo,
  };
}

function dataFinanceira(valor: unknown, fallback: Date): Date {
  const dataTexto = texto(valor, 40);
  if (!dataTexto) return fallback;
  const data = new Date(/^\d{4}-\d{2}-\d{2}$/.test(dataTexto) ? `${dataTexto}T12:00:00-03:00` : dataTexto);
  return Number.isNaN(data.getTime()) ? fallback : data;
}

async function localizarAssinatura(evento: any, resumo: Registro, db: Prisma.TransactionClient) {
  if (evento.referenciaExterna?.startsWith('mudanca:')) {
    const mudanca = await db.mudancaAssinatura.findUnique({ where: { id: evento.referenciaExterna.slice('mudanca:'.length) } });
    if (mudanca) return db.assinaturaSaas.findUnique({ where: { id: mudanca.assinaturaId } });
  }
  if (evento.referenciaExterna && !evento.referenciaExterna.startsWith('mudanca:')) {
    const porId = await db.assinaturaSaas.findUnique({ where: { id: evento.referenciaExterna } });
    if (porId) return porId;
  }
  if (evento.recursoTipo === 'checkout' && evento.recursoExternoId) {
    const porCheckout = await db.assinaturaSaas.findUnique({ where: { checkoutExternoId: evento.recursoExternoId } });
    if (porCheckout) return porCheckout;
  }
  const assinaturaExternaId =
    texto(resumo.subscriptionId, 200) ||
    (evento.recursoTipo === 'subscription' ? evento.recursoExternoId : null);
  if (!assinaturaExternaId) return null;
  return db.assinaturaSaas.findUnique({ where: { assinaturaExternaId } });
}

async function eventoEstaAtrasado(assinatura: any, ocorridoEm: Date | null): Promise<boolean> {
  return Boolean(
    ocorridoEm &&
    assinatura.ultimoEventoProvedorEm &&
    ocorridoEm.getTime() < assinatura.ultimoEventoProvedorEm.getTime(),
  );
}

export class WebhookAsaasService {
  static async registrar(payload: unknown) {
    const evento = normalizarEvento(payload);
    try {
      const criado = await prisma.eventoWebhookAsaas.create({
        data: {
          eventoExternoId: evento.eventoExternoId,
          tipo: evento.tipo,
          ocorridoEm: evento.ocorridoEm,
          recursoTipo: evento.recursoTipo,
          recursoExternoId: evento.recursoExternoId,
          referenciaExterna: evento.referenciaExterna,
          resumo: evento.resumo as Prisma.InputJsonValue,
        },
      });
      return { duplicado: false, eventoId: criado.id };
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError ||
          (typeof error === 'object' && error !== null && 'code' in error)) &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const existente = await prisma.eventoWebhookAsaas.findUnique({
          where: { eventoExternoId: evento.eventoExternoId },
          select: { id: true },
        });
        return { duplicado: true, eventoId: existente?.id || null };
      }
      throw error;
    }
  }

  static async processar(eventoId: string, agora = new Date()) {
    for (let tentativa = 0; tentativa < 4; tentativa++) {
      try {
        return await prisma.$transaction(tx => this.processarEmTransacao(eventoId, agora, tx), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000,
        });
      } catch (error) {
        const falha = error as { code?: string; meta?: { code?: string } };
        const conflito = falha.code === 'P2034' || falha.code === 'P2010' && ['40001', '40P01'].includes(falha.meta?.code || '');
        if (conflito && tentativa < 3) continue;
        await prisma.eventoWebhookAsaas.updateMany({
          where: { id: eventoId, status: { in: [StatusEventoWebhookAsaas.PENDENTE, StatusEventoWebhookAsaas.FALHA, StatusEventoWebhookAsaas.PROCESSANDO] } },
          data: { status: StatusEventoWebhookAsaas.FALHA, ultimoErro: (error instanceof Error ? error.message : 'Falha no evento').slice(0, 500) },
        });
        throw error;
      }
    }
    return { processado: false, motivo: 'CONCORRENCIA' };
  }

  private static async processarEmTransacao(eventoId: string, agora: Date, db: Prisma.TransactionClient) {
    const reservado = await db.eventoWebhookAsaas.updateMany({
      where: {
        id: eventoId,
        OR: [
          { status: { in: [StatusEventoWebhookAsaas.PENDENTE, StatusEventoWebhookAsaas.FALHA] } },
          { status: StatusEventoWebhookAsaas.PROCESSANDO, updatedAt: { lte: new Date(agora.getTime() - 10 * 60_000) } },
        ],
      },
      data: {
        status: StatusEventoWebhookAsaas.PROCESSANDO,
        tentativas: { increment: 1 },
        ultimoErro: null,
        updatedAt: agora,
      },
    });
    if (reservado.count === 0) return { processado: false, motivo: 'JA_RESERVADO_OU_FINALIZADO' };

    try {
      const evento = await db.eventoWebhookAsaas.findUnique({ where: { id: eventoId } });
      if (!evento) return { processado: false, motivo: 'NAO_ENCONTRADO' };
      const resumo = objeto(evento.resumo) || {};

      if (
        evento.recursoTipo === 'checkout' &&
        evento.referenciaExterna?.startsWith('mudanca:')
      ) {
        const mudancaId = evento.referenciaExterna.slice('mudanca:'.length);
        const mudanca = await db.mudancaAssinatura.findUnique({ where: { id: mudancaId } });
        if (!mudanca) throw new Error('Mudança ainda não localizada; aguardar reconciliação.');
        if (evento.tipo === 'CHECKOUT_CREATED' && mudanca.checkoutExternoId === '__CRIACAO_PENDENTE__') {
          if (!evento.recursoExternoId) throw new Error('Checkout criado sem ID.');
          await db.mudancaAssinatura.update({ where: { id: mudanca.id }, data: { checkoutExternoId: evento.recursoExternoId, checkoutUrl: texto(resumo.checkoutUrl, 1000) } });
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
          return { processado: true, motivo: 'CHECKOUT_MUDANCA_RECUPERADO' };
        }
        if (mudanca.status !== StatusMudancaAssinatura.AGUARDANDO_PAGAMENTO) {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'MUDANCA_INEXISTENTE_OU_FINALIZADA' };
        }
        if (['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(evento.tipo)) {
          if (mudanca.checkoutExternoId !== evento.recursoExternoId) throw new Error('Checkout cancelado divergente da mudança.');
          await db.mudancaAssinatura.update({ where: { id: mudanca.id }, data: { status: StatusMudancaAssinatura.CANCELADA, checkoutUrl: null, checkoutExternoId: null, checkoutExpiraEm: null } });
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
          return { processado: true, motivo: 'CHECKOUT_MUDANCA_ENCERRADO' };
        }
        if (evento.tipo !== 'CHECKOUT_PAID') {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'MUDANCA_SEM_PAGAMENTO' };
        }
        if (mudanca.checkoutExternoId && mudanca.checkoutExternoId !== evento.recursoExternoId) throw new Error('Checkout divergente da mudança reservada.');
        if (typeof resumo.value === 'number' && Math.round(resumo.value * 100) !== mudanca.valorAdicionalCentavos) throw new Error('Valor pago diverge da cotação de upgrade.');
        await db.$queryRaw(Prisma.sql`SELECT id FROM assinaturas_saas WHERE id = ${mudanca.assinaturaId} FOR UPDATE`);
        const atual = await db.assinaturaSaas.findUnique({ where: { id: mudanca.assinaturaId } });
        if (!atual?.assinaturaExternaId || !atual.cicloFim || atual.cicloFim <= agora) throw new Error('Upgrade sem assinatura recorrente ou período pago vigente.');
        const recorrencia = await provedorAssinatura.atualizarRecorrencia({
          assinaturaExternaId: atual.assinaturaExternaId,
          valorCentavos: obterPrecoCiclo(mudanca.planoDestino, mudanca.periodicidadeDestino),
          periodicidade: mudanca.periodicidadeDestino, proximoVencimento: atual.cicloFim,
        });
        if (recorrencia.estado !== 'CONFIRMADO') throw new Error('Recorrência do upgrade ainda não confirmada: ' + recorrencia.mensagem);
        await Promise.all([
          db.assinaturaSaas.update({
            where: { id: mudanca.assinaturaId },
            data: {
              plano: mudanca.planoDestino,
              precoCicloCentavos: obterPrecoCiclo(mudanca.planoDestino, mudanca.periodicidadeDestino),
              ultimoEventoProvedorEm: evento.ocorridoEm || agora,
            },
          }),
          db.mudancaAssinatura.update({
            where: { id: mudanca.id },
            data: { status: StatusMudancaAssinatura.EFETIVADA },
          }),
        ]);
        await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
        return { processado: true, motivo: 'UPGRADE_CONFIRMADO' };
      }

      const localizada = await localizarAssinatura(evento, resumo, db);
      if (!localizada) {
        throw new Error('Assinatura ainda não localizada; aguardar reconciliação.');
      }
      await db.$queryRaw(Prisma.sql`SELECT id FROM assinaturas_saas WHERE id = ${localizada.id} FOR UPDATE`);
      const assinatura = await db.assinaturaSaas.findUnique({ where: { id: localizada.id } });
      if (!assinatura) throw new Error('Assinatura deixou de existir durante o processamento.');
      if (!evento.tipo.startsWith('PAYMENT_') && await eventoEstaAtrasado(assinatura, evento.ocorridoEm)) {
        await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
        return { processado: true, motivo: 'EVENTO_FORA_DE_ORDEM' };
      }

      const dataEvento = evento.ocorridoEm || agora;
      const assinaturaExternaId =
        texto(resumo.subscriptionId, 200) ||
        (evento.recursoTipo === 'subscription' ? evento.recursoExternoId : null);

      // Referência interna não substitui a conferência dos vínculos do provedor.
      if (assinatura.assinaturaExternaId && assinaturaExternaId && assinatura.assinaturaExternaId !== assinaturaExternaId) throw new Error('Assinatura externa divergente do contrato.');
      if (assinatura.clienteExternoId && resumo.customer && assinatura.clienteExternoId !== resumo.customer) throw new Error('Cliente externo divergente do contrato.');

      if (EVENTOS_REVERSAO.includes(evento.tipo)) {
        if (evento.recursoTipo !== 'payment' || !evento.recursoExternoId) throw new Error('Reversão sem cobrança identificada.');
        const resolucaoPosterior = await db.eventoWebhookAsaas.findFirst({ where: {
          recursoExternoId: evento.recursoExternoId, tipo: { in: EVENTOS_REVERSAO }, status: StatusEventoWebhookAsaas.PROCESSADO,
          resumo: { path: ['revisaoResolvida'], equals: true },
        } });
        const dataResolucao = texto(objeto(resolucaoPosterior?.resumo)?.resolvidaEm, 40);
        if (evento.tipo !== 'PAYMENT_REFUNDED' && evento.ocorridoEm && dataResolucao && evento.ocorridoEm < new Date(dataResolucao)) {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'REVERSAO_ANTIGA_JA_RECONCILIADA' };
        }
        await db.eventoWebhookAsaas.update({ where: { id: evento.id }, data: {
          resumo: { ...resumo, assinaturaLocalId: assinatura.id, revisaoResolvida: false,
            revisaoUpgrade: evento.referenciaExterna?.startsWith('mudanca:') || false, cicloFimRevisao: assinatura.cicloFim?.toISOString() || null } as Prisma.InputJsonValue,
        } });
        // Somente um estorno total do período vigente retira o acesso de escrita.
        // Disputas e estornos parciais preservam o período; não geram outra cobrança.
        if (evento.tipo === 'PAYMENT_REFUNDED' && assinatura.ultimaCobrancaExternaId === evento.recursoExternoId &&
          assinatura.status === StatusAssinatura.ATIVA && assinatura.cicloFim && assinatura.cicloFim > agora) {
          await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: {
            status: StatusAssinatura.CONSULTA_EXPORTACAO, fimAcessoEm: agora,
            consultaExportacaoAte: calcularFimConsultaExportacao(agora),
          } });
        }
        await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
        return { processado: true, motivo: 'REVERSAO_REGISTRADA' };
      }

      if (evento.tipo === 'CHECKOUT_CREATED') {
        if (assinatura.checkoutExternoId === '__CRIACAO_PENDENTE__' && evento.recursoExternoId) {
          await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: { checkoutExternoId: evento.recursoExternoId, checkoutUrl: texto(resumo.checkoutUrl, 1000) } });
        }
      } else if (evento.tipo === 'CHECKOUT_PAID' || evento.tipo === 'SUBSCRIPTION_CREATED') {
        const unidade = await db.barbearia.findUnique({ where: { id: assinatura.barbeariaId }, select: { legadoAssinatura: true } });
        // A confirmação de criação da assinatura não é confirmação de pagamento.
        // Legados aguardam pagamento e nunca recebem outro teste gratuito.
        if (unidade?.legadoAssinatura || assinatura.status !== StatusAssinatura.PRE_CADASTRO) {
          await db.assinaturaSaas.update({ where: { id: assinatura.id }, data: {
            assinaturaExternaId: assinaturaExternaId || assinatura.assinaturaExternaId,
            clienteExternoId: texto(resumo.customer, 200) || assinatura.clienteExternoId,
          } });
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
          return { processado: true, motivo: 'CRIACAO_CONFIRMADA_SEM_REINICIAR_ACESSO' };
        }
        const testeInicio = assinatura.testeInicio || assinatura.aceiteEm || dataEvento;
        const testeFim = assinatura.testeFim || assinatura.proximaCobrancaEm || calcularFimTeste(testeInicio);
        await db.assinaturaSaas.update({
          where: { id: assinatura.id },
          data: {
            status: StatusAssinatura.TESTE,
            testeInicio,
            testeFim,
            proximaCobrancaEm: assinatura.proximaCobrancaEm || testeFim,
            clienteExternoId: texto(resumo.customer, 200),
            assinaturaExternaId: assinaturaExternaId || assinatura.assinaturaExternaId,
            checkoutUrl: null,
          },
        });
      } else if (['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(evento.tipo)) {
        const reversoes = await db.eventoWebhookAsaas.findMany({
          where: { recursoExternoId: evento.recursoExternoId, tipo: { in: EVENTOS_REVERSAO }, status: { not: StatusEventoWebhookAsaas.IGNORADO } },
          orderBy: [{ ocorridoEm: 'desc' }, { recebidoEm: 'desc' }],
        });
        if (reversoes.length) {
          const total = reversoes.some(e => e.tipo === 'PAYMENT_REFUNDED');
          const posterior = reversoes.every(e => e.ocorridoEm && evento.ocorridoEm && evento.ocorridoEm > e.ocorridoEm);
          if (total || !posterior) {
            await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
            return { processado: true, motivo: 'CONFIRMACAO_ANTIGA_OU_PAGAMENTO_ESTORNADO' };
          }
          const consulta = await provedorAssinatura.consultarCobranca?.({ cobrancaExternaId: evento.recursoExternoId!, assinaturaExternaId: assinatura.assinaturaExternaId || '', clienteExternoId: assinatura.clienteExternoId || '' });
          if (consulta?.estado !== 'CONFIRMADO' || !['CONFIRMED', 'RECEIVED'].includes(consulta.status || '')) throw new Error('Reversão aguarda confirmação financeira no provedor.');
          for (const reversao of reversoes) {
            await db.eventoWebhookAsaas.update({ where: { id: reversao.id }, data: {
              resumo: { ...(objeto(reversao.resumo) || {}), assinaturaLocalId: assinatura.id, revisaoResolvida: true, resolvidaEm: evento.ocorridoEm!.toISOString() } as Prisma.InputJsonValue,
              status: StatusEventoWebhookAsaas.PROCESSADO, processadoEm: agora,
            } });
          }
        }
        let cicloInicio = dataFinanceira(resumo.dueDate, dataEvento);
        const vencimentoReservado = assinatura.proximaCobrancaEm || assinatura.testeFim;
        if (vencimentoReservado && typeof resumo.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(resumo.dueDate)) {
          const diaReservado = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(vencimentoReservado);
          if (diaReservado === resumo.dueDate) cicloInicio = vencimentoReservado;
        }
        if ((assinatura.cicloInicio && cicloInicio < assinatura.cicloInicio) ||
            (assinatura.ultimaCobrancaExternaId === evento.recursoExternoId && assinatura.cicloInicio &&
              (assinatura.status !== StatusAssinatura.PAGAMENTO_PENDENTE || cicloInicio <= assinatura.cicloInicio))) {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'CICLO_PAGO_JA_CONFIRMADO_OU_ANTIGO' };
        }
        if (!assinatura.renovacaoAutomatica && ['CONSULTA_EXPORTACAO', 'ENCERRADA'].includes(assinatura.status)) throw new Error('Pagamento após encerramento confirmado exige reconciliação manual.');
        if (!assinatura.renovacaoAutomatica && assinatura.fimAcessoEm && cicloInicio >= assinatura.fimAcessoEm) throw new Error('Pagamento após encerramento exige reconciliação, sem reativação automática.');
        // A confirmação financeira pode chegar antes do cron de renovação.
        // A oferta aceita e o valor pago determinam o novo ciclo, não a ordem
        // em que o job e o webhook foram executados.
        const agendadas = await db.mudancaAssinatura.findMany({
          where: { assinaturaId: assinatura.id, status: StatusMudancaAssinatura.AGENDADA, efetivarEm: { lte: cicloInicio } },
          orderBy: { efetivarEm: 'asc' }, take: 2,
        });
        if (agendadas.length > 1) throw new Error('Mais de uma mudança vigente exige reconciliação da oferta.');
        const mudancaAgendada = agendadas[0];
        const planoPago = mudancaAgendada?.planoDestino || assinatura.plano;
        const periodoPago = mudancaAgendada?.periodicidadeDestino || assinatura.periodicidade;
        const precoPago = mudancaAgendada ? obterPrecoCiclo(planoPago, periodoPago) : assinatura.precoCicloCentavos;
        if (mudancaAgendada) {
          if (!mudancaAgendada.efetivarEm || agora < mudancaAgendada.efetivarEm) throw new Error('Pagamento antecipado aguarda a data da mudança contratada.');
          if (typeof resumo.value !== 'number' || Math.round(resumo.value * 100) !== precoPago) throw new Error('Valor do pagamento não confirma a oferta da mudança agendada.');
          if (mudancaAgendada.planoOrigem === 'PRO' && planoPago === 'BASICO') {
            const [barbeirosAtivos, clientes] = await Promise.all([
              db.barbeiro.count({ where: { barbeariaId: assinatura.barbeariaId, ativo: true } }),
              db.cliente.findMany({ where: { OR: [
                { barbeariaId: assinatura.barbeariaId, clientesBarbearias: { none: { barbeariaId: assinatura.barbeariaId } } },
                { clientesBarbearias: { some: { barbeariaId: assinatura.barbeariaId, ativo: true } } },
              ] }, select: { id: true } }),
            ]);
            if (!avaliarDowngradeParaBasico({ barbeirosAtivos, clientesAtivos: clientes.length, chegouRenovacao: true }).enquadrada) {
              throw new Error('Pagamento de downgrade com cadastros excedentes exige reconciliação; não há redução automática.');
            }
          }
        } else if (typeof resumo.value === 'number' && Math.round(resumo.value * 100) !== precoPago) {
          throw new Error('Valor pago diverge do ciclo contratado; aguardar reconciliação.');
        }
        const cicloFim = calcularFimCiclo(cicloInicio, periodoPago);
        await db.assinaturaSaas.update({
          where: { id: assinatura.id },
          data: {
            status: StatusAssinatura.ATIVA,
            plano: planoPago,
            periodicidade: periodoPago,
            precoCicloCentavos: precoPago,
            cicloInicio,
            cicloFim,
            proximaCobrancaEm: cicloFim,
            avisoPagamentoEm: null,
            toleranciaAte: null,
            fimAcessoEm: null,
            consultaExportacaoAte: null,
            ultimaCobrancaExternaId: evento.recursoExternoId,
            ultimoEventoProvedorEm: dataEvento,
          },
        });
        if (mudancaAgendada) await db.mudancaAssinatura.update({ where: { id: mudancaAgendada.id }, data: { status: StatusMudancaAssinatura.EFETIVADA } });
      } else if (['PAYMENT_OVERDUE', 'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED', 'PAYMENT_REPROVED_BY_RISK_ANALYSIS'].includes(evento.tipo)) {
        const vencimento = dataFinanceira(resumo.dueDate, dataEvento);
        if (assinatura.status === StatusAssinatura.TESTE && assinatura.testeFim && vencimento < assinatura.testeFim) {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'RECUSA_ANTERIOR_AO_VENCIMENTO_DO_TESTE' };
        }

        if (assinatura.cicloFim && (vencimento < assinatura.cicloFim ||
            assinatura.status === StatusAssinatura.ATIVA && assinatura.ultimaCobrancaExternaId === evento.recursoExternoId)) {
          await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
          return { processado: true, motivo: 'RECUSA_DE_CICLO_JA_PAGO' };
        }
        if (
          assinatura.status !== StatusAssinatura.CONSULTA_EXPORTACAO &&
          assinatura.status !== StatusAssinatura.ENCERRADA
        ) {
          await db.assinaturaSaas.update({
            where: { id: assinatura.id },
            data: {
              status: StatusAssinatura.PAGAMENTO_PENDENTE,
              // O webhook não comprova que o administrador recebeu um aviso.
              // O endpoint de confirmação após renderização inicia os sete dias.
              avisoPagamentoEm: assinatura.avisoPagamentoEm,
              toleranciaAte: assinatura.toleranciaAte,
              ultimaCobrancaExternaId: evento.recursoExternoId,
              ultimoEventoProvedorEm: dataEvento,
            },
          });
        }
      } else if (evento.tipo === 'SUBSCRIPTION_DELETED') {
        const fimAcesso =
          assinatura.fimAcessoEm ||
          assinatura.cicloFim ||
          assinatura.testeFim ||
          dataEvento;
        const acessoJaTerminou = fimAcesso.getTime() <= agora.getTime();
        await Promise.all([
          db.assinaturaSaas.update({
            where: { id: assinatura.id },
            data: {
              renovacaoAutomatica: false,
              fimAcessoEm: fimAcesso,
              status: acessoJaTerminou ? StatusAssinatura.CONSULTA_EXPORTACAO : assinatura.status,
              consultaExportacaoAte: acessoJaTerminou
                ? calcularFimConsultaExportacao(fimAcesso)
                : assinatura.consultaExportacaoAte,
              ultimoEventoProvedorEm: dataEvento,
            },
          }),
          db.solicitacaoCancelamentoAssinatura.updateMany({
            where: { assinaturaId: assinatura.id, aberta: true },
            data: {
              status: StatusCancelamentoAssinatura.RENOVACAO_CANCELADA,
              aberta: null,
              cancelamentoConfirmadoEm: dataEvento,
              fimAcessoEm: fimAcesso,
              ultimoErroProvedor: null,
            },
          }),
        ]);
      } else if (['CHECKOUT_CANCELED', 'CHECKOUT_EXPIRED'].includes(evento.tipo)) {
        if (assinatura.status === StatusAssinatura.PRE_CADASTRO) {
          if (assinatura.checkoutExternoId !== '__CRIACAO_PENDENTE__' && assinatura.checkoutExternoId !== evento.recursoExternoId) throw new Error('Checkout cancelado divergente da assinatura.');
          await db.assinaturaSaas.update({
            where: { id: assinatura.id },
            data: { checkoutUrl: null, checkoutExternoId: null, checkoutExpiraEm: null, ultimoEventoProvedorEm: dataEvento },
          });
        }
      } else {
        await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.IGNORADO, agora);
        return { processado: true, motivo: 'TIPO_NAO_TRATADO' };
      }

      await this.finalizarEvento(db, evento.id, StatusEventoWebhookAsaas.PROCESSADO, agora);
      return { processado: true };
    } catch (error) {
      throw error;
    }
  }

  private static async finalizarEvento(
    db: Prisma.TransactionClient,
    id: string,
    status: StatusEventoWebhookAsaas,
    agora: Date,
  ) {
    await db.eventoWebhookAsaas.update({
      where: { id },
      data: { status, processadoEm: agora, ultimoErro: null },
    });
  }

  static async reprocessarPendentes(limite = 50, agora = new Date()) {
    const eventos = await prisma.eventoWebhookAsaas.findMany({
      where: { OR: [
        { status: StatusEventoWebhookAsaas.PENDENTE },
        { status: StatusEventoWebhookAsaas.FALHA, updatedAt: { lte: new Date(agora.getTime() - 60_000) } },
        { status: StatusEventoWebhookAsaas.PROCESSANDO, updatedAt: { lte: new Date(agora.getTime() - 10 * 60_000) } },
      ] },
      orderBy: [{ status: 'asc' }, { ocorridoEm: 'asc' }, { recebidoEm: 'asc' }],
      take: Math.max(1, Math.min(limite, 100)),
      select: { id: true },
    });
    const resultados: Array<{ processado: boolean; motivo?: string }> = [];
    for (const evento of eventos) {
      try { resultados.push(await this.processar(evento.id, agora)); }
      catch { resultados.push({ processado: false, motivo: 'FALHA_RECUPERAVEL' }); }
    }
    return resultados;
  }
}
