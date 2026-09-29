import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AxiosInstance } from 'axios';
import { X } from '@phosphor-icons/react';
import arte from '../assets/valeria-lancamento.png';
import './LancamentoValeria.css';

const vistos = new Set<string>();
const chaveVersao = 'valeria-lancamento-v1';
function leu(chave: string) {
  try { return vistos.has(chave) || localStorage.getItem(chave) === 'visto'; } catch { return vistos.has(chave); }
}
function marcar(chave: string) {
  vistos.add(chave);
  try { localStorage.setItem(chave, 'visto'); } catch { /* Sem armazenamento, lembrar nesta sessão. */ }
}

export function LancamentoValeria({ api, caminho, identidade, botao, chatAberto, abrirChat }: {
  api: AxiosInstance; caminho: string; identidade: string; botao: RefObject<HTMLButtonElement | null>;
  chatAberto: boolean; abrirChat: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const [mostrar, setMostrar] = useState(false);
  const [dica, setDica] = useState(false);
  // Rearma uma revisão específica sem apagar preferências ou repetir o anúncio para outros usuários.
  const revisao = identidade === import.meta.env.VITE_VALERIA_REVISAO_IDENTIDADE
    ? import.meta.env.VITE_VALERIA_REVISAO_VERSAO?.trim() : '';
  // Link de revisão reutilizável, restrito à identidade configurada.
  const revisaoSolicitada = Boolean(revisao && new URLSearchParams(window.location.search).get('valeria') === 'apresentacao');
  const chave = `${chaveVersao}:${identidade}:${caminho}${revisao ? `:revisao:${revisao}` : ''}`;
  useEffect(() => {
    if (import.meta.env.VITE_VALERIA_LANCAMENTO_ENABLED !== 'true' || (leu(chave) && !revisaoSolicitada)) return;
    const controller = new AbortController();
    api.get<{ textoDisponivel: boolean; vozDisponivel: boolean }>(`${caminho}/status`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted && (data.textoDisponivel || data.vozDisponivel)) setMostrar(true);
      }).catch(() => { /* Falha de disponibilidade não bloqueia a página. */ });
    return () => controller.abort();
  }, [api, caminho, chave, revisaoSolicitada]);
  useEffect(() => {
    if (mostrar && !chatAberto && (!leu(chave) || revisaoSolicitada)) {
      modal.current?.showModal();
      // Não reapresentar a cada navegação, mesmo se ela desmontar o modal.
      marcar(chave);
    }
  }, [mostrar, chatAberto, chave, revisaoSolicitada]);
  useEffect(() => { if (chatAberto) setDica(false); }, [chatAberto]);
  useEffect(() => {
    if (!dica) return;
    const dispensar = (e: KeyboardEvent) => { if (e.key === 'Escape') setDica(false); };
    window.addEventListener('keydown', dispensar);
    return () => window.removeEventListener('keydown', dispensar);
  }, [dica]);
  function fechar() { modal.current?.close(); }
  return <>
    <dialog ref={modal} className="valeria-lancamento" aria-label="Conheça a Valéria"
      onCancel={e => { e.preventDefault(); fechar(); }}
      onClose={() => { setMostrar(false); setDica(true); botao.current?.focus(); }}>
      <button className="valeria-lancamento-fechar" type="button" autoFocus aria-label="Fechar apresentação da Valéria" onClick={fechar}><X size={24} /></button>
      <img src={arte} alt="Valéria, assistente do Valen Barber. Mais praticidade para cuidar da sua barbearia." />
    </dialog>
    {dica && !chatAberto && <div className="valeria-dica" role="region" aria-label="Dica da Valéria">
      <button type="button" className="valeria-dica-abrir" onClick={() => { setDica(false); abrirChat(); }}>Fale com a Valéria aqui</button>
      <button type="button" aria-label="Dispensar dica da Valéria" onClick={() => setDica(false)}><X size={20} /></button>
      <span className="valeria-dica-seta" aria-hidden="true" />
    </div>}
  </>;
}
