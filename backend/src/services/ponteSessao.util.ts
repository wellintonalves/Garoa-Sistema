/** Temporary release bridge. Default OFF; only an absolute cutoff <=30min after startup is accepted.
 * A restart never extends an absolute cutoff. Enabling this setting requires rollout authorization.
 */
const inicioProcesso = Date.now();
export function limitePonteSessao(): number | null {
  const valor = process.env.LEGACY_SESSION_CUTOFF;
  if (!valor) return null;
  const fim = Date.parse(valor);
  if (!Number.isFinite(fim) || fim <= Date.now() || fim > inicioProcesso + 30 * 60_000) return null;
  return Math.floor(fim / 1000);
}
