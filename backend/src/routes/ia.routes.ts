import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { barbeiroAuthMiddleware } from '../middlewares/barbeiroAuth.middleware';
import { clienteAuthMiddleware } from '../middlewares/clienteAuth.middleware';
import { AuthRequest, BarbeiroAuthRequest, ClienteAuthRequest } from '../types';
import { prisma } from '../lib/prisma';
import { validarBarbeariaAtiva } from '../services/acessoBarbearia.service';
import { validarEscritaAssinatura } from '../services/acessoAssinatura.service';
import { tenantStorage } from '../lib/als';
import { statusIa } from '../services/ia/politica';
import { ContextoIa } from '../services/ia/cotas';
import { identificarPeriodoIa } from '../services/ia/periodo';
import { RepositorioCotasPrisma } from '../services/ia/repositorioCotasPrisma';
import { obterConfiguracaoConsumo, calcularCustoIa, TOKENS_ENTRADA_RESERVA, TOKENS_SAIDA_MAXIMOS } from '../services/ia/configuracaoConsumo';
import { configuracaoResultado } from '../services/ia/resultado';
import { conversarIa } from '../services/ia/conversa';
import { ErroDeNegocio } from '../lib/erros';

type Resolver = (req: Request) => Promise<ContextoIa | null>;

export function criarRotasIa(resolver: Resolver) {
  const router = Router({ mergeParams: true });
  router.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contexto = await resolver(req);
      if (!contexto) { res.status(403).json({ erro: 'Acesso não permitido a esta barbearia.' }); return; }
      await validarBarbeariaAtiva(contexto.barbeariaId);
      await validarEscritaAssinatura(contexto.barbeariaId, req.method, req.originalUrl);
      res.locals.contextoIa = contexto;
      res.setHeader('Cache-Control', 'no-store');
      tenantStorage.run({ barbeariaId: contexto.barbeariaId }, next);
    } catch (erro) { next(erro); }
  });
  router.get('/status', async (_req, res, next) => {
    try {
      const contexto = res.locals.contextoIa as ContextoIa;
      const assinatura = await prisma.assinaturaSaas.findUnique({
        where: { barbeariaId: contexto.barbeariaId },
        select: { id: true, barbeariaId: true, plano: true, periodicidade: true, status: true,
          cicloInicio: true, cicloFim: true, fimAcessoEm: true },
      });
      // Apenas comparação de instantes; calendário do ciclo é o persistido
      // pelo domínio financeiro, calculado em America/Sao_Paulo.
      const periodo = identificarPeriodoIa(assinatura, new Date(Date.now()));
      let consumo = {};
      if (process.env.IA_PERSISTENCIA_ENABLED === 'true') {
        try {
          const config = obterConfiguracaoConsumo();
          configuracaoResultado();
          const saldo = await new RepositorioCotasPrisma(prisma, config).saldo(contexto);
          const envelope = calcularCustoIa(TOKENS_ENTRADA_RESERVA, TOKENS_SAIDA_MAXIMOS, config).creditos;
          const ativa = process.env.IA_ENABLED === 'true' && Boolean(process.env.OPENAI_API_KEY?.trim());
          consumo = { ...saldo, estado: ativa ? 'DISPONIVEL' : 'EM_PREPARACAO',
            textoDisponivel: ativa && !saldo.bloqueado && saldo.mensagensRestantes > 0 && saldo.creditosRestantes >= envelope,
            mensagem: saldo.bloqueado ? 'A franquia aguarda reconciliação ou revisão do plano.'
              : !ativa ? 'O controle de saldo está pronto. A integração ainda não foi ativada.'
                : saldo.mensagensRestantes === 0 || saldo.creditosRestantes < envelope ? 'Saldo insuficiente para um novo pedido. Reservas pendentes também ocupam saldo.'
                  : contexto.papel === 'ADMIN' ? 'Valéria pode consultar produção, recebimentos e vendas de produtos. Informe o período e os filtros. Ela não altera registros.'
                    : 'Envie uma mensagem. Nesta fase, a Valéria orienta, mas não consulta sua agenda nem realiza lançamentos.',
          };
        } catch (erro) {
          if (!(erro instanceof ErroDeNegocio)) throw erro;
          consumo = { mensagem: erro.message };
        }
      }
      res.json({ ...statusIa(assinatura?.plano ?? null), ...consumo,
        periodoAssinatura: periodo.estado === 'IDENTIFICADO'
          ? { estado: periodo.estado, inicio: periodo.inicio.toISOString(), fim: periodo.fim.toISOString() }
          : periodo,
      });
    } catch (erro) { next(erro); }
  });
  router.post('/mensagens', async (req, res, next) => {
    try {
      if (typeof req.body?.mensagem !== 'string' || Object.keys(req.body).some(key => key !== 'mensagem')) {
        throw new ErroDeNegocio('Informe somente a mensagem para a assistente.');
      }
      const chave = req.header('Idempotency-Key') || '';
      const resultado = await conversarIa(prisma, res.locals.contextoIa as ContextoIa, chave, req.body.mensagem);
      res.status(resultado.estado === 'PENDENTE' ? 202 : 200).json(resultado);
    } catch (erro) { next(erro); }
  });
  // Sem transporte supervisionado validado: nenhuma sessão paga é aberta.
  router.post('/voz/sessoes', (_req, res) => {
    res.status(503).json({ codigo: 'IA_EM_PREPARACAO', erro: 'A assistente ainda não está disponível para consumo.' });
  });
  return router;
}

const router = Router();
router.use('/admin', authMiddleware, criarRotasIa(async (req: AuthRequest) => {
  const token = req.usuario;
  if (!token?.barbeariaId || token.papel !== 'ADMIN') return null;
  const usuario = await prisma.usuario.findFirst({ where: { id: token.id, barbeariaId: token.barbeariaId, papel: 'ADMIN' }, select: { id: true } });
  return usuario ? { barbeariaId: token.barbeariaId, usuarioId: usuario.id, papel: 'ADMIN' } : null;
}));
router.use('/barbeiro', barbeiroAuthMiddleware, criarRotasIa(async (req: BarbeiroAuthRequest) => {
  const token = req.barbeiro;
  if (!token?.barbeariaId) return null;
  const barbeiro = await prisma.barbeiro.findFirst({ where: { id: token.barbeiroId, usuarioId: token.usuarioId, barbeariaId: token.barbeariaId, ativo: true }, select: { usuarioId: true } });
  return barbeiro ? { barbeariaId: token.barbeariaId, usuarioId: barbeiro.usuarioId, papel: 'BARBEIRO' } : null;
}));
router.use('/cliente/:barbeariaId', clienteAuthMiddleware, criarRotasIa(async (req: ClienteAuthRequest) => {
  const token = req.cliente;
  const barbeariaId = req.params.barbeariaId;
  if (!token?.clienteId || !token.usuarioId || typeof barbeariaId !== 'string') return null;
  // URL seleciona tenant, mas não concede acesso. Conferir vínculo e identidade.
  const vinculo = await prisma.clienteBarbearia.findFirst({
    where: { barbeariaId, clienteId: token.clienteId, ativo: true, cliente: { usuarioId: token.usuarioId } },
    select: { clienteId: true },
  });
  return vinculo ? { barbeariaId, usuarioId: token.usuarioId, clienteId: token.clienteId, papel: 'CLIENTE' } : null;
}));
export default router;
