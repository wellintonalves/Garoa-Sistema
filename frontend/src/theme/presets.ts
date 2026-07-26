export interface BlocoTokensTema {
  'fundo-pagina': string;
  'fundo-superficie': string;
  'superficie-1': string;
  'fundo-superficie-2': string;
  'superficie-2': string;
  'fundo-superficie-3': string;
  'superficie-3': string;
  'borda': string;
  'borda-sutil': string;
  'borda-media': string;
  'borda-forte': string;
  'texto-principal': string;
  'texto-secundario': string;
  'texto-terciario': string;
  'cor-primaria': string;
  'cor-primaria-hover': string;
  'cor-primaria-ativa': string;
  'cor-primaria-texto': string;
  [key: string]: string;
}

export interface PresetTema {
  id: string;
  nome: string;
  descricao: string;
  claro: BlocoTokensTema;
  escuro: BlocoTokensTema;
}

export const presets: Record<string, PresetTema> = {
  'Ivory': {
    id: 'Ivory',
    nome: 'Ivory (Padrão)',
    descricao: 'Âmbar suave e elegante com alto contraste',
    claro: {
      'fundo-pagina': '#FDF8EF',
      'fundo-superficie': '#FFFFFF',
      'superficie-1': '#FFFFFF',
      'fundo-superficie-2': '#FBF4E8',
      'superficie-2': '#FBF4E8',
      'fundo-superficie-3': '#F5EDDD',
      'superficie-3': '#F5EDDD',
      'borda': '#EFE9DB',
      'borda-sutil': '#EFE9DB',
      'borda-media': '#E5DFD1',
      'borda-forte': '#E3DBCB',
      'texto-principal': '#1A1712',
      'texto-secundario': '#6E675C',
      'texto-terciario': '#736B60',
      'cor-primaria': '#F59E0B',
      'cor-primaria-hover': '#D97706',
      'cor-primaria-ativa': '#B45309',
      'cor-primaria-texto': '#9A6300'
    },
    escuro: {
      'fundo-pagina': '#0A0A0A',
      'fundo-superficie': '#141414',
      'superficie-1': '#141414',
      'fundo-superficie-2': '#1E1E1E',
      'superficie-2': '#1E1E1E',
      'fundo-superficie-3': '#262626',
      'superficie-3': '#262626',
      'borda': '#262626',
      'borda-sutil': '#262626',
      'borda-media': '#333333',
      'borda-forte': '#404040',
      'texto-principal': '#F4F4F4',
      'texto-secundario': '#8F8F8F',
      'texto-terciario': '#949494',
      'cor-primaria': '#F59E0B',
      'cor-primaria-hover': '#FBBF24',
      'cor-primaria-ativa': '#FCD34D',
      'cor-primaria-texto': '#F59E0B'
    }
  },
  'Slate': {
    id: 'Slate',
    nome: 'Slate',
    descricao: 'Visual moderno e neutro em tons de ardósia (Linear/Raycast)',
    claro: {
      'fundo-pagina': '#F8FAFC',
      'fundo-superficie': '#FFFFFF',
      'superficie-1': '#FFFFFF',
      'fundo-superficie-2': '#F1F5F9',
      'superficie-2': '#F1F5F9',
      'fundo-superficie-3': '#E2E8F0',
      'superficie-3': '#E2E8F0',
      'borda': '#E2E8F0',
      'borda-sutil': '#E2E8F0',
      'borda-media': '#CBD5E1',
      'borda-forte': '#94A3B8',
      'texto-principal': '#0F172A',
      'texto-secundario': '#475569',
      'texto-terciario': '#64748B',
      'cor-primaria': '#3B82F6',
      'cor-primaria-hover': '#2563EB',
      'cor-primaria-ativa': '#1D4ED8',
      'cor-primaria-texto': '#1D4ED8'
    },
    escuro: {
      'fundo-pagina': '#0F172A',
      'fundo-superficie': '#1E293B',
      'superficie-1': '#1E293B',
      'fundo-superficie-2': '#334155',
      'superficie-2': '#334155',
      'fundo-superficie-3': '#475569',
      'superficie-3': '#475569',
      'borda': '#334155',
      'borda-sutil': '#334155',
      'borda-media': '#475569',
      'borda-forte': '#64748B',
      'texto-principal': '#F8FAFC',
      'texto-secundario': '#94A3B8',
      'texto-terciario': '#64748B',
      'cor-primaria': '#3B82F6',
      'cor-primaria-hover': '#60A5FA',
      'cor-primaria-ativa': '#93C5FD',
      'cor-primaria-texto': '#60A5FA'
    }
  },
  'Olive': {
    id: 'Olive',
    nome: 'Olive',
    descricao: 'Tons terrosos e sofisticados de oliva verde',
    claro: {
      'fundo-pagina': '#F7F8F5',
      'fundo-superficie': '#FFFFFF',
      'superficie-1': '#FFFFFF',
      'fundo-superficie-2': '#F0F2ED',
      'superficie-2': '#F0F2ED',
      'fundo-superficie-3': '#E1E6DC',
      'superficie-3': '#E1E6DC',
      'borda': '#E1E6DC',
      'borda-sutil': '#E1E6DC',
      'borda-media': '#CCD3C5',
      'borda-forte': '#A6B19B',
      'texto-principal': '#1A1C18',
      'texto-secundario': '#53584F',
      'texto-terciario': '#7C8377',
      'cor-primaria': '#4D7C0F',
      'cor-primaria-hover': '#3F6212',
      'cor-primaria-ativa': '#365314',
      'cor-primaria-texto': '#365314'
    },
    escuro: {
      'fundo-pagina': '#0B0F08',
      'fundo-superficie': '#141A10',
      'superficie-1': '#141A10',
      'fundo-superficie-2': '#1F2918',
      'superficie-2': '#1F2918',
      'fundo-superficie-3': '#26331D',
      'superficie-3': '#26331D',
      'borda': '#26331D',
      'borda-sutil': '#26331D',
      'borda-media': '#36472A',
      'borda-forte': '#4A6139',
      'texto-principal': '#F2F5F0',
      'texto-secundario': '#8A9382',
      'texto-terciario': '#5F6659',
      'cor-primaria': '#84CC16',
      'cor-primaria-hover': '#A3E635',
      'cor-primaria-ativa': '#BEF264',
      'cor-primaria-texto': '#84CC16'
    }
  },
  'Sky': {
    id: 'Sky',
    nome: 'Sky',
    descricao: 'Tons frescos e arejados de azul celeste',
    claro: {
      'fundo-pagina': '#F0F9FF',
      'fundo-superficie': '#FFFFFF',
      'superficie-1': '#FFFFFF',
      'fundo-superficie-2': '#E0F2FE',
      'superficie-2': '#E0F2FE',
      'fundo-superficie-3': '#BAE6FD',
      'superficie-3': '#BAE6FD',
      'borda': '#BAE6FD',
      'borda-sutil': '#BAE6FD',
      'borda-media': '#7DD3FC',
      'borda-forte': '#38BDF8',
      'texto-principal': '#082F49',
      'texto-secundario': '#0369A1',
      'texto-terciario': '#0284C7',
      'cor-primaria': '#0EA5E9',
      'cor-primaria-hover': '#0284C7',
      'cor-primaria-ativa': '#0369A1',
      'cor-primaria-texto': '#0284C7'
    },
    escuro: {
      'fundo-pagina': '#082F49',
      'fundo-superficie': '#0C4A6E',
      'superficie-1': '#0C4A6E',
      'fundo-superficie-2': '#075985',
      'superficie-2': '#075985',
      'fundo-superficie-3': '#0369A1',
      'superficie-3': '#0369A1',
      'borda': '#0369A1',
      'borda-sutil': '#0369A1',
      'borda-media': '#0284C7',
      'borda-forte': '#0EA5E9',
      'texto-principal': '#F0F9FF',
      'texto-secundario': '#7DD3FC',
      'texto-terciario': '#38BDF8',
      'cor-primaria': '#38BDF8',
      'cor-primaria-hover': '#7DD3FC',
      'cor-primaria-ativa': '#BAE6FD',
      'cor-primaria-texto': '#38BDF8'
    }
  },
  'Legado Amber': {
    id: 'Legado Amber',
    nome: 'Legado Amber',
    descricao: 'Esquema âmbar original do sistema anterior',
    claro: {
      'fundo-pagina': '#FFFBEB',
      'fundo-superficie': '#FFFFFF',
      'superficie-1': '#FFFFFF',
      'fundo-superficie-2': '#FEF3C7',
      'superficie-2': '#FEF3C7',
      'fundo-superficie-3': '#FDE68A',
      'superficie-3': '#FDE68A',
      'borda': '#FDE68A',
      'borda-sutil': '#FDE68A',
      'borda-media': '#FCD34D',
      'borda-forte': '#F59E0B',
      'texto-principal': '#1C1917',
      'texto-secundario': '#57534E',
      'texto-terciario': '#78716C',
      'cor-primaria': '#F59E0B',
      'cor-primaria-hover': '#D97706',
      'cor-primaria-ativa': '#B45309',
      'cor-primaria-texto': '#B45309'
    },
    escuro: {
      'fundo-pagina': '#0A0A0A',
      'fundo-superficie': '#141414',
      'superficie-1': '#141414',
      'fundo-superficie-2': '#1E1E1E',
      'superficie-2': '#1E1E1E',
      'fundo-superficie-3': '#262626',
      'superficie-3': '#262626',
      'borda': '#262626',
      'borda-sutil': '#262626',
      'borda-media': '#333333',
      'borda-forte': '#404040',
      'texto-principal': '#F4F4F4',
      'texto-secundario': '#8F8F8F',
      'texto-terciario': '#949494',
      'cor-primaria': '#F59E0B',
      'cor-primaria-hover': '#FBBF24',
      'cor-primaria-ativa': '#FCD34D',
      'cor-primaria-texto': '#F59E0B'
    }
  }
};

export const PRESET_PADRAO = presets['Ivory'];
export const PRESET_LEGADO = presets['Legado Amber'];
