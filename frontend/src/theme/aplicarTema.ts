import { textoSobre } from '../utils/contraste';
import { presets, PRESET_LEGADO, BlocoTokensTema } from './presets';

export interface TemaBarbearia {
  preset?: string;
  claro?: BlocoTokensTema | Record<string, string>;
  escuro?: BlocoTokensTema | Record<string, string>;
  corPrimaria?: string; // Legado v1
  [key: string]: any;
}

export function aplicarTema(tema: TemaBarbearia | null | undefined, modo: 'claro' | 'escuro') {
  if (typeof window === 'undefined' || !document || !document.documentElement) return;
  const raiz = document.documentElement;
  raiz.setAttribute('data-tema', modo);
  raiz.classList.toggle('light', modo === 'claro');

  // Garante o objeto completo para o modo atual no tema, compatibilizando com legado ou preset
  let temaResolvido: TemaBarbearia = tema || {};
  if (!temaResolvido[modo] || Object.keys(temaResolvido[modo] || {}).length === 0) {
    if (temaResolvido.preset && presets[temaResolvido.preset]) {
      temaResolvido[modo] = { ...presets[temaResolvido.preset][modo] };
    } else if (temaResolvido.corPrimaria) {
      temaResolvido[modo] = {
        ...PRESET_LEGADO[modo],
        'cor-primaria': temaResolvido.corPrimaria,
        'cor-primaria-texto': temaResolvido.corPrimaria,
      };
    } else {
      temaResolvido[modo] = { ...PRESET_LEGADO[modo] };
    }
  }

  Object.entries(temaResolvido[modo] ?? {}).forEach(([token, valor]) => {
    if (typeof valor === 'string') {
      raiz.style.setProperty(`--${token}`, valor);
    }
  });

  // Compatibilidade com variáveis legadas consumidas por componentes antigos
  const blocoModo = temaResolvido[modo] as Record<string, string>;
  if (blocoModo && blocoModo['cor-primaria']) {
    raiz.style.setProperty('--amber', blocoModo['cor-primaria']);
    const hex = blocoModo['cor-primaria'].replace(/^#/, '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      raiz.style.setProperty('--cor-primaria-rgb', `${r},${g},${b}`);
    }
  }

  // derivado automaticamente, nunca fixo:
  const primaria = getComputedStyle(raiz).getPropertyValue('--cor-primaria').trim() || '#F59E0B';
  raiz.style.setProperty('--texto-sobre-primaria', textoSobre(primaria));
}
