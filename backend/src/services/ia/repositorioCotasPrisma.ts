import { createHash } from 'node:crypto';
import { Prisma, PrismaClient, IaReserva } from '@prisma/client';
import { ErroDeNegocio } from '../../lib/erros';
import { ContextoIa } from './cotas';
import { identificarPeriodoIa } from './periodo';
import { ConfiguracaoConsumoIa, calcularCustoIa, TOKENS_ENTRADA_RESERVA, TOKENS_SAIDA_MAXIMOS } from './configuracaoConsumo';
import { decidirSupervisaoVoz } from './supervisaoVoz';

type Tx = Prisma.TransactionClient;
const negar = () => new ErroDeNegocio('Acesso não permitido à assistente desta barbearia.', 403);
const indisponivel = (mensagem: string) => new ErroDeNegocio(mensagem, 409);

export class RepositorioCotasPrisma {
  constructor(private db: PrismaClient, private config: ConfiguracaoConsumoIa) {}

  private async validarAtor(tx: Tx, c: ContextoIa) {
    if (!c.barbeariaId || !c.usuarioId) throw negar();
    const unidade = await tx.barbearia.findFirst({ where: { id: c.barbeariaId, ativo: true }, select: { id: true } });
    if (!unidade) throw negar();
    const autorizado = c.papel === 'ADMIN'
      ? await tx.usuario.findFirst({ where: { id: c.usuarioId, barbeariaId: c.barbeariaId, papel: 'ADMIN' }, select: { id: true } })
      : c.papel === 'BARBEIRO'
        ? await tx.barbeiro.findFirst({ where: { usuarioId: c.usuarioId, barbeariaId: c.barbeariaId, ativo: true }, select: { id: true } })
        : c.papel === 'CLIENTE' && c.clienteId
          ? await tx.clienteBarbearia.findFirst({ where: { clienteId: c.clienteId, barbeariaId: c.barbeariaId, ativo: true, cliente: { usuarioId: c.usuarioId } }, select: { id: true } }) : null;
    if (!autorizado) throw negar();
  }

  private async transacao<T>(c: ContextoIa, fn: (tx: Tx, agora: Date) => Promise<T>, validarAtor = true): Promise<T> {
    return this.db.$transaction(async tx => {
      // Lock distribuído no PostgreSQL. Colisão de hash só serializa mais tenants.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.barbeariaId}, 0))::text`;
      if (validarAtor) await this.validarAtor(tx, c);
      // Mesma ordem do financeiro: assinatura antes de período/reserva.
      await tx.$queryRaw`SELECT id FROM assinaturas_saas WHERE "barbeariaId" = ${c.barbeariaId} FOR UPDATE`;
      const [clock] = await tx.$queryRaw<{ agora: Date }[]>`SELECT clock_timestamp() AS agora`;
      // Só pedidos comprovadamente não enviados podem expirar liberando saldo.
      const expiradas = await tx.iaReserva.findMany({ where: { barbeariaId: c.barbeariaId, estado: 'RESERVADA', enviarAte: { lte: clock.agora } }, take: 100 });
      for (const r of expiradas) await this.liberar(tx, r);
      await tx.iaReserva.updateMany({ where: { barbeariaId: c.barbeariaId, estado: 'ENVIANDO', enviarAte: { lte: clock.agora } }, data: { estado: 'INCERTA' } });
      await tx.iaReserva.updateMany({ where: { barbeariaId: c.barbeariaId, resultadoExpiraEm: { lte: clock.agora }, respostaCifrada: { not: null } }, data: { respostaCifrada: null } });
      return fn(tx, clock.agora);
    }, { maxWait: 10_000, timeout: 15_000 });
  }

