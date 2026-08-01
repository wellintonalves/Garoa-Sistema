// Aba Fidelidade — pontos, progresso e histórico
import { useState, useEffect } from 'react';
import { useParams, useOutletContext } from 'react-router-dom';
import { Gift, CheckCircle, Clock, ShareNetwork, Copy } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';
import { EstadoVazio } from '../../../components/ui/EstadoVazio';
import { ModalAlert } from '../../../components/ModalAlert';

interface FidelidadeData {
  saldo: number;
  totalGanhos: number;
  totalUsados: number;
  config: { ativo: boolean; pontosPorIndicacao: number; pontosParaIndicado: number; };
  recompensas: Array<{ 
    id: string; 
    nome: string; 
    pontosNecessarios: number; 
    tipo: string; 
    valorDesconto?: number; 
    servico?: { nome: string } 
  }>;
  historico: Array<{ id: string; tipo: 'GANHO' | 'RESGATE'; status?: string; pontos: number; descricao: string; data: string }>;
}

export function ClienteBarbeariaFidelidade() {
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const [dados, setDados] = useState<FidelidadeData | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [modalObj, setModalObj] = useState<{aberto: boolean; titulo: string; mensagem: string; tipo: 'erro'|'sucesso'|'aviso'|'info'; isConfirm?: boolean, onConfirm?: () => void, textoBotao?: string}>({ aberto: false, titulo: '', mensagem: '', tipo: 'info' });
  const [codigoIndicacao, setCodigoIndicacao] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const { barbearia } = useOutletContext<{ barbearia: any }>();

  useEffect(() => {
    carregarFidelidade();
    clienteApi.get('/cliente/meu-codigo-indicacao')
      .then(res => setCodigoIndicacao(res.data.codigo))
      .catch(() => {});
  }, [barbeariaId]);

  function carregarFidelidade() {
    if (barbeariaId) {
      setCarregando(true);
      clienteApi.get<FidelidadeData>(`/cliente/barbearia/${barbeariaId}/fidelidade`)
        .then(res => setDados(res.data))
        .catch(() => { /* empty */ })
        .finally(() => setCarregando(false));
    }
  }

  async function handleCopiarCodigo() {
    if (!codigoIndicacao || !barbearia?.slug) return;
    const urlPublica = import.meta.env.VITE_URL_PUBLICA || window.location.origin;
    const texto = `${urlPublica}/convite/${barbearia.slug}/${codigoIndicacao}`;

    const fallbackCopy = () => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = texto;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
      } catch (err) {
        return false;
      }
    };

    let sucesso = false;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        sucesso = true;
      } else {
        sucesso = fallbackCopy();
      }
    } catch (err) {
      sucesso = fallbackCopy();
    }

    if (sucesso) {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } else {
      setModalObj({
        aberto: true,
        titulo: 'Copiar link',
        mensagem: 'Não foi possível copiar automaticamente.',
        tipo: 'erro',
        textoBotao: 'Entendi'
      });
    }
  }

  function compartilharCodigo() {
    if (!codigoIndicacao || !barbearia?.slug) return;
    const urlPublica = import.meta.env.VITE_URL_PUBLICA || window.location.origin;
    const url = `${urlPublica}/convite/${barbearia.slug}/${codigoIndicacao}`;
    if (navigator.share) {
      navigator.share({
        title: 'Convite para Barbearia',
        text: `Ganhe pontos e prêmios na nossa barbearia!`,
        url: url,
      }).catch((err) => {
        console.log('Erro ao compartilhar', err);
      });
    }
  }

  async function resgatar(recompensaId: string) {
    setModalObj({
      aberto: true,
      titulo: 'Confirmar resgate',
      mensagem: 'Deseja realmente resgatar esta recompensa?',
      tipo: 'aviso',
      isConfirm: true,
      textoBotao: 'Resgatar',
      onConfirm: async () => {
        setResgatando(recompensaId);
        try {
          await clienteApi.post(`/cliente/barbearia/${barbeariaId}/fidelidade/resgatar`, { recompensaId });
          setModalObj({ aberto: true, titulo: 'Sucesso', mensagem: 'Solicitação enviada! Confirme no caixa na sua próxima visita.', tipo: 'sucesso', textoBotao: 'Entendi' });
          carregarFidelidade();
        } catch (error: any) {
          setModalObj({ aberto: true, titulo: 'Erro', mensagem: error.response?.data?.erro || 'Erro ao resgatar recompensa.', tipo: 'erro', textoBotao: 'Entendi' });
        } finally {
          setResgatando(null);
        }
      }
    });
  }

  if (carregando) {
    return (
      <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto flex flex-col gap-6">
        <SkeletonText lines={2} style={{ width: '50%' }} />
        <SkeletonCard style={{ height: '180px', width: '100%', borderRadius: '12px' }} />
        <SkeletonCard style={{ height: '100px', width: '100%' }} />
        <div className="flex flex-col gap-3">
          <SkeletonCard style={{ height: '70px', width: '100%' }} />
          <SkeletonCard style={{ height: '70px', width: '100%' }} />
        </div>
      </div>
    );
  }

  if (!dados || !dados.config?.ativo) {
    return (
      <div className="px-5 py-12 animate-fade-in max-w-2xl mx-auto">
        <EstadoVazio
          icone={<Gift size={48} />}
          titulo="Programa Indisponível"
          descricao="Esta barbearia não possui o programa de fidelidade ativo no momento."
        />
      </div>
    );
  }

  const proximas = [...dados.recompensas].sort((a,b) => a.pontosNecessarios - b.pontosNecessarios).filter(r => r.pontosNecessarios > dados.saldo);
  const proxima = proximas.length > 0 ? proximas[0] : null;
  const maxPontos = proxima ? proxima.pontosNecessarios : (dados.recompensas.length > 0 ? Math.max(...dados.recompensas.map(r => r.pontosNecessarios)) : 100);
  const progresso = Math.min((dados.saldo / maxPontos) * 100, 100);

  const raio = 70;
  const circunferencia = 2 * Math.PI * raio;
  const dashoffset = circunferencia - (progresso / 100) * circunferencia;

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto pb-32 md:pb-16">
      <div className="mb-8">
        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Seus Pontos
        </h1>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
          Acompanhe seu progresso e resgate prêmios exclusivos.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center mb-10 p-6 rounded-xl bg-[var(--fundo-sidebar)] border border-[var(--borda)] shadow-sm">
        <div className="relative flex items-center justify-center mb-4">
          <svg className="transform -rotate-90" width="180" height="180">
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--superficie-2)"
              strokeWidth="10"
            />
            <circle
              cx="90" cy="90" r={raio}
              fill="transparent"
              stroke="var(--amber)"
              strokeWidth="10"
              strokeDasharray={circunferencia}
              strokeDashoffset={dashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: 'drop-shadow(0 0 6px rgba(var(--cor-primaria-rgb), 0.4))' }}
            />
          </svg>
          
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span style={{ fontFamily: 'var(--fonte-mono)', fontSize: '42px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {dados.saldo}
            </span>
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--amber)', marginTop: '4px', fontWeight: 600 }}>
              pontos
            </span>
          </div>
        </div>
        
        {proxima ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--texto-secundario)', textAlign: 'center' }}>
            Faltam <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--fonte-mono)' }}>{proxima.pontosNecessarios - dados.saldo} pts</span> para o prêmio: 
            <span style={{ color: 'var(--amber)', fontWeight: 600 }}> {proxima.nome}</span>
          </p>
        ) : dados.recompensas.length > 0 ? (
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--amber)', fontWeight: 600, textAlign: 'center' }}>
            Você já tem pontos suficientes para resgatar qualquer recompensa!
          </p>
        ) : null}
      </div>

      <div className="mb-10">
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', marginBottom: '16px', fontWeight: 600 }}>
          Prêmios Disponíveis
        </h2>
        {dados.recompensas.length === 0 ? (
          <EstadoVazio
            icone={<Gift size={36} />}
            titulo="Nenhum prêmio disponível"
            descricao="Novas recompensas serão adicionadas em breve."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {dados.recompensas.sort((a,b) => a.pontosNecessarios - b.pontosNecessarios).map(rec => {
              const podeResgatar = dados.saldo >= rec.pontosNecessarios;
              return (
                <div key={rec.id} className="p-4 rounded-md flex items-center justify-between transition-all" style={{
                  background: 'var(--fundo-sidebar)',
                  border: podeResgatar ? '1px solid var(--amber)' : '1px solid var(--borda)',
                }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{rec.nome}</h3>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--fonte-mono)', fontWeight: 700, color: podeResgatar ? 'var(--amber)' : 'var(--texto-secundario)' }}>{rec.pontosNecessarios} pts</span> • {rec.tipo === 'SERVICO_GRATIS' ? `Serviço: ${rec.servico?.nome}` : (rec.tipo === 'DESCONTO_PERCENTUAL' ? `Desc. ${rec.valorDesconto}%` : `Desc. R$${rec.valorDesconto}`)}
                    </p>
                  </div>
                  
                  {podeResgatar ? (
                    <button 
                      onClick={() => resgatar(rec.id)}
                      disabled={resgatando === rec.id}
                      className="btn-primary"
                      style={{ padding: '8px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}
                    >
                      {resgatando === rec.id ? 'Aguarde' : 'Resgatar'}
                    </button>
                  ) : (
                    <div className="px-3 py-1.5 rounded bg-[var(--superficie-1)] border border-[var(--borda)]" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-disabled)', fontWeight: 600 }}>
                      Bloqueado
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {codigoIndicacao && (
        <div className="mb-10 p-5 rounded-xl" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <div className="flex items-center gap-2 mb-2">
            <ShareNetwork size={18} style={{ color: 'var(--amber)' }} weight="bold" />
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
              Indique amigos
            </h2>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '16px' }}>
            {dados.config.pontosPorIndicacao > 0 ? (
              <>
                Convide amigos e ganhe <strong>{dados.config.pontosPorIndicacao} pontos</strong> por amigo que concluir o 1º agendamento.
                {dados.config.pontosParaIndicado > 0 && ` Seu amigo também ganha ${dados.config.pontosParaIndicado} pontos ao se cadastrar!`}
              </>
            ) : (
              "Convide amigos para a barbearia. Compartilhe seu código exclusivo."
            )}
          </p>
          
          <div className="mb-4">
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--texto-secundario)', marginBottom: '6px', fontWeight: 600 }}>
              Seu código de indicação (para ditar):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <strong style={{ fontSize: '16px', letterSpacing: '0.05em', color: 'var(--text-primary)', fontFamily: 'var(--fonte-interface)' }}>{codigoIndicacao}</strong>
            </div>
          </div>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              readOnly
              value={`${import.meta.env.VITE_URL_PUBLICA || window.location.origin}/convite/${barbearia?.slug || ''}/${codigoIndicacao || ''}`}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--borda)', background: 'var(--fundo-superficie)', color: 'var(--text-primary)', fontSize: '13px' }}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopiarCodigo} className="flex-1 flex items-center justify-center gap-2 rounded-lg font-interface font-semibold text-xs px-4 py-3 transition-all duration-200" style={{
              background: copiado ? 'var(--sucesso-fundo)' : 'rgba(var(--cor-primaria-rgb), 0.15)',
              border: `1px solid ${copiado ? 'var(--sucesso)' : 'var(--amber)'}`,
              color: copiado ? 'var(--sucesso)' : 'var(--amber)',
            }}>
              {copiado ? <CheckCircle size={18} weight="fill" /> : <Copy size={18} />}
              {copiado ? 'Copiado!' : 'Copiar Link'}
            </button>
            {typeof navigator.share === 'function' && (
              <button onClick={compartilharCodigo} className="flex-1 flex items-center justify-center gap-2 rounded-lg font-interface font-semibold text-xs px-4 py-3 transition-all duration-200" style={{
                background: 'var(--amber)',
                color: 'var(--fundo)',
                border: '1px solid var(--amber)'
              }}>
                <ShareNetwork size={18} />
                Compartilhar
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', marginBottom: '20px', fontWeight: 600 }}>
          Histórico
        </h2>
        {dados.historico.length === 0 ? (
          <EstadoVazio
            icone={<Clock size={36} />}
            titulo="Nenhum histórico"
            descricao="Suas movimentações de pontos aparecerão aqui após seus agendamentos."
          />
        ) : (
          <div className="relative ml-3 border-l border-[var(--borda)] pl-6 flex flex-col gap-6">
            {dados.historico.map(h => (
              <div key={h.id} className="relative">
                <div className="absolute -left-[30px] top-[2px] w-3 h-3 rounded-full" 
                     style={{ background: h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--superficie-2)', border: h.tipo === 'GANHO' ? 'none' : '2px solid var(--texto-secundario)' }} />
                
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {h.descricao}
                      {h.tipo === 'RESGATE' && h.status && (
                        <span style={{ 
                          marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600,
                          background: h.status === 'CONFIRMADO' ? 'var(--sucesso-fundo)' : h.status === 'PENDENTE' ? 'rgba(var(--cor-primaria-rgb), 0.1)' : 'var(--perigo-fundo)',
                          color: h.status === 'CONFIRMADO' ? 'var(--sucesso)' : h.status === 'PENDENTE' ? 'var(--cor-primaria)' : 'var(--perigo)'
                        }}>
                          {h.status}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1" style={{ color: 'var(--texto-secundario)' }}>
                      <Clock size={12} />
                      <p style={{ fontFamily: 'var(--fonte-mono)', fontSize: '11px' }}>
                        {new Date(h.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <span style={{ 
                    fontFamily: 'var(--fonte-mono)', fontSize: '15px', fontWeight: 700, 
                    color: h.status === 'CANCELADO' ? 'var(--text-disabled)' : h.tipo === 'GANHO' ? 'var(--amber)' : 'var(--text-primary)',
                    textDecoration: h.status === 'CANCELADO' ? 'line-through' : 'none'
                  }}>
                    {h.tipo === 'GANHO' ? '+' : ''}{h.pontos}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalAlert 
        aberto={modalObj.aberto} 
        titulo={modalObj.titulo} 
        mensagem={modalObj.mensagem} 
        tipo={modalObj.tipo} 
        isConfirm={modalObj.isConfirm}
        textoBotao={modalObj.textoBotao || 'Entendi'}
        onConfirmar={modalObj.onConfirm}
        onFechar={() => {
          setModalObj(m => ({ ...m, aberto: false }));
        }} 
      />
    </div>
  );
}
