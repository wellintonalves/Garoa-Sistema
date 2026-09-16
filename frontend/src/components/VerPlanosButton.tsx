import { useSearchParams } from 'react-router-dom';

export function VerPlanosButton() {
  const [, setSearchParams] = useSearchParams();
  return <button type="button" className="inline-flex items-center justify-center min-h-12 px-5 rounded-lg bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-semibold shrink-0" onClick={() => setSearchParams(atuais => {
    const proximos = new URLSearchParams(atuais);
    proximos.set('planos', 'aberto');
    return proximos;
  })}>Ver planos</button>;
}