  private async ciclo(tx: Tx, c: ContextoIa, agora: Date) {
    const assinatura = await tx.assinaturaSaas.findUnique({ where: { barbeariaId: c.barbeariaId } });
    const ciclo = identificarPeriodoIa(assinatura, agora);
    if (!assinatura || ciclo.estado !== 'IDENTIFICADO') throw indisponivel('A franquia de IA aguarda um ciclo mensal confirmado e uma política compatível.');
    return { assinatura, ciclo };
  }

  async saldo(c: ContextoIa) {
    return this.transacao(c, async (tx, agora) => {
      const { assinatura, ciclo } = await this.ciclo(tx, c, agora);
      const periodo = await tx.iaPeriodo.findUnique({ where: { barbeariaId_inicio: { barbeariaId: c.barbeariaId, inicio: ciclo.inicio } } });
      const bloqueado = Boolean(periodo && (periodo.bloqueado || periodo.plano !== assinatura.plano || periodo.politicaVersao !== this.config.politicaVersao || periodo.tarifaVersao !== this.config.tarifaVersao));
      return {
        mensagensMensais: periodo?.mensagensLimite ?? this.config.mensagens[assinatura.plano],
        mensagensRestantes: periodo ? periodo.mensagensLimite - periodo.mensagensConsumidas - periodo.mensagensReservadas : this.config.mensagens[assinatura.plano],
        creditosMensais: periodo?.creditosLimite ?? this.config.creditos[assinatura.plano],
        creditosRestantes: periodo ? periodo.creditosLimite - periodo.creditosConsumidos - periodo.creditosReservados : this.config.creditos[assinatura.plano],
        vozSegundosRestantes: periodo ? periodo.vozSegundosLimite - periodo.vozSegundosConsumidos - periodo.vozSegundosReservados : assinatura.plano === 'PRO' ? 1800 : 0,
        renovaEm: ciclo.fim.toISOString(), bloqueado,
      };
    });
  }

  async reservarTexto(c: ContextoIa, chave: string, mensagem: string, conversaId?: string) {
    if (!mensagem.trim() || mensagem.length > 4000) throw new ErroDeNegocio('Escreva uma mensagem de até 4.000 caracteres.');
    const custo = calcularCustoIa(TOKENS_ENTRADA_RESERVA, TOKENS_SAIDA_MAXIMOS, this.config);
    return this.reservar(c, chave, conversaId ? JSON.stringify([conversaId, mensagem]) : mensagem, 'TEXTO', 0, custo.creditos);
  }

  // Sem rota pública de voz: a futura integração deve comprovar limite duro
  // do provedor e calcular o envelope de custo antes de usar este método.
  async reservarVoz(c: ContextoIa, chave: string, segundos: number, creditosMaximos: number) {
    return this.reservar(c, chave, String(segundos), 'VOZ', segundos, creditosMaximos);
  }

