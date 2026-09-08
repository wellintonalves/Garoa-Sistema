import { describe, expect, it } from 'vitest';
import { statusPontos, type SaldoPontos } from './statusPontos';

const saldo: SaldoPontos = { saldoPontos: 100, maxPontosUtilizaveis: 50, resgatePontosAtivo: true };
describe('Disponibilidade de pontos no lançamento', () => {
  it('sem cliente explica a seleção, sem indicar carregamento', () => {
    expect(statusPontos(null, false, null, null)).toEqual({ habilitado: false, motivo: 'Selecione um cliente para usar pontos.' });
  });
  it('não habilita com saldo antigo enquanto consulta outro cliente ou valor', () => {
    expect(statusPontos('cliente', true, null, saldo).habilitado).toBe(false);
  });
  it.each([0, -10])('bloqueia saldo %s com explicação', saldoPontos => {
    expect(statusPontos('cliente', false, null, { ...saldo, saldoPontos })).toEqual({ habilitado: false, motivo: 'Este cliente não tem pontos disponíveis.' });
  });
  it('informa resgate desativado', () => {
    expect(statusPontos('cliente', false, null, { ...saldo, resgatePontosAtivo: false }).motivo).toContain('desativado');
  });
  it('informa teto insuficiente', () => {
    expect(statusPontos('cliente', false, null, { ...saldo, maxPontosUtilizaveis: 0 }).motivo).toContain('limite configurado');
  });
  it('preserva erro de conexão e bloqueia mesmo com saldo anterior', () => {
    expect(statusPontos('cliente', false, 'Falha de conexão', saldo)).toEqual({ habilitado: false, motivo: 'Falha de conexão' });
  });
  it('habilita cliente elegível', () => {
    expect(statusPontos('cliente', false, null, saldo)).toEqual({ habilitado: true, motivo: null });
  });
});
