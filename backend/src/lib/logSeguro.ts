// Only diagnostic categories belong in logs. Never serialize an Error, request,
// user object, provider response, URL, token, password, or authentication code.
export function categoriaErroSeguro(error: unknown): string {
  if (error && typeof error === 'object') {
    const codigo = (error as { code?: unknown }).code;
    if (typeof codigo === 'string' && /^(P\d{4}|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EPIPE)$/.test(codigo)) return codigo;
    if (error instanceof Error && ['Error', 'TypeError', 'SyntaxError', 'RangeError', 'ErroDeNegocio', 'TokenExpiredError', 'JsonWebTokenError', 'MulterError'].includes(error.name)) return error.name;
  }
  return 'erro';
}
export function registrarErroSeguro(evento: string, error?: unknown, referencia?: string): void {
  console.error(JSON.stringify({ evento, categoria: categoriaErroSeguro(error), ...(referencia ? { referencia } : {}) }));
}
