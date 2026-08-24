export function obterIdsServicosAgendamento(agendamento: { id: string, servicosIds?: string[] | null, servicoId?: string | null }): string[] {
  if (agendamento.servicosIds && agendamento.servicosIds.length > 0) {
    return agendamento.servicosIds;
  }
  if (agendamento.servicoId) {
    return [agendamento.servicoId];
  }
  console.error(`[obterIdsServicosAgendamento] ERRO: Agendamento ${agendamento.id} sem serviços (servicosIds vazio e servicoId nulo)`);
  return [];
}
