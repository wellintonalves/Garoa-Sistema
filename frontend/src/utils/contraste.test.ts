import { describe, test, expect } from 'vitest';
import { razaoContraste, textoSobre, classificar, luminanciaRelativa } from './contraste';
// Compara contra o token, nao contra um hex fixo: quando CORES_REFERENCIA muda,
// o teste continua valido em vez de quebrar com uma cor antiga (foi o que aconteceu
// quando 'escuro' passou de #141413 para #0d0d0d).
import { CORES_REFERENCIA } from '../styles/tokens';

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

  test('textoSobre(primaria) escolhe a referencia escura', () => {
    expect(textoSobre('#d97757')).toBe(CORES_REFERENCIA.escuro);
    // E a escura tem mesmo o maior contraste sobre a primaria (6.23 vs 2.96).
    expect(razaoContraste(CORES_REFERENCIA.escuro, '#d97757'))
      .toBeGreaterThan(razaoContraste(CORES_REFERENCIA.claro, '#d97757'));
  });

  test('textoSobre(fundo escuro) escolhe a referencia clara', () => {
    expect(textoSobre('#141413')).toBe(CORES_REFERENCIA.claro);
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
