/**
 * DESIGN SYSTEM v2 "IVORY" — CAMADA DE TOKENS (tokens.ts)
 * IMPORTANTE: tokens.css e tokens.ts precisam ser mantidos em sincronia.
 * Este arquivo existe para o futuro app React Native e Electron consumirem.
 */

export const tokens = {
  swatch: {
    ivory: {
      light: '#faf9f5',
      medium: '#f0eee6',
      dark: '#e8e6dc',
      oat: '#e3dacc',
      faded10: '#faf9f51a',
      faded20: '#faf9f533',
    },
    slate: {
      dark: '#141413',
      medium: '#3d3d3a',
      light: '#5e5d59',
      faded10: '#1414131a',
      faded20: '#14141333',
    },
    cloud: {
      dark: '#87867f',
      medium: '#b0aea5',
      light: '#d1cfc5',
    },
    acento: {
      clay: '#d97757',
      accent: '#c6613f',
      kraft: '#d4a27f',
      olive: '#788c5d',
      sky: '#6a9bcc',
      manilla: '#ebdbbc',
      fig: '#c46686',
      coral: '#ebcece',
      cactus: '#bcd1ca',
      heather: '#cbcadb',
    },
  },
  temas: {
    claro: {
      superficies: {
        fundoPagina: '#faf9f5',
        fundoSuperficie: '#f0eee6',
        fundoSuperficie2: '#e8e6dc',
        fundoSuperficie3: '#e3dacc',
        fundoInverso: '#141413',
        fundoOverlay: '#14141399',
      },
      texto: {
        principal: '#141413',
        secundario: '#5e5d59',
        terciario: '#87867f',
        inverso: '#faf9f5',
        placeholder: '#87867f',
        desabilitado: '#b0aea5',
        label: '#5e5d59',
        detalhe: '0.8125rem',
      },
      bordas: {
        sutil: '#1414131a',
        media: '#14141333',
        forte: '#87867f',
        foco: '#d97757',
      },
      marca: {
        primaria: '#d97757',
        primariaHover: '#c6613f',
        primariaAtiva: '#b0552f',
        primariaSuave: '#f7e6df',
        textoSobrePrimaria: '#141413',
      },
      sinalizacao: {
        sucesso: '#4c593b',
        sucessoFundo: '#bcd1ca',
        info: '#476788',
        infoFundo: '#dbe7f2',
        aviso: '#755c1e',
        avisoFundo: '#ebdbbc',
        erro: '#87465c',
        erroFundo: '#ebcece',
      },
      elevacao: {
        1: '0 1px 2px #1414130d',
        2: '0 2px 8px #1414130f, 0 1px 2px #1414130a',
        3: '0 8px 24px #14141314, 0 2px 6px #1414130d',
      },
    },
    escuro: {
      superficies: {
        fundoPagina: '#141413',
        fundoSuperficie: '#1f1f1d',
        fundoSuperficie2: '#2a2a27',
        fundoSuperficie3: '#3d3d3a',
        fundoInverso: '#faf9f5',
        fundoOverlay: '#0a0a0acc',
      },
      texto: {
        principal: '#faf9f5',
        secundario: '#d1cfc5',
        terciario: '#b0aea5',
        inverso: '#141413',
        placeholder: '#87867f',
        desabilitado: '#5e5d59',
        label: '#d1cfc5',
        detalhe: '0.8125rem',
      },
      bordas: {
        sutil: '#faf9f51a',
        media: '#faf9f533',
        forte: '#7a7972',
        foco: '#d97757',
      },
      marca: {
        primaria: '#d97757',
        primariaHover: '#e08e70',
        primariaAtiva: '#c6613f',
        primariaSuave: '#3a251d',
        textoSobrePrimaria: '#141413',
      },
      sinalizacao: {
        sucesso: '#a8c48a',
        sucessoFundo: '#2b3a2a',
        info: '#8fb8dd',
        infoFundo: '#23323f',
        aviso: '#e0c68f',
        avisoFundo: '#3a3122',
        erro: '#e08fa5',
        erroFundo: '#3d2229',
      },
      elevacao: {
        1: '0 1px 2px #00000040',
        2: '0 2px 8px #00000059, 0 1px 2px #00000040',
        3: '0 8px 24px #00000073, 0 2px 6px #00000059',
      },
    },
  },
  tipografia: {
    sans: '"Inter Tight", -apple-system, "Segoe UI", Arial, sans-serif',
    serif: '"Newsreader", Georgia, "Times New Roman", serif',
    mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  },
  espacamento: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.5rem',
    6: '2rem',
    7: '2.5rem',
    8: '3rem',
    9: '4rem',
    10: '5rem',
    12: '6rem',
    16: '8rem',
  },
  raio: {
    none: '0',
    xs: '0.25rem',
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
    full: '9999px',
  },
  breakpoints: {
    sm: '375px',
    md: '768px',
    lg: '1024px',
    xl: '1440px',
    '2xl': '1920px',
  },
} as const;

export const CORES_REFERENCIA = {
  escuro: '#141413',
  claro: '#faf9f5',
  primariaPadrao: '#d97757',
  corPadraoBarbeiro: '#c6613f',
  primariaLaranja: '#d97757',
};

export const PALETA_CORES_BARBEIROS = [
  'var(--erro)', 'var(--cor-primaria)', 'var(--sucesso)', 'var(--info)',
  '#d97757', '#788c5d', '#c46686', '#c6613f', '#6a9bcc',
  '#bcd1ca', 'var(--info)'
];

export const CORES_CATEGORIA_SERVICO = {
  roxo: '#cbcadb',
  amarelo: '#ebdbbc',
  verde: '#788c5d',
  claroDemoBg: '#faf9f5',
  claroDemoText: '#141413',
  claroDemoBorder: '#1414131a',
  claroDemoSub: '#5e5d59',
  escuroDemoSub: '#d1cfc5',
  escuroDemoText: '#faf9f5',
};
