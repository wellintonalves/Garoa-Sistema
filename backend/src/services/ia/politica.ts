import { RENOVACAO_IA } from './periodo';
export type PlanoIa = 'BASICO' | 'PRO';
export const VOZ_SEGUNDOS_MENSAIS = 30 * 60;

// Sem valores comerciais implícitos. A ausência de qualquer decisão bloqueia uso.
export function configuracaoIa(env: NodeJS.ProcessEnv = process.env) {
  const inteiro = (valor?: string) => valor && /^\d+$/.test(valor) && Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null;
  return {
    habilitada: env.IA_ENABLED === 'true',
    modeloTexto: env.OPENAI_TEXT_MODEL?.trim() || null,
    modeloVoz: env.OPENAI_VOICE_MODEL?.trim() || null,
    chaveConfigurada: Boolean(env.OPENAI_API_KEY?.trim()),
    creditos: { BASICO: inteiro(env.IA_CREDITOS_BASICO), PRO: inteiro(env.IA_CREDITOS_PRO) },
    mensagens: { BASICO: inteiro(env.IA_MENSAGENS_BASICO ?? '100'), PRO: inteiro(env.IA_MENSAGENS_PRO ?? '200') },
    // Inteiros em microunidades de USD evitam arredondamentos monetários binários.
    custoCreditoMicrousd: inteiro(env.IA_CUSTO_CREDITO_MICROUSD),
    renovacao: RENOVACAO_IA,
    acumulaSaldo: false as const,
    vozNosCreditos: ['TODOS_CUSTOS', 'APENAS_BACKEND'].includes(env.IA_VOZ_CREDITOS || '') ? env.IA_VOZ_CREDITOS : null,
  };
}

export function statusIa(plano: PlanoIa | null, env: NodeJS.ProcessEnv = process.env) {
  const config = configuracaoIa(env);
  return {
    estado: 'EM_PREPARACAO' as const,
    mensagem: 'A assistente está em preparação. O consumo será liberado após configurar os créditos e o controle de uso.',
    textoDisponivel: false,
    vozDisponivel: false,
    vozNoPlano: plano === 'PRO',
    creditosMensais: plano ? config.creditos[plano] : null,
    creditosRestantes: null,
    mensagensMensais: plano ? config.mensagens[plano] : null,
    mensagensRestantes: null,
    vozSegundosMensais: plano === 'PRO' ? VOZ_SEGUNDOS_MENSAIS : 0,
    vozSegundosRestantes: null,
    renovaEm: null,
    renovacao: config.renovacao,
    acumulaSaldo: config.acumulaSaldo,
    compartilhado: true,
  };
}

// O supervisor de voz deverá chamar esta política usando seu relógio e eventos
// autenticados do provedor, nunca timestamps informados pelo navegador.
export function estadoInatividade(segundosOciosos: number, ocupada: boolean): 'ativa' | 'avisar' | 'encerrar' {
  if (ocupada) return 'ativa';
  if (segundosOciosos >= 60) return 'encerrar';
  return segundosOciosos >= 45 ? 'avisar' : 'ativa';
}
