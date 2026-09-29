import { obterConfiguracaoConsumo } from './configuracaoConsumo';
import { configuracaoResultado } from './resultado';
import { VOZ_LOCAL } from './limitesVoz';

export function configuracaoVoz(env: NodeJS.ProcessEnv = process.env) {
  if (env.IA_VOZ_ENABLED !== 'true') return null;
  obterConfiguracaoConsumo(env); configuracaoResultado(env);
  if (env.IA_ENABLED !== 'true' || !env.OPENAI_API_KEY?.trim() || env.OPENAI_VOICE_MODEL !== VOZ_LOCAL.modelo
    || env.IA_VOZ_CREDITOS !== 'TODOS_CUSTOS' || !env.IA_VOZ_TICKET_SECRET || env.IA_VOZ_TICKET_SECRET.length < 32)
    throw new Error('Configuração de voz incompleta. Confira flags, modelo, política e chave de tickets.');
  const url = new URL(env.IA_VOZ_PUBLIC_URL || '');
  const origins = (env.IA_VOZ_ORIGENS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (url.protocol !== 'wss:' || url.pathname !== '/ia/voz/conexao' || url.search || url.hash || url.username || url.password || !origins.length
    || origins.some(s => { const o = new URL(s); return o.protocol !== 'https:' || o.origin !== s; }))
    throw new Error('Configure endereço WSS público e origens HTTPS explícitas para voz.');
  return { url: url.href, origins, ticketSecret: env.IA_VOZ_TICKET_SECRET };
}
