import { PrismaClient } from '@prisma/client';
import { ErroDeNegocio } from '../../lib/erros';
import { ContextoIa } from './cotas';
import { obterConfiguracaoConsumo } from './configuracaoConsumo';
import { RepositorioCotasPrisma } from './repositorioCotasPrisma';
import { responderTextoOpenAI, ErroProvedorIa } from './openaiTexto';
import { consultarAdmin } from './consultasAdmin';
import { cifrarResultado, configuracaoResultado, decifrarResultado } from './resultado';
import { carregarContexto, empacotarContexto, lerContexto, validarConversaId } from './contextoConversa';

export async function conversarIa(db: PrismaClient, contexto: ContextoIa, chave: string, mensagem: string,
  env: NodeJS.ProcessEnv = process.env, provedor = responderTextoOpenAI, conversaId?: string) {
  validarConversaId(conversaId);
  if (env.IA_ENABLED !== 'true' || !env.OPENAI_API_KEY?.trim()) throw new ErroDeNegocio('A assistente ainda não foi ativada.', 503);
  const config = obterConfiguracaoConsumo(env);
  const privacidade = configuracaoResultado(env);
  const repo = new RepositorioCotasPrisma(db, config);
  const reserva = await repo.reservarTexto(contexto, chave, mensagem, conversaId);
  if (reserva.estado === 'CONCLUIDA') {
    return reserva.respostaCifrada && reserva.resultadoExpiraEm && reserva.resultadoExpiraEm.getTime() > Date.now()
      ? { estado: 'CONCLUIDA', texto: lerContexto(decifrarResultado(reserva.respostaCifrada, privacidade.chave, reserva.id)).texto }
      : { estado: 'CONCLUIDA', texto: 'Este pedido já foi processado. A resposta não está mais disponível; não houve novo consumo.' };
  }
  if (reserva.estado === 'FALHA_CONFIRMADA') return { estado: 'FALHA_CONFIRMADA', texto: 'O pedido expirou antes do envio. Você pode iniciar outro pedido.' };
  if (!await repo.marcarEnvio(contexto, reserva.id)) return { estado: 'PENDENTE', texto: 'Este pedido está pendente. Tentar novamente consulta o mesmo pedido sem novo consumo.' };
  try {
    const agora = new Date(Date.now());
    const historico = await carregarContexto(db, contexto, conversaId, privacidade.chave, agora);
    // A vida da chamada não depende da conexão do navegador. Resultado é salvo
    // para retry idempotente; abort/timeout do provedor não libera a reserva.
    const resposta = await provedor(mensagem, { chave: env.OPENAI_API_KEY, modelo: reserva.modelo, historico, agora,
      ...(contexto.papel === 'ADMIN' ? { consultarAdmin: (args: unknown, signal: AbortSignal) => consultarAdmin(db, contexto, args, signal, agora) } : {}),
    }, AbortSignal.timeout(30_000));
    const texto = resposta.concluida ? resposta.texto : 'A resposta não foi concluída. A mensagem foi liberada; o custo do processamento foi contabilizado.';
    const liquidada = await repo.liquidar(contexto, reserva.id, {
      respostaProvedorId: resposta.respostaId, tokensEntrada: resposta.tokensEntrada, tokensSaida: resposta.tokensSaida,
      mensagens: resposta.concluida ? 1 : 0, segundosVoz: 0,
      respostaCifrada: cifrarResultado(empacotarContexto(texto, conversaId,
        resposta.concluida ? [...historico, { usuario: mensagem, assistente: texto, criadoEm: agora.toISOString() }] : historico, agora), privacidade.chave, reserva.id), retencaoHoras: privacidade.horas,
    });
    return liquidada.estado === 'CONCLUIDA' ? { estado: 'CONCLUIDA', texto }
      : { estado: 'PENDENTE', texto: 'O consumo deste pedido precisa de reconciliação. A reserva foi preservada.' };
  } catch (erro) {
    await repo.marcarIncerta(contexto, reserva.id);
    return { estado: 'PENDENTE', ...(erro instanceof ErroProvedorIa ? { codigo: erro.categoria } : {}), texto: 'Não foi possível confirmar o resultado. A reserva foi preservada; tentar novamente não repete a geração.' };
  }
}
