import { describe, expect, it } from 'vitest';
import { validarPeriodoRelatorio } from './periodoRelatorio';

describe('período do relatório automático', () => {
  it('permite todo o histórico e intervalos válidos', () => {
    expect(validarPeriodoRelatorio('', '')).toBeNull();
    expect(validarPeriodoRelatorio('2026-09-01', '2026-09-26')).toBeNull();
    expect(validarPeriodoRelatorio('2024-02-29', '2024-02-29')).toBeNull();
  });
  it.each([['', '2026-09-26'], ['2026-09-01', ''], ['2026-09-27', '2026-09-26'], ['2026-02-29', '2026-03-01'], ['2026-04-31', '2026-05-01'], ['2026-09-0', '2026-09-26'], ['0000-01-01', '2026-09-26']])('bloqueia período incompleto ou inválido %s a %s', (inicio, fim) => {
    expect(validarPeriodoRelatorio(inicio, fim)).toBeTruthy();
  });
});
