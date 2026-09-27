import { PrismaClient } from '@prisma/client';
import { ContextoIa } from './cotas';
import { decifrarResultado } from './resultado';
import { ErroDeNegocio } from '../../lib/erros';

export type TurnoIa = { usuario: string; assistente: string; criadoEm: string };
const PREFIXO = 'valeria-contexto-v1:';
export const CONTEXTO_MAX_BYTES = 6000;
export const CONTEXTO_TTL_MS = 30 * 60 * 1000;

export function validarConversaId(id: unknown): asserts id is string | undefined {
  if (id !== undefined && (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
    throw new ErroDeNegocio('Identificador da conversa inválido.');
  }
}

export function limitarContexto(turnos: TurnoIa[], agora: Date): TurnoIa[] {
  const recentes = turnos.filter(t => t && typeof t.usuario === 'string' && typeof t.assistente === 'string' &&
    typeof t.criadoEm === 'string' && Date.parse(t.criadoEm) <= agora.getTime() && Date.parse(t.criadoEm) > agora.getTime() - CONTEXTO_TTL_MS).slice(-3);
  while (recentes.length && Buffer.byteLength(JSON.stringify(recentes), 'utf8') > CONTEXTO_MAX_BYTES) recentes.shift();
  return recentes;
}

export function empacotarContexto(texto: string, conversaId: string | undefined, turnos: TurnoIa[], agora: Date) {
  return conversaId ? PREFIXO + JSON.stringify({ versao: 1, conversaId, texto, turnos: limitarContexto(turnos, agora) }) : texto;
}

export function lerContexto(texto: string): { texto: string; conversaId?: string; turnos: TurnoIa[] } {
  if (!texto.startsWith(PREFIXO)) return { texto, turnos: [] }; // respostas antigas
  try {
    const d = JSON.parse(texto.slice(PREFIXO.length));
    validarConversaId(d.conversaId);
    if (d.versao !== 1 || !d.conversaId || typeof d.texto !== 'string' || !Array.isArray(d.turnos) || d.turnos.length > 3) throw new Error();
    return { texto: d.texto, conversaId: d.conversaId, turnos: d.turnos };
  } catch { throw new ErroDeNegocio('Não foi possível recuperar esta conversa.', 503); }
}

/** Chamada após reservar/marcarEnvio, que revalidam vínculo e papel atuais.
 * Nada do navegador é aceito como histórico, mensagem de sistema ou tool output.
 */
export async function carregarContexto(db: PrismaClient, c: ContextoIa, conversaId: string | undefined, chave: Buffer, agora: Date) {
  if (!conversaId) return [];
  const reservas = await db.iaReserva.findMany({ where: { barbeariaId: c.barbeariaId, usuarioId: c.usuarioId, papel: c.papel,
    estado: 'CONCLUIDA', canal: 'TEXTO', respostaCifrada: { not: null }, resultadoExpiraEm: { gt: agora },
    criadaEm: { gt: new Date(agora.getTime() - CONTEXTO_TTL_MS), lte: agora } },
    select: { id: true, respostaCifrada: true }, orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }], take: 20 });
  for (const r of reservas) {
    if (!r.respostaCifrada || r.respostaCifrada.length > 64000) continue;
    try {
      const salvo = lerContexto(decifrarResultado(r.respostaCifrada, chave, r.id));
      if (salvo.conversaId === conversaId) return limitarContexto(salvo.turnos, agora);
    } catch {
      // Uma resposta antiga cifrada com outra chave não invalida a conversa
      // atual. Não reaproveitar nem apresentar texto que não foi autenticado.
      continue;
    }
  }
  return [];
}