  private async reservar(c: ContextoIa, chave: string, conteudo: string, canal: 'TEXTO' | 'VOZ', segundos: number, creditos: number) {
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(chave)) throw new ErroDeNegocio('Identificador do pedido inválido.');
    if (!Number.isInteger(segundos) || segundos < 0 || segundos > 1800 || (canal === 'VOZ' && segundos === 0) ||
        !Number.isSafeInteger(creditos) || creditos <= 0 || creditos > 2_147_483_647) throw new ErroDeNegocio('Reserva inválida.');
    const hash = createHash('sha256').update(JSON.stringify([c.barbeariaId, c.usuarioId, c.papel, canal, conteudo, segundos])).digest('hex');
    return this.transacao(c, async (tx, agora) => {
      const anterior = await tx.iaReserva.findUnique({ where: { barbeariaId_chaveIdempotencia: { barbeariaId: c.barbeariaId, chaveIdempotencia: chave } } });
      if (anterior) {
        if (anterior.usuarioId !== c.usuarioId || anterior.pedidoHash !== hash) throw indisponivel('Identificador já utilizado em outro pedido.');
        return anterior;
      }
      const { assinatura, ciclo } = await this.ciclo(tx, c, agora);
      if (canal === 'VOZ' && assinatura.plano !== 'PRO') throw new ErroDeNegocio('Voz ao vivo exclusiva do plano Pro.', 403);
      const mensagens = canal === 'TEXTO' ? 1 : 0;
      let periodo = await tx.iaPeriodo.findUnique({ where: { barbeariaId_inicio: { barbeariaId: c.barbeariaId, inicio: ciclo.inicio } } });
      if (!periodo) {
        periodo = await tx.iaPeriodo.create({ data: {
          barbeariaId: c.barbeariaId, assinaturaId: assinatura.id, inicio: ciclo.inicio, fim: ciclo.fim,
          plano: assinatura.plano, politicaVersao: this.config.politicaVersao, tarifaVersao: this.config.tarifaVersao,
          mensagensLimite: this.config.mensagens[assinatura.plano], vozSegundosLimite: assinatura.plano === 'PRO' ? 1800 : 0,
          creditosLimite: this.config.creditos[assinatura.plano],
        } });
      }
      if (periodo.bloqueado || periodo.plano !== assinatura.plano || periodo.politicaVersao !== this.config.politicaVersao || periodo.tarifaVersao !== this.config.tarifaVersao || periodo.fim.getTime() !== ciclo.fim.getTime()) {
        throw indisponivel('A franquia aguarda revisão da mudança de plano ou configuração.');
      }
      const restantes = { mensagens: periodo.mensagensLimite - periodo.mensagensConsumidas - periodo.mensagensReservadas,
        voz: periodo.vozSegundosLimite - periodo.vozSegundosConsumidos - periodo.vozSegundosReservados,
        creditos: periodo.creditosLimite - periodo.creditosConsumidos - periodo.creditosReservados };
      if (restantes.mensagens < mensagens || restantes.voz < segundos || restantes.creditos < creditos) {
        throw new ErroDeNegocio('Saldo insuficiente para reservar este pedido. Consulte mensagens, créditos e voz disponíveis.', 429);
      }
      const enviarAte = new Date(Math.min(agora.getTime() + (canal === 'VOZ' ? segundos * 1000 : 60_000), ciclo.acessoAte.getTime()));
      if (canal === 'VOZ' && enviarAte.getTime() - agora.getTime() < segundos * 1000) throw indisponivel('A sessão ultrapassaria o período da franquia.');
      await tx.iaPeriodo.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id: periodo.id } }, data: {
        mensagensReservadas: { increment: mensagens }, vozSegundosReservados: { increment: segundos }, creditosReservados: { increment: creditos },
      } });
      const reserva = await tx.iaReserva.create({ data: {
        barbeariaId: c.barbeariaId, periodoId: periodo.id, usuarioId: c.usuarioId, papel: c.papel,
        canal, chaveIdempotencia: chave, pedidoHash: hash, mensagensMaximas: mensagens,
        vozSegundosMaximos: segundos, creditosMaximos: creditos, enviarAte,
        modelo: this.config.modelo, custoCreditoMicrousd: this.config.custoCreditoMicrousd,
        tarifaEntradaMicrousd: this.config.tarifaEntradaMicrousd, tarifaSaidaMicrousd: this.config.tarifaSaidaMicrousd,
      } });
      if (canal === 'VOZ') await tx.iaSessaoVoz.create({ data: { barbeariaId: c.barbeariaId, reservaId: reserva.id, encerrarAte: enviarAte } });
      return reserva;
    });
  }

  private async obter(tx: Tx, c: ContextoIa, id: string) {
    const reserva = await tx.iaReserva.findFirst({ where: { id, barbeariaId: c.barbeariaId, usuarioId: c.usuarioId } });
    if (!reserva) throw negar();
    return reserva;
  }

  async marcarEnvio(c: ContextoIa, id: string) {
    return this.transacao(c, async (tx, agora) => {
      const r = await this.obter(tx, c, id);
      if (r.estado !== 'RESERVADA') return false;
      if (agora >= r.enviarAte) { await this.liberar(tx, r); return false; }
      const atual = await this.ciclo(tx, c, agora);
      const periodo = await tx.iaPeriodo.findFirstOrThrow({ where: { id: r.periodoId, barbeariaId: c.barbeariaId } });
      if (periodo.bloqueado || periodo.plano !== atual.assinatura.plano || periodo.inicio.getTime() !== atual.ciclo.inicio.getTime() ||
          periodo.fim.getTime() !== atual.ciclo.fim.getTime() || periodo.politicaVersao !== this.config.politicaVersao || periodo.tarifaVersao !== this.config.tarifaVersao) {
        await this.liberar(tx, r);
        return false;
      }
      await tx.iaReserva.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id } }, data: { estado: 'ENVIANDO' } });
      return true;
    });
  }

  private async liberar(tx: Tx, r: IaReserva) {
    await tx.iaPeriodo.update({ where: { barbeariaId_id: { barbeariaId: r.barbeariaId, id: r.periodoId } }, data: {
      mensagensReservadas: { decrement: r.mensagensMaximas }, vozSegundosReservados: { decrement: r.vozSegundosMaximos }, creditosReservados: { decrement: r.creditosMaximos },
    } });
    await tx.iaReserva.update({ where: { barbeariaId_id: { barbeariaId: r.barbeariaId, id: r.id } }, data: { estado: 'FALHA_CONFIRMADA' } });
    if (r.canal === 'VOZ') await tx.iaSessaoVoz.updateMany({ where: { barbeariaId: r.barbeariaId, reservaId: r.id, estado: 'PREPARANDO' }, data: { estado: 'ENCERRADA', motivoEncerramento: 'NAO_ENVIADA', segundosFaturados: 0 } });
  }

  async marcarIncerta(c: ContextoIa, id: string) {
    return this.transacao(c, async (tx) => {
      const r = await this.obter(tx, c, id);
      if (r.estado === 'ENVIANDO') await tx.iaReserva.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id } }, data: { estado: 'INCERTA' } });
    }, false);
  }

  /** Uso interno: somente quando o adaptador comprova que NÃO criou socket. */
  async liberarVozNaoConectada(c: ContextoIa, id: string) {
    return this.transacao(c, async tx => {
      const r = await this.obter(tx, c, id);
      const s = await tx.iaSessaoVoz.findUnique({ where: { barbeariaId_reservaId: { barbeariaId: c.barbeariaId, reservaId: id } } });
      if (r.canal !== 'VOZ' || !['RESERVADA', 'ENVIANDO'].includes(r.estado) || !s || s.estado !== 'PREPARANDO' || s.provedorSessaoId)
        throw indisponivel('Não é possível liberar uma sessão que pode ter conectado.');
      await this.liberar(tx, r);
    }, false);
  }

  /** Somente eventos do adaptador de voz validado podem chamar estes métodos.
   * Não há rota HTTP que aceite ids/timestamps/uso do navegador.
   */
  async registrarInicioVoz(c: ContextoIa, id: string, provedorSessaoId: string) {
    return this.transacao(c, async (tx, agora) => {
      const r = await this.obter(tx, c, id);
      if (r.canal !== 'VOZ' || !['ENVIANDO', 'INCERTA'].includes(r.estado) || !provedorSessaoId || provedorSessaoId.length > 200) throw indisponivel('Sessão de voz inválida.');
      const s = await tx.iaSessaoVoz.findUniqueOrThrow({ where: { barbeariaId_reservaId: { barbeariaId: c.barbeariaId, reservaId: id } } });
      if (s.provedorSessaoId) {
        if (s.provedorSessaoId !== provedorSessaoId) throw indisponivel('Sessão divergente.');
        return;
      }
      await tx.iaSessaoVoz.update({ where: { id: s.id }, data: { estado: 'ATIVA', provedorSessaoId, iniciadaEm: agora, ultimaAtividadeEm: agora } });
    }, false);
  }

  async registrarAtividadeVoz(c: ContextoIa, id: string, ocupada: boolean) {
    return this.transacao(c, async (tx, agora) => {
      await this.obter(tx, c, id);
      await tx.iaSessaoVoz.updateMany({ where: { barbeariaId: c.barbeariaId, reservaId: id, estado: 'ATIVA' },
        data: { ultimaAtividadeEm: agora, ocupadaAte: ocupada ? new Date(agora.getTime() + 30_000) : null } });
    }, false);
  }

  async reivindicarFechamentoVoz(c: ContextoIa, id: string, conexaoPerdida = false) {
    return this.transacao(c, async (tx, agora) => {
      const r = await this.obter(tx, c, id);
      if (r.canal !== 'VOZ') throw indisponivel('Reserva não é de voz.');
      const s = await tx.iaSessaoVoz.findUniqueOrThrow({ where: { barbeariaId_reservaId: { barbeariaId: c.barbeariaId, reservaId: id } } });
      if (s.estado === 'ENCERRADA') return { acao: 'continuar' as const };
      const decisao = decidirSupervisaoVoz({ agoraMs: agora.getTime(), encerrarAteMs: s.encerrarAte.getTime(),
        ultimaAtividadeMs: (s.ultimaAtividadeEm ?? s.criadaEm).getTime(), ocupada: Boolean(s.ocupadaAte && s.ocupadaAte > agora), conexaoPerdida });
      if (decisao.acao !== 'encerrar' && !['ENCERRANDO', 'INCERTA'].includes(s.estado)) return decisao;
      if (s.leaseAte && s.leaseAte > agora) return { acao: 'continuar' as const };
      if (!s.provedorSessaoId) {
        await tx.iaSessaoVoz.update({ where: { id: s.id }, data: { estado: 'INCERTA', motivoEncerramento: 'PROVEDOR_DESCONHECIDO' } });
        return { acao: 'continuar' as const };
      }
      const leaseVersao = s.leaseVersao + 1;
      await tx.iaSessaoVoz.update({ where: { id: s.id }, data: { estado: 'ENCERRANDO', leaseVersao,
        leaseAte: new Date(agora.getTime() + 30_000), fechamentoSolicitadoEm: agora,
        motivoEncerramento: decisao.acao === 'encerrar' ? decisao.motivo : s.motivoEncerramento } });
      return { acao: 'encerrar' as const, provedorSessaoId: s.provedorSessaoId, leaseVersao };
    }, false);
  }

  async falhaFechamentoVoz(c: ContextoIa, id: string, leaseVersao: number) {
    return this.transacao(c, async tx => {
      await this.obter(tx, c, id);
      await tx.iaSessaoVoz.updateMany({ where: { barbeariaId: c.barbeariaId, reservaId: id, leaseVersao, estado: 'ENCERRANDO' }, data: { estado: 'INCERTA' } });
      await tx.iaReserva.updateMany({ where: { barbeariaId: c.barbeariaId, id, estado: 'ENVIANDO' }, data: { estado: 'INCERTA' } });
    }, false);
  }

  async liquidar(c: ContextoIa, id: string, uso: {
    respostaProvedorId: string; tokensEntrada: number; tokensSaida: number;
    mensagens: number; segundosVoz: number; custoVozMicrousd?: bigint;
    respostaCifrada?: string; retencaoHoras?: number;
  }) {
    // Liquidação é chamada apenas pelo orquestrador/conciliador de confiança,
    // nunca por body HTTP. A revogação do ator não apaga custo já contratado.
    // obter() continua exigindo tenant + ator originais da reserva.
    return this.transacao(c, async (tx, agora) => {
      const r = await this.obter(tx, c, id);
      const existente = await tx.iaUso.findUnique({ where: { barbeariaId_reservaId: { barbeariaId: c.barbeariaId, reservaId: id } } });
      if (existente) {
        const custoDuplicado = calcularCustoIa(uso.tokensEntrada, uso.tokensSaida, r).custoMicrousd + (uso.custoVozMicrousd ?? 0n);
        if (existente.respostaProvedorId !== uso.respostaProvedorId || existente.tokensEntrada !== uso.tokensEntrada || existente.tokensSaida !== uso.tokensSaida || existente.mensagens !== uso.mensagens || existente.vozSegundos !== uso.segundosVoz || existente.custoMicrousd !== custoDuplicado) throw indisponivel('Resultado divergente para a mesma reserva.');
        return r;
      }
      if (!['ENVIANDO', 'INCERTA'].includes(r.estado) || !uso.respostaProvedorId || uso.respostaProvedorId.length > 200 ||
          !Number.isInteger(uso.mensagens) || uso.mensagens < 0 || uso.mensagens > r.mensagensMaximas ||
          !Number.isInteger(uso.segundosVoz) || uso.segundosVoz < 0 ||
          (r.canal === 'TEXTO' && uso.segundosVoz !== 0)) throw indisponivel('Resultado de uso inválido.');
      const custo = calcularCustoIa(uso.tokensEntrada, uso.tokensSaida, r);
      const custoVoz = uso.custoVozMicrousd ?? 0n;
      if (custoVoz < 0n || (r.canal === 'TEXTO' && custoVoz !== 0n)) throw indisponivel('Custo de voz inválido.');
      const total = custo.custoMicrousd + custoVoz;
      const creditosBig = (total + BigInt(r.custoCreditoMicrousd) - 1n) / BigInt(r.custoCreditoMicrousd);
      if (creditosBig > 2_147_483_647n) throw indisponivel('Custo precisa de reconciliação.');
      const creditos = Number(creditosBig);
      const excedeu = creditos > r.creditosMaximos || uso.segundosVoz > r.vozSegundosMaximos;
      await tx.iaUso.create({ data: { barbeariaId: c.barbeariaId, reservaId: id,
        chaveEvento: `openai:${uso.respostaProvedorId}`, respostaProvedorId: uso.respostaProvedorId,
        tokensEntrada: uso.tokensEntrada, tokensSaida: uso.tokensSaida, mensagens: uso.mensagens,
        vozSegundos: uso.segundosVoz, creditos, custoMicrousd: total,
      } });
      if (excedeu) {
        await tx.iaPeriodo.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id: r.periodoId } }, data: { bloqueado: true } });
        return tx.iaReserva.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id } }, data: { estado: 'INCERTA' } });
      }
      await tx.iaPeriodo.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id: r.periodoId } }, data: {
        mensagensReservadas: { decrement: r.mensagensMaximas }, mensagensConsumidas: { increment: uso.mensagens },
        vozSegundosReservados: { decrement: r.vozSegundosMaximos }, vozSegundosConsumidos: { increment: uso.segundosVoz },
        creditosReservados: { decrement: r.creditosMaximos }, creditosConsumidos: { increment: creditos },
      } });
      if (r.canal === 'VOZ') await tx.iaSessaoVoz.update({ where: { barbeariaId_reservaId: { barbeariaId: c.barbeariaId, reservaId: id } }, data: { estado: 'ENCERRADA', fechamentoConfirmadoEm: agora, segundosFaturados: uso.segundosVoz } });
      return tx.iaReserva.update({ where: { barbeariaId_id: { barbeariaId: c.barbeariaId, id } }, data: {
        estado: 'CONCLUIDA', respostaCifrada: uso.respostaCifrada,
        resultadoExpiraEm: uso.respostaCifrada && uso.retencaoHoras ? new Date(agora.getTime() + uso.retencaoHoras * 3_600_000) : null,
      } });
    }, false);
  }
}
