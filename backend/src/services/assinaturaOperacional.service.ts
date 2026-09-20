import {
  Prisma,
  PeriodicidadeAssinatura,
  PlanoAssinatura,
  StatusAssinatura,
  StatusMudancaAssinatura,
  TipoMudancaAssinatura,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { obterRevisaoFinanceira } from './regularizacaoAssinatura.service';
import { ErroDeNegocio } from '../lib/erros';
import { TransicaoLegadoService } from './transicaoLegado.service';
import { VERSAO_DOCUMENTOS } from '../domain/privacidade/aceiteDocumentos';
import type { UsuarioJWT } from '../types';
import {
  adicionarDias,
  avaliarDowngradeParaBasico,
  calcularFimCiclo,
  calcularFimConsultaExportacao,
  calcularFimTeste,
  calcularUpgradeProporcional,
  obterPrecoCiclo,
} from '../domain/assinatura/regrasAssinatura';
import {
  FormaPagamentoCheckout,
  ProvedorAssinatura,
  provedorAssinatura,
} from '../integrations/assinaturas/provedorAssinatura';

interface DadosContratacao {
  plano: PlanoAssinatura;
  periodicidade: PeriodicidadeAssinatura;
  formasPagamento: FormaPagamentoCheckout[];
  termosVersao: string;
  ofertaVersao: string;
  aceite: boolean;
  chaveIdempotencia: string;
}

interface DadosMudanca {
  planoDestino?: PlanoAssinatura;
  periodicidadeDestino?: PeriodicidadeAssinatura;
  formasPagamento?: FormaPagamentoCheckout[];
  ofertaVersao: string;
  aceite: boolean;
  chaveIdempotencia: string;
}

const STATUS_MUTAVEIS = new Set<StatusAssinatura>([
  StatusAssinatura.TESTE,
  StatusAssinatura.ATIVA,
  StatusAssinatura.PAGAMENTO_PENDENTE,
]);

function exigirAdmin(usuario: UsuarioJWT): string {
  if (usuario.papel !== 'ADMIN' || !usuario.barbeariaId) {
    throw new ErroDeNegocio('Somente o administrador pode gerenciar a assinatura.', 403);
  }
  return usuario.barbeariaId;
}

function validarChave(valor: string): string {
  const chave = typeof valor === 'string' ? valor.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(chave)) {
    throw new ErroDeNegocio('Identificador da operação inválido. Atualize a página e tente novamente.');
  }
  return chave;
}

function validarVersao(valor: string, campo: string): string {
  const versao = typeof valor === 'string' ? valor.trim() : '';
  if (versao !== VERSAO_DOCUMENTOS) {
    throw new ErroDeNegocio(`${campo} desatualizada. Atualize a página e aceite a versão atual.`, 409);
  }
  return versao;
}

function validarFormasPagamento(valor: FormaPagamentoCheckout[] | undefined): FormaPagamentoCheckout[] {
  if (!Array.isArray(valor)) throw new ErroDeNegocio('Selecione uma forma de pagamento válida.');
  const formas = [...new Set(valor || [])];
  if (!formas.length || formas.some((forma) => !['PIX', 'CREDIT_CARD'].includes(forma))) {
    throw new ErroDeNegocio('Selecione Pix, cartão de crédito ou ambos.');
  }
  return formas;
}

function validarPlanoDisponivel(plano: PlanoAssinatura, ambiente = process.env): void {
  if (!Object.values(PlanoAssinatura).includes(plano)) throw new ErroDeNegocio('Plano inválido.');
  if (plano === PlanoAssinatura.PRO && ambiente.ASSINATURA_PRO_DISPONIVEL !== 'true') {
    throw new ErroDeNegocio('O plano Pró ainda não está disponível para contratação.', 409);
  }
}

function validarPeriodicidade(valor: PeriodicidadeAssinatura): void {
  if (!Object.values(PeriodicidadeAssinatura).includes(valor)) throw new ErroDeNegocio('Periodicidade inválida.');
}
const CHECKOUT_RESERVADO = '__CRIACAO_PENDENTE__';

async function transacaoAssinatura<T>(operacao: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let tentativa = 0; ; tentativa++) {
    try { return await prisma.$transaction(operacao, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 }); }
    catch (erro) {
      const falha = erro as { code?: string; meta?: { code?: string } };
      const concorrencia = falha.code === 'P2034' || (falha.code === 'P2010' && ['40001', '40P01'].includes(falha.meta?.code || ''));
      if (!concorrencia || tentativa >= 2) throw erro;
    }
  }
}

