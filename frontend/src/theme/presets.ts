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

const BASE_IVORY: BlocoTokensTema = {
  'fundo-pagina': '#faf9f5',
  'fundo-superficie': '#f0eee6',
  'superficie-1': '#f0eee6',
  'fundo-superficie-2': '#e8e6dc',
  'superficie-2': '#e8e6dc',
  'fundo-superficie-3': '#e3dacc',
  'superficie-3': '#e3dacc',
  'borda': '#1414131a',
  'borda-sutil': '#1414131a',
  'borda-media': '#14141333',
  'borda-forte': '#87867f',
  'texto-principal': '#141413',
  'texto-secundario': '#5e5d59',
  'texto-terciario': '#87867f',
  'cor-primaria': '#d97757',
  'cor-primaria-hover': '#c6613f',
  'cor-primaria-ativa': '#b0552f',
  'cor-primaria-texto': '#a8492a',
};

const BASE_SLATE: BlocoTokensTema = {
  'fundo-pagina': '#141413',
  'fundo-superficie': '#1f1f1d',
  'superficie-1': '#1f1f1d',
  'fundo-superficie-2': '#2a2a27',
  'superficie-2': '#2a2a27',
  'fundo-superficie-3': '#3d3d3a',
  'superficie-3': '#3d3d3a',
  'borda': '#faf9f51a',
  'borda-sutil': '#faf9f51a',
  'borda-media': '#faf9f533',
  'borda-forte': '#7a7972',
  'texto-principal': '#faf9f5',
  'texto-secundario': '#d1cfc5',
  'texto-terciario': '#b0aea5',
  'cor-primaria': '#d97757',
  'cor-primaria-hover': '#e08e70',
  'cor-primaria-ativa': '#c6613f',
  'cor-primaria-texto': '#e08e70',
};

export const presets: Record<string, PresetTema> = {
  'Ivory': {
    id: 'Ivory',
    nome: 'Ivory (Padrão)',
    descricao: 'Paleta padrão elegante (Ivory no claro, Slate no escuro)',
    claro: { ...BASE_IVORY },
    escuro: { ...BASE_SLATE },
  },
  'Slate': {
    id: 'Slate',
    nome: 'Slate',
    descricao: 'Visual escuro estruturado em tons de ardósia (Slate)',
    claro: { ...BASE_SLATE },
    escuro: { ...BASE_SLATE },
  },
  'Olive': {
    id: 'Olive',
    nome: 'Olive',
    descricao: 'Tons terrosos e sofisticados de oliva verde sobre a base Ivory',
    claro: {
      ...BASE_IVORY,
      'cor-primaria': '#788c5d',
      'cor-primaria-hover': '#65774d',
      'cor-primaria-ativa': '#53623e',
      'cor-primaria-texto': '#53623e',
    },
    escuro: {
      ...BASE_SLATE,
      'cor-primaria': '#788c5d',
      'cor-primaria-hover': '#8b9f70',
      'cor-primaria-ativa': '#a1b387',
      'cor-primaria-texto': '#8b9f70',
    },
  },
  'Sky': {
    id: 'Sky',
    nome: 'Sky',
    descricao: 'Tons frescos de azul celeste sobre a base Ivory',
    claro: {
      ...BASE_IVORY,
      'cor-primaria': '#6a9bcc',
      'cor-primaria-hover': '#5786b5',
      'cor-primaria-ativa': '#46729f',
      'cor-primaria-texto': '#3f668e',
    },
    escuro: {
      ...BASE_SLATE,
      'cor-primaria': '#6a9bcc',
      'cor-primaria-hover': '#82add9',
      'cor-primaria-ativa': '#9bbfe4',
      'cor-primaria-texto': '#82add9',
    },
  },
  'Legado Amber': {
    id: 'Legado Amber',
    nome: 'Legado Amber',
    descricao: 'Esquema âmbar original do sistema anterior, só para tenants antigos',
    claro: {
      'fundo-pagina': '#fdf8ef',
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
      'cor-primaria': '#ff8c00',
      'cor-primaria-hover': '#D97706',
      'cor-primaria-ativa': '#B45309',
      'cor-primaria-texto': '#B45309',
    },
    escuro: {
      'fundo-pagina': '#0a0a0a',
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
      'cor-primaria': '#f59e0b',
      'cor-primaria-hover': '#ff8c00',
      'cor-primaria-ativa': '#FCD34D',
      'cor-primaria-texto': '#f59e0b',
    },
  },
};

export const PRESET_PADRAO = presets['Ivory'];
export const PRESET_LEGADO = presets['Legado Amber'];
