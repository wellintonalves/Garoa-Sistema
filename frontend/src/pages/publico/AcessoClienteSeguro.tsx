import { Link, useSearchParams } from 'react-router-dom';
import { useClienteAuth } from '../../hooks/useClienteAuth';
import { SkeletonPage } from '../../components/Skeleton';

/** Public entry links continue through the existing verified customer account flow. */
export function AcessoClienteSeguro({ finalidade }: { finalidade: 'agendar' | 'fidelidade' }) {
  const { cliente, carregando } = useClienteAuth();
  const [params] = useSearchParams();
  const slug = params.get('slug');
  const destino = slug ? `/cliente/home?slug=${encodeURIComponent(slug)}` : '/cliente/home';
  if (carregando) return <main className="p-6"><SkeletonPage /></main>;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--fundo-pagina)] text-[var(--texto-principal)]">
      <section className="w-full max-w-md min-w-0 rounded-xl p-6 bg-[var(--fundo-card)]">
        <h1 className="font-display text-2xl mb-4">{finalidade === 'agendar' ? 'Agende seu atendimento' : 'Sua fidelidade'}</h1>
        <p className="text-[var(--texto-secundario)] mb-6">
          {finalidade === 'agendar'
            ? 'Acesse sua conta e escolha a barbearia para reservar seu horário com segurança.'
            : 'Acesse sua conta para consultar seus pontos e seu histórico na barbearia.'}
        </p>
        <Link className="btn-primary min-h-12 w-full flex items-center justify-center" to={cliente ? destino : '/'} state={cliente ? undefined : { destino }}>
          {cliente ? 'Escolher barbearia' : 'Entrar na minha conta'}
        </Link>
        {!cliente && <Link className="min-h-12 mt-3 flex items-center justify-center text-[var(--cor-primaria)]" to="/cadastro">Criar conta</Link>}
      </section>
    </main>
  );
}
