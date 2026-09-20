import { useState } from 'react';
import { PlanosAssinatura, PeriodicidadeAssinatura, type PlanoSaas } from '../../components/PlanosAssinatura';
import { CreditCard, DownloadSimple, EnvelopeSimple, Cake, Megaphone, ArrowRight } from '@phosphor-icons/react';

type Cenario = 'SEM_ASSINATURA' | 'TESTE' | 'PENDENTE' | 'CONSULTA';

const cenarios: Array<{ valor: Cenario; rotulo: string }> = [
  { valor: 'SEM_ASSINATURA', rotulo: 'Contratação' },
  { valor: 'TESTE', rotulo: 'Teste de 7 dias' },
  { valor: 'PENDENTE', rotulo: 'Pagamento recusado' },
  { valor: 'CONSULTA', rotulo: 'Consulta e exportação' },
];

function CardBase({ children, destaque = false }: { children: React.ReactNode; destaque?: boolean }) {
  return <section className={`bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 sm:p-6 min-w-0 ${destaque ? 'lg:col-span-2' : ''}`}>{children}</section>;
}

export function AssinaturaPreviewDev() {
  const [cenario, setCenario] = useState<Cenario>('SEM_ASSINATURA');
  const [periodicidade, setPeriodicidade] = useState<'MENSAL' | 'ANUAL'>('MENSAL');
  const [plano, setPlano] = useState<PlanoSaas>('BASICO');

  return (
    <main className="min-h-screen bg-[var(--fundo-pagina)] text-[var(--texto-principal)] p-4 sm:p-6 lg:p-10">
      <div className="max-w-6xl mx-auto min-w-0">
        <div className="rounded-xl bg-[var(--aviso-fundo)] p-4 text-sm">
          <strong>Prévia visual local.</strong> Todos os dados abaixo são sintéticos e os botões financeiros estão desativados. Nenhuma conta, cobrança ou alteração externa será criada.
        </div>

        <div className="mt-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div><p className="text-[13px] text-[var(--texto-secundario)]">Configurações</p><h1 className="font-editorial text-3xl sm:text-4xl mt-1">Assinatura</h1></div>
          <a href="/cadastro" className="btn-secondary !min-h-12 md:!min-h-10 inline-flex items-center justify-center gap-2">Ver cadastro com nascimento<ArrowRight size={18} /></a>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Cenários de assinatura">
          {cenarios.map((item) => <button key={item.valor} type="button" onClick={() => setCenario(item.valor)} className={`min-h-12 md:min-h-10 px-4 rounded-lg whitespace-nowrap text-sm ${cenario === item.valor ? 'bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)]' : 'bg-[var(--superficie-2)] text-[var(--texto-principal)]'}`}>{item.rotulo}</button>)}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-4">
          <CardBase destaque={cenario === 'SEM_ASSINATURA'}>
            <div className="flex items-start gap-3"><div className="w-10 h-10 rounded-[10px] bg-[var(--superficie-2)] flex items-center justify-center shrink-0 text-[var(--cor-primaria)]"><CreditCard size={22} /></div><div className="min-w-0"><h2 className="text-xl font-bold">Plano e cobrança</h2><p className="text-sm text-[var(--texto-secundario)] mt-1">A ativação depende da confirmação do provedor.</p></div></div>

            {cenario === 'SEM_ASSINATURA' ? (
              <div className="mt-6">
                <PeriodicidadeAssinatura valor={periodicidade} onChange={setPeriodicidade} />
                <PlanosAssinatura plano={plano} periodicidade={periodicidade} proDisponivel={false} onChange={setPlano} />
                <p className="mt-4 text-sm">Assinatura recorrente por cartão de crédito.</p>
                <label className="flex items-start gap-3 min-h-12 mt-3 text-sm"><input type="checkbox" className="mt-1" /><span>Li e aceito a oferta e os termos. O teste dura 7 dias.</span></label>
                <button disabled className="ds-btn ds-btn-primary min-h-12 md:min-h-10 mt-4 opacity-60">Iniciar contratação — demonstração</button>
                <p className="text-[13px] text-[var(--texto-secundario)] mt-3">Os planos são apresentados para revisão. A contratação permanece desativada antes da homologação.</p>
              </div>
            ) : (
              <div className="mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="bg-[var(--superficie-2)] rounded-lg p-4"><p className="text-[13px] text-[var(--texto-secundario)]">Plano</p><p className="font-semibold mt-1">Básico</p></div><div className="bg-[var(--superficie-2)] rounded-lg p-4"><p className="text-[13px] text-[var(--texto-secundario)]">Ciclo</p><p className="font-semibold mt-1">Mensal</p></div><div className="bg-[var(--superficie-2)] rounded-lg p-4"><p className="text-[13px] text-[var(--texto-secundario)]">Estado</p><p className="font-semibold mt-1">{cenario === 'TESTE' ? 'Período de teste' : cenario === 'PENDENTE' ? 'Pagamento pendente' : 'Somente consulta'}</p></div></div>
                <p className={`rounded-lg p-4 mt-4 text-sm ${cenario === 'TESTE' ? 'bg-[var(--superficie-2)]' : 'bg-[var(--aviso-fundo)]'}`}>{cenario === 'TESTE' ? 'Teste gratuito até 22 de setembro de 2026. A primeira cobrança vence depois desse período.' : cenario === 'PENDENTE' ? 'Regularização gratuita até 29 de setembro de 2026. Depois, a fatura é cancelada sem gerar dívida.' : 'Alterações bloqueadas. Consulta e exportação disponíveis até 29 de outubro de 2026.'}</p>
              </div>
            )}
          </CardBase>

          <CardBase>
            <h2 className="text-xl font-bold">Cancelamento e portabilidade</h2><p className="text-sm text-[var(--texto-secundario)] mt-1">Pedido e confirmação financeira aparecem como etapas diferentes.</p>
            <div className="mt-5 rounded-lg bg-[var(--superficie-2)] p-4"><p className="font-semibold">Nenhuma solicitação aberta</p><p className="text-[13px] text-[var(--texto-secundario)] mt-1">Cancelar não apaga dados nem interrompe um período já pago.</p></div>
            <div className="mt-5 flex flex-col sm:flex-row gap-3"><button disabled className="min-h-12 md:min-h-10 px-5 rounded-lg bg-[var(--erro)] text-[var(--texto-sobre-erro)] opacity-60">Solicitar cancelamento — demonstração</button><button disabled className="btn-secondary !min-h-12 md:!min-h-10 opacity-60"><DownloadSimple size={18} />Baixar exportação</button></div>
            <div className="mt-5 pt-5 border-t border-[var(--border)] flex items-start gap-3"><EnvelopeSimple size={20} className="text-[var(--cor-primaria)] shrink-0" /><div><p className="font-semibold text-sm">Também por e-mail</p><p className="text-[13px] text-[var(--texto-secundario)] mt-1">O suporte valida o e-mail administrativo e registra o mesmo recibo auditável.</p></div></div>
          </CardBase>

          <CardBase>
            <div className="flex items-start gap-3"><Cake size={24} className="text-[var(--cor-primaria)] shrink-0" /><div><h2 className="text-xl font-bold">Perfil do cliente</h2><p className="text-sm text-[var(--texto-secundario)] mt-1">Nascimento é obrigatório em novos cadastros; legados podem preencher depois.</p></div></div>
            <label className="block text-sm mt-5">Data de nascimento<input type="date" className="ds-input mt-2" defaultValue="1990-05-20" /></label>
          </CardBase>

          <CardBase>
            <div className="flex items-start gap-3"><Megaphone size={24} className="text-[var(--cor-primaria)] shrink-0" /><div><h2 className="text-xl font-bold">Preferências promocionais</h2><p className="text-sm text-[var(--texto-secundario)] mt-1">Desligadas por padrão e separadas por remetente e canal.</p></div></div>
            <div className="mt-5 space-y-3"><div className="rounded-lg bg-[var(--superficie-2)] p-4"><p className="font-semibold">Valen Barber</p><div className="flex flex-wrap gap-5 mt-3 text-sm"><label className="flex items-center min-h-12 gap-2"><input type="checkbox" />E-mail</label><label className="flex items-center min-h-12 gap-2"><input type="checkbox" />No aplicativo</label></div></div><div className="rounded-lg bg-[var(--superficie-2)] p-4"><p className="font-semibold">Barbearia Exemplo</p><div className="flex flex-wrap gap-5 mt-3 text-sm"><label className="flex items-center min-h-12 gap-2"><input type="checkbox" />E-mail</label><label className="flex items-center min-h-12 gap-2"><input type="checkbox" />No aplicativo</label></div></div></div>
          </CardBase>
        </div>
      </div>
    </main>
  );
}
