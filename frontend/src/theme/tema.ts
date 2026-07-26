export type ModoTema = 'claro' | 'escuro';
export type PreferenciaTema = ModoTema | 'auto';
const CHAVE = 'valen-modo-tema';
const consulta = () => window.matchMedia('(prefers-color-scheme: dark)');

export function lerPreferencia(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === 'claro' || v === 'escuro' || v === 'auto') return v;
  } catch { /* indisponivel */ }
  return 'auto';
}

export function resolverModo(pref: PreferenciaTema = lerPreferencia()): ModoTema {
  if (pref === 'auto') return consulta().matches ? 'escuro' : 'claro';
  return pref;
}

export function aplicarModo(modo: ModoTema): void {
  const raiz = document.documentElement;
  raiz.setAttribute('data-tema', modo);
  raiz.style.colorScheme = modo === 'escuro' ? 'dark' : 'light';
}

export function definirPreferencia(pref: PreferenciaTema): void {
  try { localStorage.setItem(CHAVE, pref); } catch { /* segue na sessao */ }
  aplicarModo(resolverModo(pref));
}

export function observarSistema(): () => void {
  const mq = consulta();
  const aoMudar = () => { if (lerPreferencia() === 'auto') aplicarModo(resolverModo('auto')); };
  mq.addEventListener('change', aoMudar);
  return () => mq.removeEventListener('change', aoMudar);
}