function serializarAssinatura(assinatura: any, provedor: ProvedorAssinatura) {
  return {
    id: assinatura.id,
    plano: assinatura.plano,
    periodicidade: assinatura.periodicidade,
    status: assinatura.status,
    precoCicloCentavos: assinatura.precoCicloCentavos,
    testeInicio: assinatura.testeInicio,
    testeFim: assinatura.testeFim,
    cicloInicio: assinatura.cicloInicio,
    cicloFim: assinatura.cicloFim,
    proximaCobrancaEm: assinatura.proximaCobrancaEm,
    renovacaoAutomatica: assinatura.renovacaoAutomatica,
    fimAcessoEm: assinatura.fimAcessoEm,
    consultaExportacaoAte: assinatura.consultaExportacaoAte,
    avisoLimiteClientesEm: assinatura.avisoLimiteClientesEm,
    avisoPagamentoEm: assinatura.avisoPagamentoEm,
    toleranciaAte: assinatura.toleranciaAte,
    checkoutUrl: assinatura.checkoutUrl,
    checkoutExpiraEm: assinatura.checkoutExpiraEm,
    formasPagamento: assinatura.formasPagamento,
    integracao: {
      provedor: provedor.nome,
      ambiente: provedor.ambiente,
      configurado: provedor.configurado,
      mensagem: provedor.motivoIndisponibilidade || null,
    },
  };
}

