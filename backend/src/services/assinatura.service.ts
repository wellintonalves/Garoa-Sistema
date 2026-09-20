import {
  CanalCancelamentoAssinatura,
  Prisma,
  StatusAssinatura,
  StatusCancelamentoAssinatura,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ErroDeNegocio } from '../lib/erros';
import {
  ProvedorAssinatura,
  provedorAssinatura,
} from '../integrations/assinaturas/provedorAssinatura';
import type { UsuarioJWT } from '../types';
import { calcularFimConsultaExportacao } from '../domain/assinatura/regrasAssinatura';

interface DadosSolicitacao {
  confirmacaoNome: string;
  motivo?: string;
  chaveIdempotencia: string;
}

const statusAbertos: StatusCancelamentoAssinatura[] = [
  StatusCancelamentoAssinatura.PROCESSAMENTO_PENDENTE,
];

function normalizarConfirmacao(valor: string): string {
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function validarChaveIdempotencia(chave: string): string {
  const limpa = typeof chave === 'string' ? chave.trim() : '';
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(limpa)) {
    throw new ErroDeNegocio('Identificador da solicitação inválido. Atualize a página e tente novamente.');
  }
  return limpa;
}

function statusIntegracao(provedor: ProvedorAssinatura) {
  if (!provedor.configurado) {
    return {
      provedor: provedor.nome,
      estado: 'NAO_CONFIGURADO' as const,
      mensagem:
        'A solicitação está registrada. O cancelamento da renovação ainda exige processamento manual.',
    };
  }
  return {
    provedor: provedor.nome,
    estado: 'PENDENTE' as const,
    mensagem: 'A solicitação aguarda confirmação do provedor de cobrança.',
  };
}

function statusIntegracaoSolicitacao(solicitacao: any, provedor: ProvedorAssinatura) {
  if (solicitacao?.status === StatusCancelamentoAssinatura.RENOVACAO_CANCELADA) {
    return {
      provedor: solicitacao.provedor,
      estado: 'CONFIRMADO' as const,
      mensagem: 'A renovação foi cancelada e a data final de acesso foi preservada.',
    };
  }
  return statusIntegracao(provedor);
}

function serializarSolicitacao(solicitacao: any) {
  const confirmada =
    solicitacao.status === StatusCancelamentoAssinatura.RENOVACAO_CANCELADA;

  return {
    id: solicitacao.id,
    status: solicitacao.status,
    canal: solicitacao.canal,
    recebidoEm: solicitacao.recebidoEm,
    solicitadoPorEmail: solicitacao.solicitadoPorEmail,
    provedor: solicitacao.provedor,
    assinaturaExternaVinculada: Boolean(solicitacao.assinaturaExternaId),
    tentativasProvedor: solicitacao.tentativasProvedor,
    cancelamentoConfirmadoEm: confirmada
      ? solicitacao.cancelamentoConfirmadoEm
      : null,
    fimAcessoEm: confirmada ? solicitacao.fimAcessoEm : null,
  };
}

