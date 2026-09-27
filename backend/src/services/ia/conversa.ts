import { PrismaClient } from '@prisma/client';
import { ErroDeNegocio } from '../../lib/erros';
import { ContextoIa } from './cotas';
import { obterConfiguracaoConsumo } from './configuracaoConsumo';
import { RepositorioCotasPrisma } from './repositorioCotasPrisma';
import { responderTextoOpenAI } from './openaiTexto';
import { cifrarResultado, configuracaoResultado, decifrarResultado } from './resultado';

export async function conversarIa(db: PrismaClient, contexto: ContextoIa, chave: string, mensagem: string,
  env: NodeJS.ProcessEnv = process.env, provedor = responderTextoOpenAI) {
  if (env.IA_ENABLED !== 'true' || !env.OPENAI_API_KEY?.trim()) throw new ErroDeNegocio('A assistente ainda não foi ativada.', 503);
  const config = obterConfiguracaoConsumo(env);
  const privacidade = configuracaoResultado(env);
  const repo = new RepositorioCotasPrisma(db, config);
  const reserva = await repo.reservarTexto(contexto, chave, mensagem);
  if (reserva.estado === 'CONCLUIDA') {
    return reserva.respostaCifrada && reserva.resultadoExpiraEm && reserva.resultadoExpiraEm.getTime() > Date.now()
      ? { estado: 'CONCLUIDA', texto: decifrarResultado(reserva.respostaCifrada, privacidade.chave, reserva.id) }
      : { estado: 'CONCLUIDA', texto: 'Este pedido já foi processado. A resposta não está mais disponível; não houve novo consumo.' };
  }
  if (reserva.estado === 'FALHA_CONFIRMADA') return { estado: 'FALHA_CONFIRMADA', texto: 'O pedido expirou antes do envio. Você pode iniciar outro pedido.' };
  if (!await repo.marcarEnvio(contexto, reserva.id)) return { estado: 'PENDENTE', texto: 'Este pedido está pendente. Tentar novamente consulta o mesmo pedido sem novo consumo.' };
  try {
    // A vida da chamada não depende da conexão do navegador. Resultado é salvo
    // para retry idempotente; abort/timeout do provedor não libera a reserva.
    const resposta = await provedor(mensagem, { chave: env.OPENAI_API_KEY, modelo: reserva.modelo }, AbortSignal.timeout(30_000));
    const texto = resposta.concluida ? resposta.texto : 'A resposta não foi concluída. A mensagem foi liberada; o custo do processamento foi contabilizado.';
    const liquidada = await repo.liquidar(contexto, reserva.id, {
      respostaProvedorId: resposta.respostaId, tokensEntrada: resposta.tokensEntrada, tokensSaida: resposta.tokensSaida,
      mensagens: resposta.concluida ? 1 : 0, segundosVoz: 0,
      respostaCifrada: cifrarResultado(texto, privacidade.chave, reserva.id), retencaoHoras: privacidade.horas,
    });
    return liquidada.estado === 'CONCLUIDA' ? { estado: 'CONCLUIDA', texto }
      : { estado: 'PENDENTE', texto: 'O consumo deste pedido precisa de reconciliação. A reserva foi preservada.' };
  } catch {
    await repo.marcarIncerta(contexto, reserva.id);
    return { estado: 'PENDENTE', texto: 'Não foi possível confirmar o resultado. A reserva foi preservada; tentar novamente não repete a geração.' };
  }
}
