import { ErroDeNegocio } from '../lib/erros';

/** Runtime boundary: TypeScript interfaces alone do not validate JSON or ORM operators. */
export function objetoPermitido(entrada: unknown, campos: readonly string[]): Record<string, unknown> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)
    || Object.keys(entrada).some(chave => !campos.includes(chave))) {
    throw new ErroDeNegocio('Dados inválidos. Revise as informações e tente novamente.');
  }
  return entrada as Record<string, unknown>;
}

export function texto(entrada: unknown, maximo = 200, permiteVazio = false): string {
  if (typeof entrada !== 'string' || entrada.length > maximo || (!permiteVazio && !entrada.trim())) {
    throw new ErroDeNegocio('Dados inválidos. Revise as informações e tente novamente.');
  }
  return entrada;
}

export function numero(entrada: unknown, maximo = Number.MAX_SAFE_INTEGER, inteiro = false): number {
  if (typeof entrada !== 'number' || !Number.isFinite(entrada) || entrada < 0 || entrada > maximo || (inteiro && !Number.isInteger(entrada))) {
    throw new ErroDeNegocio('Valor inválido. Revise as informações e tente novamente.');
  }
  return entrada;
}

export function listaIds(entrada: unknown): string[] {
  if (!Array.isArray(entrada) || entrada.length === 0 || entrada.length > 100) {
    throw new ErroDeNegocio('Selecione os serviços do atendimento.');
  }
  const ids = entrada.map(id => texto(id));
  if (new Set(ids).size !== ids.length) throw new ErroDeNegocio('Selecione cada serviço apenas uma vez.');
  return ids;
}

export function opcao<T extends string>(entrada: unknown, permitidos: readonly T[]): T {
  if (typeof entrada !== 'string' || !permitidos.includes(entrada as T)) {
    throw new ErroDeNegocio('Opção inválida. Revise as informações e tente novamente.');
  }
  return entrada as T;
}

export function booleano(entrada: unknown): boolean {
  if (typeof entrada !== 'boolean') throw new ErroDeNegocio('Opção inválida. Revise as informações e tente novamente.');
  return entrada;
}

export function horariosSemanais(entrada: unknown): Record<string, Record<string, string | boolean>> {
  const dias = objetoPermitido(entrada, ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']);
  const resultado: Record<string, Record<string, string | boolean>> = {};
  for (const [dia, valor] of Object.entries(dias)) {
    const horario = objetoPermitido(valor, ['fechado', 'abertura', 'fechamento', 'temAlmoco', 'almocoInicio', 'almocoFim']);
    resultado[dia] = {};
    for (const [campo, conteudo] of Object.entries(horario)) {
      if (campo === 'fechado' || campo === 'temAlmoco') resultado[dia][campo] = booleano(conteudo);
      else {
        const hora = texto(conteudo, 5, true);
        if (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) throw new ErroDeNegocio('Informe um horário válido.');
        resultado[dia][campo] = hora;
      }
    }
  }
  return resultado;
}
