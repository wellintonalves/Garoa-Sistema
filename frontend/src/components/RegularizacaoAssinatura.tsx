import { useState } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import api from '../api/client';

export function validarFaturaAsaas(valor: string, ambiente: string): string {
  const url = new URL(valor);
  const hosts = ambiente === 'PRODUCTION' ? ['www.asaas.com', 'asaas.com'] : ambiente === 'SANDBOX' ? ['sandbox.asaas.com'] : [];
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(url.hostname) || url.port) throw new Error('Endereço de fatura inválido. Consulte o suporte.');
  return url.toString();
}

export function RegularizacaoAssinatura({ status, ambiente, renovacaoAutomatica, revisao }: {
  status: string; ambiente: string; renovacaoAutomatica: boolean; revisao?: { mensagem: string } | null;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  async function consultar() {
    setEnviando(true); setErro(null); setUrl(null); setMensagem(null);
    try {
      const { data } = await api.get('/assinatura/regularizacao');
      setMensagem(data.mensagem);
      if (data.invoiceUrl) setUrl(validarFaturaAsaas(data.invoiceUrl, ambiente));
      if (data.estado === 'PAGA') window.dispatchEvent(new Event('assinatura-atualizada'));
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível consultar a fatura. Tente novamente.'); }
    finally { setEnviando(false); }
  }
  async function atualizarCartao() {
    setEnviando(true); setErro(null); setMensagem(null);
    try {
      const { data } = await api.post('/assinatura/cartao-da-cobranca', { aceite });
      setMensagem(data.mensagem); setAceite(false);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível confirmar a atualização. Consulte o suporte.'); }
    finally { setEnviando(false); }
  }
  const suporte = `mailto:${import.meta.env.VITE_SUPORTE_CANCELAMENTO_EMAIL || 'wellintonalves1910@gmail.com'}?subject=Pagamento%20da%20assinatura`;
  if (revisao) return <div role="status" className="min-w-0 rounded-lg bg-[var(--aviso-fundo)] p-4 text-sm text-[var(--texto-principal)]"><p>{revisao.mensagem}</p><a href={suporte} className="inline-flex min-h-12 items-center underline">Falar com o suporte</a></div>;
  if (!['PAGAMENTO_PENDENTE', 'ATIVA'].includes(status)) return null;
  return <section className="min-w-0 space-y-3 rounded-lg bg-[var(--superficie-2)] p-4" aria-label="Pagamentos da assinatura" aria-busy={enviando}>
    <p className="text-sm text-[var(--texto-principal)]">{status === 'PAGAMENTO_PENDENTE' ? 'Abra a fatura para regularizar o pagamento. Você pode informar o cartão desejado no ambiente seguro do Asaas.' : 'Consulte sua última fatura ou use o cartão desse pagamento nas próximas renovações.'}</p>
    <div className="flex flex-wrap gap-3 min-w-0">
      <button type="button" className="btn-primary !min-h-12 w-full sm:w-auto" disabled={enviando} onClick={() => void consultar()}>{enviando ? 'Aguarde…' : erro ? 'Tentar consultar novamente' : 'Consultar fatura'}</button>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-primary !min-h-12 w-full sm:w-auto"><ArrowSquareOut size={18} weight="regular" />Abrir fatura no Asaas</a>}
    </div>
    {status === 'ATIVA' && renovacaoAutomatica && <div className="space-y-3">
      <label className="flex min-h-12 items-center gap-3 text-sm text-[var(--texto-principal)]"><input type="checkbox" checked={aceite} disabled={enviando} onChange={e => setAceite(e.target.checked)} /><span className="min-w-0">Quero usar o cartão da última fatura paga nas próximas renovações, sem cobrar agora.</span></label>
      <button type="button" className="btn-primary !min-h-12 w-full sm:w-auto" disabled={!aceite || enviando} onClick={() => void atualizarCartao()}>Atualizar cartão das renovações</button>
    </div>}
    {mensagem && <p role="status" className="text-sm text-[var(--texto-principal)]">{mensagem}</p>}
    {erro && <p role="alert" className="text-sm text-[var(--texto-principal)]">{erro}</p>}
    <a href={suporte} className="inline-flex min-h-12 items-center text-sm text-[var(--texto-principal)] underline">Preciso de ajuda com o pagamento</a>
  </section>;
}
