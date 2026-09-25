import { deslocarDia } from './periodoProducao';
export interface DiaProducao { dia: string; produzido: number; comissao: number; atendimentos?: number; manuais?: number }
export interface RegistroProducao { id: string; dia: string; dataAtendimento: string | null; origem: 'ATENDIMENTO' | 'MANUAL'; produzido: number; comissao: number; liquido: number }
export interface HoraProducao { chave: string; rotulo: string; produzido: number; comissao: number; atendimentos: number; manuais: number; ids: string[] }
export function preencherDiasProducao(dias: DiaProducao[], inicio: string, fim: string): DiaProducao[] {
  const porDia = new Map(dias.map(d => [d.dia, d]));
  const resultado: DiaProducao[] = [];
  for (let dia = inicio; dia <= fim && resultado.length < 93; dia = deslocarDia(dia, 1)) resultado.push(porDia.get(dia) ?? { dia, produzido: 0, comissao: 0, atendimentos: 0, manuais: 0 });
  return resultado;
}
export function chaveHoraProducao(registro: RegistroProducao, dia: string) {
  if (registro.origem === 'MANUAL' || !registro.dataAtendimento || !Number.isFinite(Date.parse(registro.dataAtendimento))) return 'sem-horario';
  const instante = new Date(registro.dataAtendimento);
  if (instante.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) !== dia) return 'outra-data';
  return instante.toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' });
}
export function agruparProducaoHoraria(registros: RegistroProducao[], dia: string): HoraProducao[] {
  const grupos = new Map<string, HoraProducao>();
  const vistos = new Set<string>();
  for (let hora = 0; hora < 24; hora++) {
    const chave = String(hora).padStart(2, '0');
    grupos.set(chave, { chave, rotulo: `${chave}h–${chave}h59`, produzido: 0, comissao: 0, atendimentos: 0, manuais: 0, ids: [] });
  }
  for (const r of registros.filter(r => r.dia === dia)) {
    if (vistos.has(r.id)) continue;
    vistos.add(r.id);
    const chave = chaveHoraProducao(r, dia);
    const grupo = grupos.get(chave) ?? { chave, rotulo: chave === 'outra-data' ? 'Atendimento em outra data' : 'Sem horário de atendimento', produzido: 0, comissao: 0, atendimentos: 0, manuais: 0, ids: [] };
    grupo.produzido = (Math.round(grupo.produzido * 100) + Math.round(r.produzido * 100)) / 100;
    grupo.comissao = (Math.round(grupo.comissao * 100) + Math.round(r.comissao * 100)) / 100;
    grupo[r.origem === 'ATENDIMENTO' ? 'atendimentos' : 'manuais']++;
    grupo.ids.push(r.id); grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}
export function totalizarRegistros(registros: RegistroProducao[]) {
  return { produzido: registros.reduce((s,r)=>s+Math.round(r.produzido*100),0)/100,
    comissao: registros.reduce((s,r)=>s+Math.round(r.comissao*100),0)/100,
    liquido: registros.reduce((s,r)=>s+Math.round(r.liquido*100),0)/100,
    atendimentos: registros.filter(r=>r.origem==='ATENDIMENTO').length, manuais: registros.filter(r=>r.origem==='MANUAL').length };
}
