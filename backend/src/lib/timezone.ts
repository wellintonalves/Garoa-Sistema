// Utilitário de fuso horário — America/Sao_Paulo (UTC-3)
// O sistema opera inteiramente no fuso de Brasília.
// Todas as datas são tratadas como horário local de Brasília.

const BRASILIA_OFFSET = '-03:00';

/**
 * Converte uma string de data/hora local (sem fuso) para Date com offset de Brasília.
 * Aceita formatos:
 * - "YYYY-MM-DDTHH:mm:ss"
 * - "YYYY-MM-DDTHH:mm"
 * - "YYYY-MM-DD HH:mm"
 * Se a string já tiver offset ou 'Z', retorna new Date() direto.
 */
export function toBrasiliaDate(dateStr: string): Date {
  // Se já tem timezone info, parseia direto
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr);
  }

  // Remove espaço entre data e hora se houver
  const normalized = dateStr.replace(' ', 'T');

  // Garante que tenha segundos
  const withSeconds = normalized.includes('T') && normalized.split('T')[1]?.split(':').length === 2
    ? `${normalized}:00`
    : normalized;

  // Adiciona offset de Brasília
  return new Date(`${withSeconds}${BRASILIA_OFFSET}`);
}

/**
 * Retorna o início do dia (00:00:00) no fuso de Brasília para uma data YYYY-MM-DD.
 */
export function inicioDiaBrasilia(dataStr: string): Date {
  // Extrai apenas YYYY-MM-DD se vier com horário
  const apenasData = dataStr.split('T')[0];
  return new Date(`${apenasData}T00:00:00${BRASILIA_OFFSET}`);
}

/**
 * Retorna o fim do dia (23:59:59.999) no fuso de Brasília para uma data YYYY-MM-DD.
 */
export function fimDiaBrasilia(dataStr: string): Date {
  const apenasData = dataStr.split('T')[0];
  return new Date(`${apenasData}T23:59:59.999${BRASILIA_OFFSET}`);
}

/**
 * Extrai hora e minuto de um Date no fuso de Brasília.
 * Retorna { hora, minuto } em números.
 */
export function getHoraMinutoBrasilia(date: Date): { hora: number; minuto: number } {
  // Usa Intl.DateTimeFormat para obter a hora no fuso de Brasília
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hora = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minuto = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  return { hora, minuto };
}

/**
 * Cria um Date para um horário específico (hora:minuto) de um dia no fuso de Brasília.
 * @param dataStr - Data no formato YYYY-MM-DD
 * @param hora - Hora (0-23)
 * @param minuto - Minuto (0-59)
 */
export function criarDataHoraBrasilia(dataStr: string, hora: number, minuto: number): Date {
  const apenasData = dataStr.split('T')[0];
  const h = String(hora).padStart(2, '0');
  const m = String(minuto).padStart(2, '0');
  return new Date(`${apenasData}T${h}:${m}:00${BRASILIA_OFFSET}`);
}

/**
 * Formata hora:minuto a partir de hora e minuto numéricos.
 */
export function formatarHorario(hora: number, minuto: number): string {
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

export function diaBrasiliaStr(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}
