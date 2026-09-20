const DIA_MS = 24 * 60 * 60 * 1000;

export type MarcadorExclusao = {
  entidade: string;
  registroId: string;
  excluidoPrincipalEm: Date | null;
  retencaoLegal: boolean;
};

export function calcularPrazoRemocaoBackup(excluidoPrincipalEm: Date): Date {
  if (!(excluidoPrincipalEm instanceof Date) || Number.isNaN(excluidoPrincipalEm.getTime())) {
    throw new Error('Data de exclusão principal inválida.');
  }
  return new Date(excluidoPrincipalEm.getTime() + 30 * DIA_MS);
}

export function avaliarRemocaoBackup(
  marcador: MarcadorExclusao,
  agora: Date,
): 'AGUARDAR_EXCLUSAO_PRINCIPAL' | 'BLOQUEADA_RETENCAO_LEGAL' | 'DENTRO_DO_PRAZO' | 'PRAZO_VENCIDO' {
  if (marcador.retencaoLegal) return 'BLOQUEADA_RETENCAO_LEGAL';
  if (!marcador.excluidoPrincipalEm) return 'AGUARDAR_EXCLUSAO_PRINCIPAL';
  return agora >= calcularPrazoRemocaoBackup(marcador.excluidoPrincipalEm)
    ? 'PRAZO_VENCIDO'
    : 'DENTRO_DO_PRAZO';
}

export function filtrarReintroducaoEmRestauracao<T extends { id?: unknown }>(
  entidade: string,
  registros: T[],
  marcadores: MarcadorExclusao[],
): T[] {
  const idsExcluidos = new Set(
    marcadores
      .filter((item) => item.entidade === entidade && item.excluidoPrincipalEm && !item.retencaoLegal)
      .map((item) => item.registroId),
  );
  return registros.filter((registro) => !idsExcluidos.has(String(registro.id)));
}
