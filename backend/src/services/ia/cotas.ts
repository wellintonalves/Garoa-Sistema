export interface ContextoIa {
  barbeariaId: string;
  usuarioId: string;
  papel: 'ADMIN' | 'BARBEIRO' | 'CLIENTE';
  clienteId?: string;
}

/** Contrato para armazenamento transacional futuro. Não implementar em memória.
 * Reserva e liquidação devem ser idempotentes e atômicas por barbearia/período.
 * Falhas ambíguas do provedor mantêm a reserva até reconciliação.
 */
export interface RepositorioCotasIa {
  reservar(contexto: ContextoIa, pedido: {
    idempotencia: string;
    creditosMaximos: number;
    mensagensMaximas: number;
    segundosVozMaximos: number;
  }): Promise<{ reservaId: string }>;
  liquidar(contexto: ContextoIa, reservaId: string, uso: {
    creditos: number;
    mensagens: number;
    segundosVoz: number;
    respostaProvedorId: string;
  }): Promise<void>;
}

export class ConsumoIaBloqueado extends Error {
  constructor() { super('O controle persistente de créditos de IA ainda não está disponível.'); }
}

// Única implementação nesta fase. Nenhuma variável de ambiente libera consumo.
export class CotasIaIndisponiveis implements RepositorioCotasIa {
  async reservar(): Promise<never> { throw new ConsumoIaBloqueado(); }
  async liquidar(): Promise<never> { throw new ConsumoIaBloqueado(); }
}
