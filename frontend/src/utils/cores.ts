export function calcularCorContraste(hexFundo: string): string {
  const r = parseInt(hexFundo.slice(1,3), 16);
  const g = parseInt(hexFundo.slice(3,5), 16);
  const b = parseInt(hexFundo.slice(5,7), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.5 ? '#1A1A1A' : '#FFFFFF';
}

export function clarearCor(hex: string, percentual: number): string {
  const r = Math.min(255, parseInt(hex.slice(1,3), 16) + Math.round(255 * percentual));
  const g = Math.min(255, parseInt(hex.slice(3,5), 16) + Math.round(255 * percentual));
  const b = Math.min(255, parseInt(hex.slice(5,7), 16) + Math.round(255 * percentual));
  return `rgb(${r},${g},${b})`;
}

export function escurecerCor(hex: string, percentual: number): string {
  const r = Math.max(0, parseInt(hex.slice(1,3), 16) - Math.round(255 * percentual));
  const g = Math.max(0, parseInt(hex.slice(3,5), 16) - Math.round(255 * percentual));
  const b = Math.max(0, parseInt(hex.slice(5,7), 16) - Math.round(255 * percentual));
  return `rgb(${r},${g},${b})`;
}

export function gerarCorIcone(corPrimaria: string): string {
  const r = parseInt(corPrimaria.slice(1,3), 16);
  const g = parseInt(corPrimaria.slice(3,5), 16);
  const b = parseInt(corPrimaria.slice(5,7), 16);
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminancia > 0.6) return escurecerCor(corPrimaria, 0.3);
  if (luminancia > 0.3) return clarearCor(corPrimaria, 0.4);
  return clarearCor(corPrimaria, 0.6);
}
