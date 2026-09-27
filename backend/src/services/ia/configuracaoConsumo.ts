import { configuracaoIa } from './politica';
import { ErroDeNegocio } from '../../lib/erros';

export const TOKENS_ENTRADA_RESERVA = 40_000;
export const TOKENS_SAIDA_POR_CHAMADA = 512;
export const TOKENS_SAIDA_MAXIMOS = 2 * TOKENS_SAIDA_POR_CHAMADA;
export interface ConfiguracaoConsumoIa {
  mensagens: { BASICO: number; PRO: number };
  creditos: { BASICO: number; PRO: number };
  custoCreditoMicrousd: number;
  tarifaEntradaMicrousd: number;
  tarifaSaidaMicrousd: number;
  tarifaVersao: string;
  modelo: string;
  politicaVersao: string;
}

export function obterConfiguracaoConsumo(env: NodeJS.ProcessEnv = process.env): ConfiguracaoConsumoIa {
  const config = configuracaoIa(env);
  const inteiro = (v?: string) => v && /^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 2_147_483_647 ? Number(v) : null;
  const entrada = inteiro(env.IA_TARIFA_ENTRADA_MICROUSD_MILHAO);
  const saida = inteiro(env.IA_TARIFA_SAIDA_MICROUSD_MILHAO);
  const tarifaVersao = env.IA_TARIFA_VERSAO?.trim();
  const politicaVersao = env.IA_POLITICA_VERSAO?.trim();
  if (env.IA_PERSISTENCIA_ENABLED !== 'true' || !config.modeloTexto || !entrada || !saida ||
      !config.custoCreditoMicrousd || !config.creditos.BASICO || !config.creditos.PRO ||
      !config.mensagens.BASICO || !config.mensagens.PRO || !tarifaVersao || !politicaVersao ||
      env.IA_CONTAGEM_TEXTO !== 'RESPOSTA_CONCLUIDA') {
    throw new ErroDeNegocio('A assistente aguarda configuração dos limites e da política de consumo.', 503);
  }
  const result: ConfiguracaoConsumoIa = {
    mensagens: { BASICO: config.mensagens.BASICO, PRO: config.mensagens.PRO },
    creditos: { BASICO: config.creditos.BASICO, PRO: config.creditos.PRO },
    custoCreditoMicrousd: config.custoCreditoMicrousd, tarifaEntradaMicrousd: entrada,
    tarifaSaidaMicrousd: saida, modelo: config.modeloTexto, tarifaVersao, politicaVersao,
  };
  if (Object.values(result.creditos).some(n => n > 2_147_483_647) ||
      Object.values(result.mensagens).some(n => n > 2_147_483_647) || result.custoCreditoMicrousd > 2_147_483_647) {
    throw new ErroDeNegocio('Configuração dos limites de IA inválida.', 503);
  }
  return result;
}

// Tarifa conservadora de entrada sem desconto de cache, explicitada na oferta.
// Não é conciliação da fatura OpenAI; tarifa é versionada e definida no servidor.
export function calcularCustoIa(entrada: number, saida: number, config: Pick<ConfiguracaoConsumoIa,
  'tarifaEntradaMicrousd' | 'tarifaSaidaMicrousd' | 'custoCreditoMicrousd'>) {
  if (![entrada, saida].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2_147_483_647)) throw new Error('Uso inválido.');
  const micro = (BigInt(entrada) * BigInt(config.tarifaEntradaMicrousd) + BigInt(saida) * BigInt(config.tarifaSaidaMicrousd) + 999_999n) / 1_000_000n;
  const creditos = (micro + BigInt(config.custoCreditoMicrousd) - 1n) / BigInt(config.custoCreditoMicrousd);
  if (creditos > 2_147_483_647n) throw new Error('Custo fora do limite.');
  return { custoMicrousd: micro, creditos: Number(creditos) };
}
