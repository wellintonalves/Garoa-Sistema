import { ErroDeNegocio } from '../lib/erros';

export function calcularComissao(valorBase: number, percentual: number): number {
  if (!Number.isFinite(valorBase) || valorBase < 0 || !Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    throw new ErroDeNegocio('Valor ou percentual de comissão inválido.');
  }
  return Math.round(valorBase * percentual) / 100;
}
