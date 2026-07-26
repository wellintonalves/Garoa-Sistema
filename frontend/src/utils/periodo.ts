export type Periodo = 'hoje'|'ontem'|'semana'|'esta_semana'|'mes'|'este_mes'|'mes_anterior'|'ano'|'7dias'|'30dias'|'90dias'|string|{inicio:Date;fim:Date};

export function rotuloComparacao(periodo: Periodo): string {
  if (typeof periodo === 'object' && periodo !== null && 'inicio' in periodo && 'fim' in periodo) {
    const dias = Math.max(1, Math.round((periodo.fim.getTime()-periodo.inicio.getTime())/86400000)+1);
    return `vs. ${dias} ${dias===1?'dia':'dias'} anteriores`;
  }
  switch (periodo) {
    case 'hoje':         return 'vs. ontem';
    case 'ontem':        return 'vs. anteontem';
    case 'semana':       
    case 'esta_semana':  return 'vs. semana passada';
    case 'mes':          
    case 'este_mes':     return 'vs. mês passado';
    case 'mes_anterior': return 'vs. 2 meses atrás';
    case 'ano':          return 'vs. ano passado';
    case '7dias':        return 'vs. 7 dias anteriores';
    case '30dias':       return 'vs. 30 dias anteriores';
    case '90dias':       return 'vs. 90 dias anteriores';
    default:             return 'vs. período anterior';
  }
}

export const getRotuloComparativo = rotuloComparacao;