export class AssinaturaService {
  static async registrarCancelamentoRecebidoPorEmail(
    entrada: {
      emailAdministrador: string;
      motivo?: string;
      chaveIdempotencia: string;
    },
    provedor: ProvedorAssinatura = provedorAssinatura,
  ) {
    const email = entrada.emailAdministrador.trim().toLowerCase();
    const administradores = await prisma.usuario.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' },
        papel: 'ADMIN',
        barbeariaId: { not: null },
      },
      include: { barbearia: { select: { id: true, nome: true } } },
      take: 2,
    });
    if (administradores.length !== 1 || !administradores[0].barbearia) {
      throw new ErroDeNegocio(
        administradores.length > 1
          ? 'O e-mail administrativo está ambíguo e precisa ser regularizado antes do cancelamento.'
          : 'Administrador não encontrado para o e-mail informado.',
        409,
      );
    }
    const administrador = administradores[0];
    const barbearia = administrador.barbearia!;
    const resultado = await this.solicitarCancelamento(
      {
        id: administrador.id,
        nome: administrador.nome,
        email: administrador.email,
        papel: administrador.papel,
        barbeariaId: administrador.barbeariaId,
      },
      {
        confirmacaoNome: barbearia.nome,
        motivo: entrada.motivo,
        chaveIdempotencia: entrada.chaveIdempotencia,
      },
      provedor,
    );
    if (resultado.nova) {
      await prisma.solicitacaoCancelamentoAssinatura.update({
        where: { id: resultado.solicitacao.id },
        data: { canal: CanalCancelamentoAssinatura.EMAIL },
      });
      resultado.solicitacao.canal = CanalCancelamentoAssinatura.EMAIL;
    }
    return resultado;
  }

  static async exportarDados(usuario: UsuarioJWT) {
    const barbeariaId = usuario.barbeariaId;
    if (!barbeariaId || usuario.papel !== 'ADMIN') {
      throw new ErroDeNegocio('Somente o administrador pode exportar os dados da barbearia.', 403);
    }
    const administrador = await prisma.usuario.findFirst({
      where: { id: usuario.id, papel: 'ADMIN', barbeariaId },
      select: { id: true },
    });
    if (!administrador) throw new ErroDeNegocio('Administrador autorizado não encontrado.', 403);

    const p = prisma as any;
    const [
      barbearia, usuarios, barbeiros, clientes, servicos, agendamentos,
      lancamentosFinanceiros, itensAtendimento, estoque, vendasEstoque,
      vendasProdutos, pontosFidelidade, configuracoes, configuracoesFidelidade, recompensas,
      resgatesRecompensa, chatMensagens, indicacoes, avaliacoes, bloqueiosAgenda,
      historicoRemarcacoes, aprovacoesEdicao,
    ] = await Promise.all([
      p.barbearia.findUnique({ where: { id: barbeariaId }, select: {
        id: true, nome: true, slug: true, telefone: true, endereco: true, logo: true,
        corPrimaria: true, corSecundaria: true, corTexto: true, fonte: true,
        fonteCorpo: true, fonteNumeros: true, horarioAbertura: true,
        horarioFechamento: true, temAlmoco: true, horarioAlmocoInicio: true,
        horarioAlmocoFim: true, diasFuncionamento: true, ativo: true, createdAt: true,
      } }),
      p.usuario.findMany({ where: { barbeariaId }, select: {
        id: true, nome: true, email: true, papel: true, emailVerificado: true, createdAt: true,
      } }),
      p.barbeiro.findMany({ where: { barbeariaId }, include: { usuario: { select: { id: true, nome: true, email: true } } } }),
      p.cliente.findMany({
        where: { OR: [{ barbeariaId }, { clientesBarbearias: { some: { barbeariaId } } }] },
        select: {
          id: true, telefone: true, dataNascimento: true, observacoes: true,
          codigoIndicacao: true, usuario: { select: { id: true, nome: true, email: true, createdAt: true } },
          clientesBarbearias: { where: { barbeariaId } },
        },
      }),
      p.servico.findMany({ where: { barbeariaId } }),
      p.agendamento.findMany({ where: { barbeariaId } }),
      p.lancamentoFinanceiro.findMany({ where: { barbeariaId } }),
      p.itemAtendimento.findMany({ where: { barbeariaId } }),
      p.estoque.findMany({ where: { barbeariaId } }),
      p.vendaEstoque.findMany({ where: { barbeariaId } }),
      p.vendaProduto.findMany({ where: { barbeariaId } }),
      p.pontoFidelidade.findMany({ where: { barbeariaId } }),
      p.configuracao.findMany({ where: { barbeariaId } }),
      p.configuracaoFidelidade.findMany({ where: { barbeariaId } }),
      p.recompensa.findMany({ where: { barbeariaId } }),
      p.resgateRecompensa.findMany({ where: { barbeariaId } }),
      p.chatMensagem.findMany({ where: { barbeariaId } }),
      p.indicacao.findMany({ where: { barbeariaId } }),
      p.avaliacao.findMany({ where: { barbeariaId } }),
      p.bloqueioAgenda.findMany({ where: { barbeiro: { barbeariaId } } }),
      p.historicoRemarcacao.findMany({ where: { barbeariaId } }),
      p.aprovacaoEdicao.findMany({ where: { lancamento: { barbeariaId } } }),
    ]);

    return {
      formato: 'VALEN_EXPORTACAO_JSON',
      versao: 1,
      geradoEm: new Date().toISOString(),
      barbeariaId,
      dados: {
        barbearia, usuarios, barbeiros, clientes, servicos, agendamentos,
        lancamentosFinanceiros, itensAtendimento, estoque, vendasEstoque,
        vendasProdutos, pontosFidelidade, configuracoes, configuracoesFidelidade, recompensas,
        resgatesRecompensa, chatMensagens, indicacoes, avaliacoes, bloqueiosAgenda,
        historicoRemarcacoes, aprovacoesEdicao,
      },
    };
  }

  static async obterCancelamentoAtual(
    usuario: UsuarioJWT,
    provedor: ProvedorAssinatura = provedorAssinatura,
  ) {
    if (!usuario.barbeariaId || usuario.papel !== 'ADMIN') {
      throw new ErroDeNegocio('Administrador da barbearia não identificado.', 403);
    }

    const solicitacao = await prisma.solicitacaoCancelamentoAssinatura.findFirst({
      where: { barbeariaId: usuario.barbeariaId },
      orderBy: { recebidoEm: 'desc' },
    });

    return {
      solicitacao: solicitacao ? serializarSolicitacao(solicitacao) : null,
      integracao: statusIntegracaoSolicitacao(solicitacao, provedor),
    };
  }

  static async processarSolicitacaoCancelamento(
    solicitacaoId: string,
    provedor: ProvedorAssinatura = provedorAssinatura,
    agora = new Date(),
  ) {
    let solicitacao = await prisma.solicitacaoCancelamentoAssinatura.findUnique({
      where: { id: solicitacaoId },
      include: { assinatura: true },
    });
    if (!solicitacao) throw new ErroDeNegocio('Solicitação de cancelamento não encontrada.', 404);
    if (solicitacao.status === StatusCancelamentoAssinatura.RENOVACAO_CANCELADA) {
      return {
        solicitacao: serializarSolicitacao(solicitacao),
        integracao: statusIntegracaoSolicitacao(solicitacao, provedor),
      };
    }
    if (!solicitacao.assinaturaId) {
      const vinculada = await prisma.assinaturaSaas.findUnique({ where: { barbeariaId: solicitacao.barbeariaId } });
      if (vinculada) solicitacao = await prisma.solicitacaoCancelamentoAssinatura.update({
        where: { id: solicitacao.id }, data: { assinaturaId: vinculada.id }, include: { assinatura: true },
      });
    }
    if (!provedor.configurado || !solicitacao.assinatura?.assinaturaExternaId) {
      return {
        solicitacao: serializarSolicitacao(solicitacao),
        integracao: statusIntegracao(provedor),
      };
    }

    // Lease persistido: workers/reenvios concorrentes não repetem a chamada externa.
    if (solicitacao.ultimaTentativaEm && agora.getTime() - solicitacao.ultimaTentativaEm.getTime() < 5 * 60_000) {
      return { solicitacao: serializarSolicitacao(solicitacao), integracao: statusIntegracao(provedor) };
    }
    const reserva = await prisma.solicitacaoCancelamentoAssinatura.updateMany({
      where: { id: solicitacao.id, status: StatusCancelamentoAssinatura.PROCESSAMENTO_PENDENTE, ultimaTentativaEm: solicitacao.ultimaTentativaEm },
      data: { tentativasProvedor: { increment: 1 }, ultimaTentativaEm: agora, assinaturaExternaId: solicitacao.assinatura.assinaturaExternaId },
    });
    if (!reserva.count) return { solicitacao: serializarSolicitacao(solicitacao), integracao: statusIntegracao(provedor) };
    const consulta = await provedor.consultarAssinatura(solicitacao.assinatura.assinaturaExternaId);
    const resultado = consulta.estado === 'INATIVA' || consulta.estado === 'NAO_ENCONTRADA'
      ? { estado: 'CONFIRMADO' as const, mensagem: 'Ausência de recorrência ativa confirmada no provedor.', confirmadoEm: agora, fimAcessoEm: undefined }
      : consulta.estado !== 'ATIVA'
        ? { estado: 'PENDENTE' as const, mensagem: 'Não foi possível consultar a recorrência. Uma nova tentativa será realizada.', confirmadoEm: undefined, fimAcessoEm: undefined }
        : await provedor.cancelarRenovacao({
      solicitacaoId: solicitacao.id,
      barbeariaId: solicitacao.barbeariaId,
      assinaturaExternaId: solicitacao.assinatura.assinaturaExternaId,
      chaveIdempotencia: solicitacao.chaveIdempotencia,
    });
    if (resultado.estado !== 'CONFIRMADO') {
      const atualizada = await prisma.solicitacaoCancelamentoAssinatura.update({
        where: { id: solicitacao.id },
        data: { ultimoErroProvedor: resultado.mensagem.slice(0, 500) },
      });
      return { solicitacao: serializarSolicitacao(atualizada), integracao: resultado };
    }

    const fimAcesso =
      solicitacao.assinatura.cicloFim ||
      solicitacao.assinatura.testeFim ||
      resultado.fimAcessoEm ||
      agora;
    const acessoJaTerminou = fimAcesso.getTime() <= agora.getTime();
    const [, atualizada] = await prisma.$transaction([
      prisma.assinaturaSaas.update({
        where: { id: solicitacao.assinatura.id },
        data: {
          renovacaoAutomatica: false,
          fimAcessoEm: fimAcesso,
          status: acessoJaTerminou
            ? StatusAssinatura.CONSULTA_EXPORTACAO
            : solicitacao.assinatura.status,
          consultaExportacaoAte: acessoJaTerminou
            ? calcularFimConsultaExportacao(fimAcesso)
            : solicitacao.assinatura.consultaExportacaoAte,
        },
      }),
      prisma.solicitacaoCancelamentoAssinatura.update({
        where: { id: solicitacao.id },
        data: {
          status: StatusCancelamentoAssinatura.RENOVACAO_CANCELADA,
          aberta: null,
          cancelamentoConfirmadoEm: resultado.confirmadoEm || agora,
          fimAcessoEm: fimAcesso,
          ultimoErroProvedor: null,
        },
      }),
    ]);
    return {
      solicitacao: serializarSolicitacao(atualizada),
      integracao: {
        ...resultado,
        fimAcessoEm: fimAcesso,
      },
    };
  }

  static async reprocessarCancelamentosPendentes(provedor: ProvedorAssinatura = provedorAssinatura, agora = new Date()) {
    if (!provedor.configurado) return [];
    const pendentes = await prisma.solicitacaoCancelamentoAssinatura.findMany({
      where: { status: StatusCancelamentoAssinatura.PROCESSAMENTO_PENDENTE, aberta: true,
        OR: [{ ultimaTentativaEm: null }, { ultimaTentativaEm: { lte: new Date(agora.getTime() - 5 * 60_000) } }] },
      orderBy: { recebidoEm: 'asc' }, take: 100,
    });
    const resultados: Array<{ id: string; estado: string }> = [];
    for (const pendente of pendentes) {
      try {
        const resultado = await this.processarSolicitacaoCancelamento(pendente.id, provedor, agora);
        resultados.push({ id: pendente.id, estado: resultado.integracao.estado });
      } catch {
        resultados.push({ id: pendente.id, estado: 'PENDENTE' });
      }
    }
    return resultados;
  }

  static async solicitarCancelamento(
    usuario: UsuarioJWT,
    dados: DadosSolicitacao,
    provedor: ProvedorAssinatura = provedorAssinatura,
  ) {
    const barbeariaId = usuario.barbeariaId;
    if (!barbeariaId || usuario.papel !== 'ADMIN') {
      throw new ErroDeNegocio('Somente o administrador da barbearia pode solicitar o cancelamento.', 403);
    }

    const chaveIdempotencia = validarChaveIdempotencia(dados.chaveIdempotencia);
    const motivo = dados.motivo?.trim();
    if (motivo && motivo.length > 500) {
      throw new ErroDeNegocio('O motivo deve ter no máximo 500 caracteres.');
    }

    const [administrador, barbearia] = await Promise.all([
      prisma.usuario.findFirst({
        where: { id: usuario.id, papel: 'ADMIN', barbeariaId },
        select: { id: true, email: true },
      }),
      prisma.barbearia.findUnique({
        where: { id: barbeariaId },
        select: { id: true, nome: true },
      }),
    ]);

    if (!administrador || !barbearia) {
      throw new ErroDeNegocio('Administrador autorizado não encontrado para esta barbearia.', 403);
    }
    if (
      normalizarConfirmacao(dados.confirmacaoNome || '') !==
      normalizarConfirmacao(barbearia.nome)
    ) {
      throw new ErroDeNegocio('Digite o nome da barbearia exatamente como exibido para confirmar.');
    }

    const mesmaChave = await prisma.solicitacaoCancelamentoAssinatura.findUnique({
      where: { chaveIdempotencia },
    });
    if (mesmaChave) {
      if (mesmaChave.barbeariaId !== barbeariaId) {
        throw new ErroDeNegocio('Identificador já utilizado em outra solicitação.', 409);
      }
      if (provedor.configurado) return { nova: false, ...await this.processarSolicitacaoCancelamento(mesmaChave.id, provedor) };
      return {
        nova: false,
        solicitacao: serializarSolicitacao(mesmaChave),
        integracao: statusIntegracao(provedor),
      };
    }

    const pendente = await prisma.solicitacaoCancelamentoAssinatura.findFirst({
      where: { barbeariaId, status: { in: statusAbertos }, aberta: true },
      orderBy: { recebidoEm: 'desc' },
    });
    if (pendente) {
      if (provedor.configurado) return { nova: false, ...await this.processarSolicitacaoCancelamento(pendente.id, provedor) };
      return {
        nova: false,
        solicitacao: serializarSolicitacao(pendente),
        integracao: statusIntegracao(provedor),
      };
    }

    const assinatura = await prisma.assinaturaSaas.findUnique({
      where: { barbeariaId },
      select: { id: true, assinaturaExternaId: true },
    });

    try {
      const solicitacao = await prisma.solicitacaoCancelamentoAssinatura.create({
        data: {
          barbeariaId,
          solicitadoPorId: administrador.id,
          solicitadoPorEmail: administrador.email.trim().toLowerCase(),
          canal: CanalCancelamentoAssinatura.SISTEMA,
          status: StatusCancelamentoAssinatura.PROCESSAMENTO_PENDENTE,
          chaveIdempotencia,
          motivo: motivo || null,
          assinaturaId: assinatura?.id || null,
          assinaturaExternaId: assinatura?.assinaturaExternaId || null,
        },
      });

      if (provedor.configurado && assinatura?.assinaturaExternaId) {
        const processada = await this.processarSolicitacaoCancelamento(
          solicitacao.id,
          provedor,
        );
        return { nova: true, ...processada };
      }

      return {
        nova: true,
        solicitacao: serializarSolicitacao(solicitacao),
        integracao: statusIntegracao(provedor),
      };
    } catch (error) {
      if (
        (error instanceof Prisma.PrismaClientKnownRequestError ||
          (typeof error === 'object' && error !== null && 'code' in error)) &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const existente = await prisma.solicitacaoCancelamentoAssinatura.findFirst({
          where: { barbeariaId, aberta: true },
          orderBy: { recebidoEm: 'desc' },
        });
        if (existente) {
          return {
            nova: false,
            solicitacao: serializarSolicitacao(existente),
            integracao: statusIntegracao(provedor),
          };
        }
      }
      throw error;
    }
  }
}
