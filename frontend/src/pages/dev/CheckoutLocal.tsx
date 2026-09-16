import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/client';

export function CheckoutLocal() {
  const [params] = useSearchParams();
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);
  async function simular(resultado: 'aprovado' | 'recusado') {
    setEnviando(true); setMensagem('');
    try {
      const resposta = await api.post('/dev/checkout-local/confirmar', { checkout: params.get('checkout'), resultado });
      setMensagem(resposta.data.mensagem); setConcluido(true);
    } catch (erro) { setMensagem(erro instanceof Error ? erro.message : 'Não foi possível concluir a simulação. Tente novamente.'); }
    finally { setEnviando(false); }
  }
  return <main className="min-h-screen p-6 bg-[var(--fundo-pagina)] text-[var(--texto-principal)] flex items-center justify-center">
    <section className="max-w-xl w-full rounded-xl p-6 bg-[var(--fundo-superficie)] space-y-5">
      <p className="text-sm text-[var(--texto-secundario)]">Ambiente de demonstração</p>
      <h1 className="text-3xl font-semibold">Experimente a contratação</h1>
      <p>Este checkout usa apenas dados fictícios. Não informe cartão ou dados bancários: nenhum valor será cobrado.</p>
      <p>Escolha o resultado para conferir como o sistema responde. Novas barbearias entram no teste de sete dias; contas legadas simulam a confirmação do pagamento do plano.</p>
      {mensagem && <p role="status">{mensagem}</p>}
      {!concluido && <div className="flex flex-col sm:flex-row gap-3">
        <button disabled={enviando || !params.get('checkout')} onClick={() => void simular('aprovado')} className="btn-primary !min-h-12">{enviando ? 'Processando...' : 'Simular aprovação'}</button>
        <button disabled={enviando || !params.get('checkout')} onClick={() => void simular('recusado')} className="btn-secondary !min-h-12">Simular recusa</button>
      </div>}
      <Link to="/admin/configuracoes" className="underline !min-h-12 inline-flex items-center">Voltar para minha assinatura</Link>
    </section>
  </main>;
}
