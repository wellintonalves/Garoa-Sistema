export interface ContextoIa {
  barbeariaId: string;
  usuarioId: string;
  papel: 'ADMIN' | 'BARBEIRO' | 'CLIENTE';
  clienteId?: string;
}