export class AssinaturaOperacionalService {
  static async obterResumo(
    usuario: UsuarioJWT,
    provedor: ProvedorAssinatura = provedorAssinatura,
  ) {
    const barbeariaId = exigirAdmin(usuario);
    const assinatura = await prisma.assinaturaSaas.findUnique({
      where: { barbeariaId },
      include: {
        mudancas: {
          where: { status: { in: [StatusMudancaAssinatura.AGUARDANDO_PAGAMENTO, StatusMudancaAssinatura.AGENDADA] } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const transicaoLegado = await TransicaoLegadoService.resumo(barbeariaId, assinatura, provedor);
    if (!assinatura) {
      return {
        transicaoLegado,
        assinatura: null,
        proDisponivel: process.env.ASSINATURA_PRO_DISPONIVEL === 'true',
        integracao: {
          provedor: provedor.nome,
          ambiente: provedor.ambiente,
          configurado: provedor.configurado,
          mensagem: provedor.motivoIndisponibilidade || null,
        },
      };
    }
    return {
      transicaoLegado,
      assinatura: serializarAssinatura(assinatura, provedor),
      revisaoFinanceira: await obterRevisaoFinanceira(assinatura),
      mudancasPendentes: assinatura.mudancas.map((mudanca) => ({
        id: mudanca.id,
        tipo: mudanca.tipo,
        status: mudanca.status,
        planoDestino: mudanca.planoDestino,
        periodicidadeDestino: mudanca.periodicidadeDestino,
        valorAdicionalCentavos: mudanca.valorAdicionalCentavos,
        efetivarEm: mudanca.efetivarEm,
        checkoutUrl: mudanca.checkoutUrl,
        checkoutExpiraEm: mudanca.checkoutExpiraEm,
      })),
      proDisponivel: process.env.ASSINATURA_PRO_DISPONIVEL === 'true',
    };
  }

  static async iniciarContratacao(
    usuario: UsuarioJWT,
    dados: DadosContratacao,
    provedor: ProvedorAssinatura = provedorAssinatura,
    agora = new Date(),
  ) {
    const barbeariaId = exigirAdmin(usuario);
    if (dados.aceite !== true) throw new ErroDeNegocio('É necessário aceitar os termos da oferta.');
    validarPlanoDisponivel(dados.plano);
    validarPeriodicidade(dados.periodicidade);
    const chave = validarChave(dados.chaveIdempotencia);
    const formasPagamento = validarFormasPagamento(dados.formasPagamento);
    if (formasPagamento.length !== 1 || formasPagamento[0] !== 'CREDIT_CARD') throw new ErroDeNegocio('A assinatura com renovação automática aceita somente cartão de crédito.');
    const termosVersao = validarVersao(dados.termosVersao, 'Versão dos termos');
    const ofertaVersao = validarVersao(dados.ofertaVersao, 'Versão da oferta');
    if (!provedor.configurado) {
      throw new ErroDeNegocio(
        provedor.motivoIndisponibilidade || 'A cobrança ainda não está configurada.',
        503,
      );
    }

    const [administrador, barbearia, mesmaChave, existente] = await Promise.all([
      prisma.usuario.findFirst({ where: { id: usuario.id, papel: 'ADMIN', barbeariaId }, select: { id: true } }),
      prisma.barbearia.findUnique({ where: { id: barbeariaId }, select: { id: true, nome: true, legadoAssinatura: true } }),
      prisma.assinaturaSaas.findUnique({ where: { contratacaoIdempotencia: chave } }),
      prisma.assinaturaSaas.findUnique({ where: { barbeariaId } }),
    ]);
    if (!administrador || !barbearia) throw new ErroDeNegocio('Administrador autorizado não encontrado.', 403);
    if (mesmaChave) {
      if (mesmaChave.barbeariaId !== barbeariaId) throw new ErroDeNegocio('Identificador já utilizado.', 409);
      if (mesmaChave.plano !== dados.plano || mesmaChave.periodicidade !== dados.periodicidade) throw new ErroDeNegocio('Esta solicitação já foi utilizada para outra oferta.', 409);
      if (mesmaChave.checkoutUrl || mesmaChave.status !== StatusAssinatura.PRE_CADASTRO) return { nova: false, assinatura: serializarAssinatura(mesmaChave, provedor) };
    }
    if (existente?.checkoutExternoId === CHECKOUT_RESERVADO) throw new ErroDeNegocio('A criação do checkout ainda precisa ser confirmada. Aguarde a reconciliação antes de tentar novamente.', 409);
    if (existente?.contratacaoIdempotencia && (existente.plano !== dados.plano || existente.periodicidade !== dados.periodicidade)) throw new ErroDeNegocio('Já existe uma solicitação para outra oferta. Conclua ou cancele essa operação antes de alterar o plano.', 409);
    if (existente?.checkoutExternoId && existente.checkoutUrl) {
      if (existente.plano !== dados.plano || existente.periodicidade !== dados.periodicidade) throw new ErroDeNegocio('Já existe um checkout para outra oferta. Conclua ou cancele essa operação antes de alterar o plano.', 409);
      return { nova: false, assinatura: serializarAssinatura(existente, provedor) };
    }
    if (existente && existente.status !== StatusAssinatura.PRE_CADASTRO) {
      throw new ErroDeNegocio('Esta barbearia já possui uma assinatura em andamento.', 409);
    }

    const assinatura = existente
      ? await prisma.assinaturaSaas.update({
          where: { id: existente.id },
          data: {
            plano: dados.plano,
            periodicidade: dados.periodicidade,
            precoCicloCentavos: obterPrecoCiclo(dados.plano, dados.periodicidade),
            formasPagamento,
            contratacaoIdempotencia: chave,
            ofertaVersao,
            termosVersao,
            aceiteEm: agora,
            aceitePorId: usuario.id,
          },
        })
      : await prisma.assinaturaSaas.create({
          data: {
            barbeariaId,
            plano: dados.plano,
            periodicidade: dados.periodicidade,
            status: StatusAssinatura.PRE_CADASTRO,
            precoCicloCentavos: obterPrecoCiclo(dados.plano, dados.periodicidade),
            formasPagamento,
            contratacaoIdempotencia: chave,
            ofertaVersao,
            termosVersao,
            aceiteEm: agora,
            aceitePorId: usuario.id,
          },
        });

    const primeiroVencimento = barbearia.legadoAssinatura ? agora : calcularFimTeste(agora);
    const reserva = await prisma.assinaturaSaas.updateMany({ where: { id: assinatura.id, checkoutExternoId: null }, data: { checkoutExternoId: CHECKOUT_RESERVADO } });
    if (!reserva.count) throw new ErroDeNegocio('Outra tentativa de checkout já está em processamento. Atualize a página.', 409);
    const checkout = await provedor.criarCheckoutAssinatura({
      referenciaExterna: assinatura.id,
      nomeItem: `Valen Barber ${dados.plano === PlanoAssinatura.BASICO ? 'Básico' : 'Pró'}`,
      descricao: `Assinatura ${dados.periodicidade === PeriodicidadeAssinatura.ANUAL ? 'anual' : 'mensal'}${barbearia.legadoAssinatura ? ' para barbearia existente, sem novo período de teste' : ' após 7 dias de teste'}`,
      valorCentavos: assinatura.precoCicloCentavos,
      periodicidade: dados.periodicidade,
      primeiroVencimento,
      formasPagamento,
    });
    if (checkout.estado !== 'CRIADO' || !checkout.checkoutId || !checkout.checkoutUrl) {
      if (checkout.criacaoConfirmadamenteRecusada) await prisma.assinaturaSaas.update({ where: { id: assinatura.id }, data: { checkoutExternoId: null } });
      throw new ErroDeNegocio(checkout.criacaoConfirmadamenteRecusada
        ? 'Não foi possível criar o checkout. Confira os dados e tente novamente.'
        : 'Não foi possível confirmar a criação do checkout. Aguarde a reconciliação antes de tentar novamente.', 502);
    }
    const atualizada = await prisma.assinaturaSaas.update({
      where: { id: assinatura.id },
      data: {
        checkoutExternoId: checkout.checkoutId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutExpiraEm: checkout.expiraEm,
        proximaCobrancaEm: primeiroVencimento,
      },
    });
    return { nova: true, assinatura: serializarAssinatura(atualizada, provedor), checkout };
  }

  static async solicitarMudanca(
    usuario: UsuarioJWT,
    dados: DadosMudanca,
    provedor: ProvedorAssinatura = provedorAssinatura,
    agora = new Date(),
  ) {
    const barbeariaId = exigirAdmin(usuario);
    if (dados.aceite !== true) throw new ErroDeNegocio('É necessário aceitar os termos da mudança.');
    if (dados.periodicidadeDestino !== undefined) validarPeriodicidade(dados.periodicidadeDestino);
    if (dados.planoDestino !== undefined) validarPlanoDisponivel(dados.planoDestino);
    const chave = validarChave(dados.chaveIdempotencia);
    const ofertaVersao = validarVersao(dados.ofertaVersao, 'Versão da oferta');
    const repetida = await prisma.mudancaAssinatura.findUnique({ where: { chaveIdempotencia: chave } });
    const assinatura = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId } });
    if (assinatura && await obterRevisaoFinanceira(assinatura)) throw new ErroDeNegocio('Há um pagamento em revisão. Consulte o suporte antes de alterar o plano.', 409);
    if (repetida) {
      if (!assinatura || repetida.assinaturaId !== assinatura.id) throw new ErroDeNegocio('Identificador já utilizado.', 409);
      if (repetida.checkoutExternoId === CHECKOUT_RESERVADO) throw new ErroDeNegocio('O checkout da mudança aguarda reconciliação.', 409);
      if (repetida.tipo === TipoMudancaAssinatura.UPGRADE && repetida.status === StatusMudancaAssinatura.AGUARDANDO_PAGAMENTO && !repetida.checkoutUrl) {
        return this.prepararCheckoutMudanca(repetida, dados, provedor, false);
      }
      return { nova: false, mudanca: repetida };
    }
    if (!assinatura || !STATUS_MUTAVEIS.has(assinatura.status)) {
      throw new ErroDeNegocio('Não há assinatura elegível para alteração.', 409);
    }
    const planoDestino = dados.planoDestino || assinatura.plano;
    const periodicidadeDestino = dados.periodicidadeDestino || assinatura.periodicidade;
    if (planoDestino === assinatura.plano && periodicidadeDestino === assinatura.periodicidade) {
      throw new ErroDeNegocio('Escolha um plano ou periodicidade diferente.');
    }
    validarPlanoDisponivel(planoDestino);
    if (planoDestino !== assinatura.plano && periodicidadeDestino !== assinatura.periodicidade) throw new ErroDeNegocio('Altere o plano e a periodicidade em operações separadas.', 409);

    let tipo: TipoMudancaAssinatura;
    let status: StatusMudancaAssinatura;
    let valorAdicionalCentavos = 0;
    let efetivarEm = assinatura.cicloFim;
    let limitesImpedemDowngrade = false;

    if (planoDestino === PlanoAssinatura.PRO && assinatura.plano === PlanoAssinatura.BASICO) {
      if (
        assinatura.status !== StatusAssinatura.ATIVA ||
        !assinatura.cicloInicio ||
        !assinatura.cicloFim
      ) {
        throw new ErroDeNegocio('O upgrade proporcional exige um ciclo pago ativo.', 409);
      }
      tipo = TipoMudancaAssinatura.UPGRADE;
      status = StatusMudancaAssinatura.AGUARDANDO_PAGAMENTO;
      valorAdicionalCentavos = calcularUpgradeProporcional({
        planoAtual: 'BASICO',
        planoDestino: 'PRO',
        periodicidade: assinatura.periodicidade,
        cicloInicio: assinatura.cicloInicio,
        cicloFim: assinatura.cicloFim,
        agora,
        cicloPago: true,
      }).valorAdicionalCentavos;
      efetivarEm = null;
    } else if (planoDestino === PlanoAssinatura.BASICO && assinatura.plano === PlanoAssinatura.PRO) {
      tipo = TipoMudancaAssinatura.DOWNGRADE;
      status = StatusMudancaAssinatura.AGENDADA;
      const [barbeirosAtivos, clientesAtivos] = await Promise.all([
        prisma.barbeiro.count({ where: { barbeariaId, ativo: true } }),
        prisma.clienteBarbearia.count({ where: { barbeariaId, ativo: true } }),
      ]);
      const avaliacao = avaliarDowngradeParaBasico({ barbeirosAtivos, clientesAtivos, chegouRenovacao: false });
      if (!avaliacao.enquadrada) {
        limitesImpedemDowngrade = true;
      }
    } else {
      tipo = TipoMudancaAssinatura.PERIODICIDADE;
      status = StatusMudancaAssinatura.AGENDADA;
    }

    let mudanca = await transacaoAssinatura(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assinaturas_saas WHERE id = ${assinatura.id} FOR UPDATE`;
      const atual = await tx.assinaturaSaas.findUnique({ where: { id: assinatura.id } });
      if (!atual || atual.plano !== assinatura.plano || atual.periodicidade !== assinatura.periodicidade || atual.status !== assinatura.status || atual.cicloFim?.getTime() !== assinatura.cicloFim?.getTime()) throw new ErroDeNegocio('A assinatura mudou durante a solicitação. Atualize a página.', 409);
      const pendente = await tx.mudancaAssinatura.findFirst({ where: { assinaturaId: assinatura.id, status: { in: [StatusMudancaAssinatura.AGENDADA, StatusMudancaAssinatura.AGUARDANDO_PAGAMENTO] } } });
      if (pendente) throw new ErroDeNegocio('Já existe uma mudança pendente para esta assinatura. Conclua ou cancele essa operação primeiro.', 409);
      return tx.mudancaAssinatura.create({
      data: {
        assinaturaId: assinatura.id,
        solicitadoPorId: usuario.id,
        tipo,
        status,
        planoOrigem: assinatura.plano,
        planoDestino,
        periodicidadeOrigem: assinatura.periodicidade,
        periodicidadeDestino,
        valorAdicionalCentavos,
        efetivarEm,
        chaveIdempotencia: chave,
        ofertaVersao,
        aceiteEm: agora,
      },
      });
    });

    if (tipo === TipoMudancaAssinatura.UPGRADE) {
      return this.prepararCheckoutMudanca(mudanca, dados, provedor, true);
    }
    if (!limitesImpedemDowngrade && efetivarEm && provedor.configurado && assinatura.assinaturaExternaId) {
      const resultado = await this.sincronizarMudancaAgendada(mudanca.id, assinatura.id, agora, provedor);
      if (resultado.status === 'PENDENTE') throw new ErroDeNegocio('A mudança foi registrada, mas a alteração da próxima cobrança aguarda confirmação.', 502);
    }
    return { nova: true, mudanca };
  }

  private static async prepararCheckoutMudanca(mudanca: any, dados: DadosMudanca, provedor: ProvedorAssinatura, nova: boolean) {
      if (!provedor.configurado) {
        throw new ErroDeNegocio(
          provedor.motivoIndisponibilidade || 'A cobrança do upgrade ainda não está configurada.',
          503,
        );
      }
      const formas = validarFormasPagamento(dados.formasPagamento || ['PIX', 'CREDIT_CARD']);
      const reserva = await prisma.mudancaAssinatura.updateMany({ where: { id: mudanca.id, checkoutExternoId: null }, data: { checkoutExternoId: CHECKOUT_RESERVADO } });
      if (!reserva.count) throw new ErroDeNegocio('Outra tentativa de checkout já está em processamento.', 409);
      const checkout = await provedor.criarCheckoutAvulso({
        referenciaExterna: `mudanca:${mudanca.id}`,
        nomeItem: 'Upgrade para o plano Pró',
        descricao: 'Diferença proporcional do ciclo já pago',
        valorCentavos: mudanca.valorAdicionalCentavos,
        formasPagamento: formas,
      });
      if (checkout.estado === 'CRIADO' && checkout.checkoutId && checkout.checkoutUrl) {
        mudanca = await prisma.mudancaAssinatura.update({
          where: { id: mudanca.id },
          data: {
            checkoutExternoId: checkout.checkoutId,
            checkoutUrl: checkout.checkoutUrl,
            checkoutExpiraEm: checkout.expiraEm,
          },
        });
      } else {
        if (checkout.criacaoConfirmadamenteRecusada) await prisma.mudancaAssinatura.update({ where: { id: mudanca.id }, data: { checkoutExternoId: null } });
        throw new ErroDeNegocio(checkout.criacaoConfirmadamenteRecusada
          ? 'Não foi possível criar o checkout da mudança. Confira os dados e tente novamente.'
          : 'Não foi possível confirmar o checkout da mudança. Aguarde a reconciliação antes de tentar novamente.', 502);
      }
      return { nova, mudanca, checkout };
  }

  static async processarMudancasAgendadas(agora = new Date(), provedor: ProvedorAssinatura = provedorAssinatura) {
    const candidatas = await prisma.mudancaAssinatura.findMany({
      where: { status: StatusMudancaAssinatura.AGENDADA },
      select: { id: true, assinaturaId: true },
    });
    const resultados: Array<{ id: string; status: string; motivo?: string }> = [];
    for (const candidata of candidatas) {
      resultados.push(await this.sincronizarMudancaAgendada(candidata.id, candidata.assinaturaId, agora, provedor));
    }
    return resultados;
  }

  private static async sincronizarMudancaAgendada(id: string, assinaturaId: string, agora: Date, provedor: ProvedorAssinatura) {
    return transacaoAssinatura(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assinaturas_saas WHERE id = ${assinaturaId} FOR UPDATE`;
      const mudanca = await tx.mudancaAssinatura.findUnique({ where: { id } });
      const assinatura = await tx.assinaturaSaas.findUnique({ where: { id: assinaturaId } });
      if (!mudanca || mudanca.assinaturaId !== assinaturaId || mudanca.status !== StatusMudancaAssinatura.AGENDADA) return { id, status: 'IGNORADA', motivo: 'MUDANCA_JA_PROCESSADA' };
      if (!assinatura || !provedor.configurado || !assinatura.assinaturaExternaId) return { id, status: 'PENDENTE', motivo: 'RECORRENCIA_NAO_CONFIRMADA' };
      const inicio = mudanca.efetivarEm;
      if (!inicio) return { id, status: 'PENDENTE', motivo: 'DATA_NAO_CONFIRMADA' };
      // Um pagamento conciliado antes deste job nunca pode ter suas datas retrocedidas.
      if (assinatura.cicloInicio && assinatura.cicloInicio >= inicio) return { id, status: 'PENDENTE', motivo: 'PAGAMENTO_JA_AVANCOU_CICLO_RECONCILIAR' };
      const chegouRenovacao = inicio <= agora;
      if (mudanca.tipo === TipoMudancaAssinatura.DOWNGRADE) {
        const [barbeirosAtivos, clientesAtivos] = await Promise.all([
          tx.barbeiro.count({ where: { barbeariaId: assinatura.barbeariaId, ativo: true } }),
          tx.clienteBarbearia.count({ where: { barbeariaId: assinatura.barbeariaId, ativo: true } }),
        ]);
        const avaliacao = avaliarDowngradeParaBasico({ barbeirosAtivos, clientesAtivos, chegouRenovacao });
        if (!avaliacao.enquadrada) {
          if (!chegouRenovacao) return { id, status: 'AGENDADA', motivo: 'AGUARDANDO_ENQUADRAMENTO' };
          const cancelada = await provedor.cancelarRenovacao({ solicitacaoId: `downgrade:${id}`, barbeariaId: assinatura.barbeariaId, assinaturaExternaId: assinatura.assinaturaExternaId, chaveIdempotencia: `downgrade-${id}` });
          if (cancelada.estado !== 'CONFIRMADO') return { id, status: 'PENDENTE', motivo: 'CANCELAMENTO_EXTERNO_NAO_CONFIRMADO' };
          await tx.assinaturaSaas.update({ where: { id: assinaturaId }, data: { status: StatusAssinatura.CONSULTA_EXPORTACAO, renovacaoAutomatica: false, fimAcessoEm: inicio, consultaExportacaoAte: calcularFimConsultaExportacao(inicio) } });
          await tx.mudancaAssinatura.update({ where: { id }, data: { status: StatusMudancaAssinatura.CANCELADA } });
          return { id, status: 'RENOVACAO_ENCERRADA', motivo: 'LIMITES_BASICOS_EXCEDIDOS' };
        }
      }
      const sincronizada = await provedor.atualizarRecorrencia({ assinaturaExternaId: assinatura.assinaturaExternaId, valorCentavos: obterPrecoCiclo(mudanca.planoDestino, mudanca.periodicidadeDestino), periodicidade: mudanca.periodicidadeDestino, proximoVencimento: inicio });
      if (sincronizada.estado !== 'CONFIRMADO') return { id, status: 'PENDENTE', motivo: 'ALTERACAO_EXTERNA_NAO_CONFIRMADA' };
      if (!chegouRenovacao) return { id, status: 'AGENDADA' };
      const proximaCobrancaEm = assinatura.proximaCobrancaEm && assinatura.proximaCobrancaEm > inicio ? assinatura.proximaCobrancaEm : inicio;
      await tx.assinaturaSaas.update({ where: { id: assinaturaId }, data: { plano: mudanca.planoDestino, periodicidade: mudanca.periodicidadeDestino, precoCicloCentavos: obterPrecoCiclo(mudanca.planoDestino, mudanca.periodicidadeDestino), proximaCobrancaEm } });
      await tx.mudancaAssinatura.update({ where: { id }, data: { status: StatusMudancaAssinatura.EFETIVADA } });
      return { id, status: 'EFETIVADA' };
    });
  }

  static async processarToleranciasVencidas(
    provedor: ProvedorAssinatura = provedorAssinatura,
    agora = new Date(),
  ) {
    const assinaturas = await prisma.assinaturaSaas.findMany({
      where: {
        status: StatusAssinatura.PAGAMENTO_PENDENTE,
        toleranciaAte: { lte: agora },
      },
    });
    const resultados: Array<{ id: string; processada: boolean; motivo?: string }> = [];
    for (const assinatura of assinaturas) {
      if (!provedor.configurado || !assinatura.assinaturaExternaId) {
        resultados.push({ id: assinatura.id, processada: false, motivo: 'PROVEDOR_NAO_CONFIRMADO' });
        continue;
      }
      if (!assinatura.ultimaCobrancaExternaId) {
        resultados.push({ id: assinatura.id, processada: false, motivo: 'COBRANCA_NAO_IDENTIFICADA' }); continue;
      }
      const cobranca = await provedor.cancelarCobrancaPendente({ cobrancaExternaId: assinatura.ultimaCobrancaExternaId, assinaturaExternaId: assinatura.assinaturaExternaId });
      if (cobranca.estado !== 'CONFIRMADO') {
        resultados.push({ id: assinatura.id, processada: false, motivo: cobranca.estado === 'PAGA' ? 'PAGAMENTO_IDENTIFICADO_RECONCILIAR' : 'COBRANCA_NAO_CANCELADA' }); continue;
      }
      const cancelamento = await provedor.cancelarRenovacao({
        solicitacaoId: `inadimplencia:${assinatura.id}`,
        barbeariaId: assinatura.barbeariaId,
        assinaturaExternaId: assinatura.assinaturaExternaId,
        chaveIdempotencia: `inadimplencia-${assinatura.id}`,
      });
      if (cancelamento.estado !== 'CONFIRMADO') {
        resultados.push({ id: assinatura.id, processada: false, motivo: cancelamento.estado });
        continue;
      }
      const fimAcesso = assinatura.toleranciaAte || agora;
      await prisma.assinaturaSaas.update({
        where: { id: assinatura.id },
        data: {
          status: StatusAssinatura.CONSULTA_EXPORTACAO,
          renovacaoAutomatica: false,
          fimAcessoEm: fimAcesso,
          consultaExportacaoAte: calcularFimConsultaExportacao(fimAcesso),
        },
      });
      resultados.push({ id: assinatura.id, processada: true });
    }
    return resultados;
  }
}
