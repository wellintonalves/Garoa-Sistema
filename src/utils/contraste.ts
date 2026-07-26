/**
 * Utilitários de cálculo de contraste WCAG 2.1 para proteção visual do sistema.
 * Segue a Seção 4 do DESIGN_SYSTEM.md.
 */

/**
 * Calcula a luminância relativa de uma cor hexadecimal (algoritmo WCAG 2.1 - sRGB linearizado).
 * Coeficientes: 0.2126 / 0.7152 / 0.0722.
 */
export function luminanciaRelativa(hex: string): number {
  const limpo = hex.replace(/^#/, '');
  const completo =
    limpo.length === 3
      ? limpo
          .split('')
          .map((c) => c + c)
          .join('')
      : limpo;

  const r = parseInt(completo.substring(0, 2), 16) / 255;
  const g = parseInt(completo.substring(2, 4), 16) / 255;
  const b = parseInt(completo.substring(4, 6), 16) / 255;

  const linearizar = (c: number): number => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const R = linearizar(r);
  const G = linearizar(g);
  const B = linearizar(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Calcula a razão de contraste entre duas cores hexadecimais: (L1 + 0.05) / (L2 + 0.05).
 * Retorna o valor arredondado em 2 casas decimais.
 */
export function razaoContraste(cor1: string, cor2: string): number {
  const l1 = luminanciaRelativa(cor1);
  const l2 = luminanciaRelativa(cor2);

  const max = Math.max(l1, l2);
  const min = Math.min(l1, l2);

  const razao = (max + 0.05) / (min + 0.05);
  return Number(razao.toFixed(2));
}

/**
 * Retorna '#141413' ou '#faf9f5', o que tiver maior razão de contraste contra `fundo`.
 */
export function textoSobre(fundo: string): string {
  const escuro = '#141413';
  const claro = '#faf9f5';

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
