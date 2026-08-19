export const ESCALA_HORA_PX = 49 / 30;

/**
 * Escala unificada de empilhamento (z-index).
 * TODA camada nova deve ser declarada aqui e NUNCA escrita diretamente no componente (inline ou Tailwind chumbado).
 */
export const Z_INDEX = {
  CONTEUDO: 0,
  EVENTO_AGENDA: 20,
  BLOQUEIO_AGENDA: 30,
  LINHA_TEMPO_ATUAL: 40,
  CABECALHO_FIXO: 50,
  MENU_SUSPENSO: 100,
  MODAL: 200,
  TOAST_AVISO: 300,
} as const;
