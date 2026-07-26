import { describe, test, expect } from 'vitest';
import { razaoContraste, textoSobre, classificar, luminanciaRelativa } from './contraste';

describe('Utilitários de Contraste WCAG 2.1', () => {
  test('luminanciaRelativa(#ffffff) === 1 e #000000 === 0', () => {
    expect(luminanciaRelativa('#ffffff')).toBeCloseTo(1, 2);
    expect(luminanciaRelativa('#000000')).toBeCloseTo(0, 2);
  });

  test('razaoContraste(#141413, #faf9f5) ≈ 17.50', () => {
    const razao = razaoContraste('#141413', '#faf9f5');
    expect(razao).toBeCloseTo(17.50, 1);
  });

  test('razaoContraste(#5e5d59, #faf9f5) ≈ 6.26', () => {
    const razao = razaoContraste('#5e5d59', '#faf9f5');
    expect(razao).toBeCloseTo(6.26, 1);
  });

  test('razaoContraste(#141413, #d97757) ≈ 5.90', () => {
    const razao = razaoContraste('#141413', '#d97757');
    expect(razao).toBeCloseTo(5.90, 1);
  });

  test('razaoContraste(#ffffff, #d97757) ≈ 3.12', () => {
    const razao = razaoContraste('#ffffff', '#d97757');
    expect(razao).toBeCloseTo(3.12, 1);
  });

  test('textoSobre(#d97757) === #141413', () => {
    expect(textoSobre('#d97757')).toBe('#141413');
  });

  test('textoSobre(#141413) === #faf9f5', () => {
    expect(textoSobre('#141413')).toBe('#faf9f5');
  });

  test('classificar retorna os níveis WCAG corretos', () => {
    expect(classificar(7.0)).toBe('AAA');
    expect(classificar(17.5)).toBe('AAA');
    expect(classificar(4.5)).toBe('AA');
    expect(classificar(5.9)).toBe('AA');
    expect(classificar(3.0)).toBe('AA-large');
    expect(classificar(3.12)).toBe('AA-large');
    expect(classificar(2.99)).toBe('reprovado');
  });
});
