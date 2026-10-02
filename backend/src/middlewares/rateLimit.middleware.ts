import { createHmac } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { prisma } from '../lib/prisma';
import { authConfig } from '../config/auth';

interface Orçamento { tentativas: number; expiraEm: Date }
/** Atomic shared budgets survive restarts, aliases and multiple backend replicas. */
export async function consumirOrcamento(chave: string, janelaMs: number): Promise<Orçamento> {
  const resultados = await prisma.$queryRaw<Orçamento[]>`
    INSERT INTO limites_autenticacao (chave, tentativas, "expiraEm")
    VALUES (${chave}, 1, clock_timestamp() + ${janelaMs} * interval '1 millisecond')
    ON CONFLICT (chave) DO UPDATE SET
      tentativas = CASE WHEN limites_autenticacao."expiraEm" <= clock_timestamp() THEN 1 ELSE LEAST(limites_autenticacao.tentativas + 1, 2147483646) END,
      "expiraEm" = CASE WHEN limites_autenticacao."expiraEm" <= clock_timestamp() THEN clock_timestamp() + ${janelaMs} * interval '1 millisecond' ELSE limites_autenticacao."expiraEm" END
    RETURNING tentativas, "expiraEm"`;
  return resultados[0];
}
export function chaveOrcamento(escopo: string, tipo: string, identidade: string): string {
  return `${escopo}:${tipo}:${createHmac('sha256', authConfig.secret).update('valen-auth-rate-v1\0').update(identidade).digest('hex')}`;
}
let proximaLimpeza = 0;
function criarLimitador(escopo: string, janelaMs: number, limiteIp: number, limiteConta: number) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Bounded cleanup; no personal identifiers are stored. Failure is fail-closed.
      if (Date.now() >= proximaLimpeza) {
        await prisma.$executeRaw`DELETE FROM limites_autenticacao WHERE chave IN (SELECT chave FROM limites_autenticacao WHERE "expiraEm" < clock_timestamp() ORDER BY "expiraEm" LIMIT 50000)`;
        proximaLimpeza = Date.now() + 60_000;
      }
      // One shared admission ceiling bounds key creation even when callers vary all identifiers.
      const limiteGlobal = limiteIp * 5;
      const global = await consumirOrcamento(`${escopo}:global`, janelaMs);
      if (global.tentativas > limiteGlobal) {
        res.setHeader('Retry-After', Math.max(1, Math.ceil((global.expiraEm.getTime() - Date.now()) / 1000)));
        res.status(429).json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' });
        return;
      }
      const porUsuarioId = req.baseUrl === '/verificacao';
      const identidade = porUsuarioId
        ? (typeof req.body?.usuarioId === 'string' ? req.body.usuarioId.slice(0, 100) : '')
        : (typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '');
      const chaves = [chaveOrcamento(escopo, 'ip', ipKeyGenerator(req.ip ?? req.socket.remoteAddress ?? 'unknown'))];
      if (identidade) chaves.push(chaveOrcamento(escopo, 'conta', identidade));
      for (let i = 0; i < chaves.length; i++) {
        const estado = await consumirOrcamento(chaves[i], janelaMs);
        if (estado.tentativas > (i === 0 ? limiteIp : limiteConta)) {
          res.setHeader('Retry-After', Math.max(1, Math.ceil((estado.expiraEm.getTime() - Date.now()) / 1000)));
          res.status(429).json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' });
          return;
        }
      }
      next();
    } catch (error) { next(error); }
  };
}
export const loginLimiter = criarLimitador('login', 15 * 60_000, 600, 8);
export const registerLimiter = criarLimitador('registro', 60 * 60_000, 100, 5);
export const codigoEnvioLimiter = criarLimitador('codigo-envio', 15 * 60_000, 600, 10);
export const codigoTentativaLimiter = criarLimitador('codigo-tentativa', 15 * 60_000, 1200, 20);
