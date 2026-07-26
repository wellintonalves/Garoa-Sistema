/**
 * Utilitários de cálculo de contraste WCAG 2.1 para proteção visual do sistema.
 * Segue a Seção 4 do DESIGN_SYSTEM.md.
 */
import { CORES_REFERENCIA } from '../styles/tokens';

/**
 * Calcula a luminância relativa de uma cor hexadecimal (algoritmo WCAG 2.1 - sRGB linearizado).
 * Coeficientes: 0.2126 / 0.7152 / 0.0722.
 */
export function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace('#', '');
  const r = parseInt(limpo.substring(0, 2), 16) / 255;
  const g = parseInt(limpo.substring(2, 4), 16) / 255;
  const b = parseInt(limpo.substring(4, 6), 16) / 255;

  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calcula a razão de contraste entre duas cores no formato '#RRGGBB'.
 * Razão entre 1 (idênticas) e 21 (preto e branco).
 */
export function razaoContraste(corA: string, corB: string): number {
  const l1 = luminanciaRelativa(corA);
  const l2 = luminanciaRelativa(corB);

  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);

  return (max + 0.05) / (min + 0.05);
}

/**
 * Retorna cor de referência escura ou clara, o que tiver maior razão de contraste contra `fundo`.
 */
export function textoSobre(fundo: string): string {
  const escuro = CORES_REFERENCIA.escuro;
  const claro = CORES_REFERENCIA.claro;

  const razaoEscuro = razaoContraste(escuro, fundo);
  const razaoClaro = razaoContraste(claro, fundo);

  return razaoEscuro >= razaoClaro ? escuro : claro;
}

/**
 * Classifica a razão de contraste em níveis WCAG:
 * >= 7: AAA
 * >= 4.5: AA
 * >= 3: AA-large
 * resto: reprovado
 */
export function classificar(razao: number): 'AAA' | 'AA' | 'AA-large' | 'reprovado' {
  if (razao >= 7) return 'AAA';
  if (razao >= 4.5) return 'AA';
  if (razao >= 3) return 'AA-large';
  return 'reprovado';
}
