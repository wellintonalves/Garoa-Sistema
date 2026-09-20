import { ErroDeNegocio } from '../lib/erros';

const PADRAO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizarDataNascimento(valor: string): Date {
  const texto = String(valor || '').trim();
  const partes = PADRAO_DATA.exec(texto);
  if (!partes) {
    throw new ErroDeNegocio('Informe uma data de nascimento válida', 400);
  }

  const ano = Number(partes[1]);
  const mes = Number(partes[2]);
  const dia = Number(partes[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia, 12));

  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    throw new ErroDeNegocio('Informe uma data de nascimento válida', 400);
  }

  const hoje = new Date();
  const hojeUtc = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());
  const nascimentoUtc = Date.UTC(ano, mes - 1, dia);
  if (nascimentoUtc > hojeUtc) {
    throw new ErroDeNegocio('A data de nascimento não pode estar no futuro', 400);
  }

  return data;
}

export function calcularIdade(
  nascimento: Date | string | null | undefined,
  referencia: Date = new Date(),
): number | null {
  if (!nascimento) return null;

  const data = nascimento instanceof Date ? nascimento : new Date(nascimento);
  if (Number.isNaN(data.getTime())) return null;

  let idade = referencia.getUTCFullYear() - data.getUTCFullYear();
  const aniversarioAindaNaoOcorreu =
    referencia.getUTCMonth() < data.getUTCMonth() ||
    (referencia.getUTCMonth() === data.getUTCMonth() && referencia.getUTCDate() < data.getUTCDate());

  if (aniversarioAindaNaoOcorreu) idade -= 1;
  return idade >= 0 ? idade : null;
}
