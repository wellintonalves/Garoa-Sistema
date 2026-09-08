export interface SaldoPontos {
  saldoPontos: number;
  resgatePontosAtivo: boolean;
  maxPontosUtilizaveis: number;
}

// Apenas traduz a disponibilidade informada pelo servidor; não calcula regras de pontos.
export function statusPontos(clienteId: string | null, carregando: boolean, erro: string | null, saldo: SaldoPontos | null) {
  let motivo: string | null = null;
  if (!clienteId) motivo = 'Selecione um cliente para usar pontos.';
  else if (carregando) motivo = 'Consultando os pontos do cliente…';
  else if (erro) motivo = erro;
  else if (!saldo) motivo = 'Não foi possível carregar a fidelidade.';
  else if (!saldo.resgatePontosAtivo) motivo = 'Resgate por pontos desativado nas configurações de Fidelidade.';
  else if (!(Number(saldo.saldoPontos) > 0)) motivo = 'Este cliente não tem pontos disponíveis.';
  else if (!(Number(saldo.maxPontosUtilizaveis) > 0)) motivo = 'O valor do atendimento não permite usar pontos dentro do limite configurado.';
  return { habilitado: motivo === null, motivo };
}
