export function dataBrasilia(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export function hojeBrasilia(): string {
  return dataBrasilia();
}
