import { useCallback, useEffect, useState } from 'react';
import { lerPreferencia, resolverModo, definirPreferencia, observarSistema,
         type ModoTema, type PreferenciaTema } from '../theme/tema';

export function useTema() {
  const [preferencia, setPreferencia] = useState<PreferenciaTema>(lerPreferencia);
  const [modo, setModo] = useState<ModoTema>(() => resolverModo());

  useEffect(() => observarSistema(), []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => setModo(resolverModo());
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  const alterar = useCallback((pref: PreferenciaTema) => {
    definirPreferencia(pref);
    setPreferencia(pref);
    setModo(resolverModo(pref));
  }, []);

  return { preferencia, modo, alterar };
}
