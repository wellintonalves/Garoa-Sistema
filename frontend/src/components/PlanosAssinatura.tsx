import { Check } from '@phosphor-icons/react';

export type PlanoSaas = 'BASICO' | 'PRO';
export type PeriodicidadeSaas = 'MENSAL' | 'ANUAL';
export const PLANOS_SAAS = {
  BASICO: { nome: 'Básico', mensal: 3999, anual: 39990, descricao: 'O essencial para organizar sua barbearia.', limites: ['Até 8 barbeiros ativos', 'Até 200 clientes ativos'] },
  PRO: { nome: 'Pró', mensal: 6999, anual: 69990, descricao: 'Mais espaço para sua equipe crescer.', limites: ['Barbeiros ativos ilimitados', 'Clientes ativos ilimitados'] },
};
export function precoPlano(plano: PlanoSaas, periodo: PeriodicidadeSaas) {
  return PLANOS_SAAS[plano][periodo === 'MENSAL' ? 'mensal' : 'anual'];
}
export function valorPlano(centavos: number) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function PeriodicidadeAssinatura({ valor, onChange }: { valor: PeriodicidadeSaas; onChange: (valor: PeriodicidadeSaas) => void }) {
  return <div className="flex justify-center mb-8 sm:mb-10" role="group" aria-label="Periodicidade da assinatura">
    <div className="inline-flex rounded-full bg-[var(--superficie-2)] p-1 gap-1">
      {(['MENSAL', 'ANUAL'] as const).map(periodo => <button key={periodo} type="button" aria-pressed={valor === periodo} onClick={() => onChange(periodo)} className={`min-h-12 px-5 sm:px-7 rounded-full text-sm font-medium transition-colors ${valor === periodo ? 'bg-[var(--texto-principal)] text-[var(--bg-surface)]' : 'text-[var(--texto-secundario)]'}`}>
        {periodo === 'MENSAL' ? 'Mensal' : 'Anual'}
        {periodo === 'ANUAL' && <span className="ml-2 text-xs">−17%</span>}
      </button>)}
    </div>
  </div>;
}

export function PlanosAssinatura({ plano, periodicidade, proDisponivel, onChange, onEscolher, planoAtual }: {
  plano: PlanoSaas; periodicidade: PeriodicidadeSaas; proDisponivel: boolean;
  onChange: (plano: PlanoSaas) => void; onEscolher?: (plano: PlanoSaas) => void; planoAtual?: PlanoSaas;
}) {
  return <div className="min-w-0" role="group" aria-label="Planos disponíveis">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {(['BASICO', 'PRO'] as const).map(id => {
        const oferta = PLANOS_SAAS[id];
        const disponivel = id === 'BASICO' || proDisponivel;
        const atual = planoAtual === id;
        const recursos = id === 'BASICO'
          ? [...oferta.limites, 'Agenda e disponibilidade dos barbeiros', 'Serviços, vendas e controle de estoque']
          : ['Todos os recursos do Básico', ...oferta.limites];
        return <article key={id} className="flex flex-col min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3 min-h-9">
            <h3 className="text-2xl font-semibold text-[var(--texto-principal)]">{oferta.nome}</h3>
            {atual && <span className="rounded-full bg-[var(--superficie-2)] px-3 py-1 text-xs text-[var(--texto-secundario)]">Seu plano</span>}
          </div>
          <p className="text-sm text-[var(--texto-secundario)] mt-2 min-h-10">{oferta.descricao}</p>
          <p className="font-mono text-[clamp(1.75rem,3vw,2.25rem)] tabular-nums whitespace-nowrap font-medium mt-7 text-[var(--texto-principal)]">{valorPlano(precoPlano(id, periodicidade))}<span className="font-sans ml-1 text-sm font-normal text-[var(--texto-secundario)]">/{periodicidade === 'MENSAL' ? 'mês' : 'ano'}</span></p>
          <p className="text-xs text-[var(--texto-secundario)] mt-2 min-h-5">{periodicidade === 'ANUAL' ? 'Pagamento anual à vista' : 'Cobrado mensalmente'}</p>
          <button type="button" data-plano={id} disabled={!disponivel || atual} aria-pressed={!onEscolher ? plano === id : undefined} onClick={() => { onChange(id); onEscolher?.(id); }} className="mt-6 min-h-12 w-full rounded-full px-4 py-3 text-sm font-semibold bg-[var(--texto-principal)] text-[var(--bg-surface)] disabled:bg-[var(--superficie-2)] disabled:text-[var(--texto-secundario)] disabled:cursor-default">
            {!disponivel ? 'Pró indisponível' : atual ? 'Plano atual' : `Escolher ${oferta.nome}`}
          </button>
          <ul className="space-y-4 mt-8 text-sm leading-6 text-[var(--texto-principal)]">
            {recursos.map(item => <li key={item} className="flex items-start gap-3 min-w-0"><Check size={19} className="shrink-0 mt-0.5 text-[var(--texto-secundario)]" /><span className="min-w-0">{item}</span></li>)}
          </ul>
        </article>;
      })}
    </div>
    <p className="text-xs text-center text-[var(--texto-secundario)] mt-5">Loja virtual é um recurso futuro e não faz parte dos planos atuais.</p>
  </div>;
}
