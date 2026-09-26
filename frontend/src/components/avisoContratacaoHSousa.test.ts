import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TransicaoLegado } from './TransicaoLegadoBanner';
import { agendarLimiteAvisoHSousa, H_SOUSA_ATIVA_ID, ocultarAvisoContratacaoHSousa } from './avisoContratacaoHSousa';

const transicao: TransicaoLegado = {
  legada: true, status: 'PRAZO_MIGRACAO', avisoEm: null,
  prazoAte: '2026-10-26T03:00:00.000Z', consultaExportacaoAte: null,
  diasRestantes: 30, elegivelTeste: false,
};
const durante = Date.parse('2026-10-10T12:00:00-03:00');

afterEach(() => vi.useRealTimers());

describe('Aviso de contratação durante o período pago da H Sousa', () => {
  it.each([
    ['2026-09-25T22:33:00-03:00', true],
    ['2026-09-25T23:59:59.999-03:00', true],
    ['2026-09-26T00:00:00-03:00', true],
    ['2026-10-25T23:59:59.999-03:00', true],
    ['2026-10-26T00:00:00-03:00', false],
    ['2026-10-27T12:00:00-03:00', false],
  ])('respeita o limite em São Paulo: %s', (data, oculto) => {
    expect(ocultarAvisoContratacaoHSousa(H_SOUSA_ATIVA_ID, transicao, null, Date.parse(data))).toBe(oculto);
  });

  it.each(['ebcb9e56-75be-4540-af5d-536059b873a7', 'outra-barbearia', null, undefined])(
    'preserva o aviso de outro cadastro, mesmo com o mesmo prazo: %s', id => {
      expect(ocultarAvisoContratacaoHSousa(id, transicao, null, durante)).toBe(false);
    },
  );

  it('preserva o aviso de outras barbearias cujo prazo vence amanhã', () => {
    expect(ocultarAvisoContratacaoHSousa('outra-barbearia', {
      ...transicao, prazoAte: '2026-09-26T15:16:27.106Z',
    }, null, Date.parse('2026-09-26T03:00:00Z'))).toBe(false);
  });

  it.each(['AGUARDANDO_AVISO', 'CONSULTA_EXPORTACAO', 'ENCERRADA', 'MIGRADA', 'AGUARDANDO_DISPONIBILIDADE'] as const)(
    'não oculta outros estados da própria H Sousa: %s', status => {
      expect(ocultarAvisoContratacaoHSousa(H_SOUSA_ATIVA_ID, { ...transicao, status }, null, durante)).toBe(false);
    },
  );

  it('exige resposta compatível com a liberação manual e ausência de assinatura', () => {
    for (const estado of [null, { ...transicao, legada: false }, { ...transicao, prazoAte: null }, { ...transicao, prazoAte: '2026-10-01T03:00:00Z' }]) {
      expect(ocultarAvisoContratacaoHSousa(H_SOUSA_ATIVA_ID, estado, null, durante)).toBe(false);
    }
    expect(ocultarAvisoContratacaoHSousa(H_SOUSA_ATIVA_ID, transicao, { status: 'PAGAMENTO_PENDENTE' }, durante)).toBe(false);
  });

  it.each(['2026-10-26T03:00:00Z'])(
    'atualiza uma página aberta exatamente no limite %s', limite => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.parse(limite) - 1);
      const atualizar = vi.fn();
      agendarLimiteAvisoHSousa(Date.now(), atualizar);
      expect(atualizar).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(atualizar).toHaveBeenCalledTimes(1);
    },
  );

  it('atravessa o mês sem estourar o limite do timer e permite limpeza', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-09-26T03:00:00Z'));
    const atualizar = vi.fn();
    agendarLimiteAvisoHSousa(Date.now(), atualizar);
    vi.advanceTimersByTime(2_147_483_646);
    expect(atualizar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(atualizar).toHaveBeenCalledTimes(1);
    const cancelar = agendarLimiteAvisoHSousa(Date.now(), atualizar);
    cancelar();
    vi.advanceTimersByTime(31 * 86_400_000);
    expect(atualizar).toHaveBeenCalledTimes(1);
    agendarLimiteAvisoHSousa(Date.now(), atualizar);
    expect(vi.getTimerCount()).toBe(0);
  });
});
