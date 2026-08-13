import { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import api from '../api/client';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';

interface ModalConcluirServicoProps {
  aberto: boolean;
  onFechar: () => void;
  agendamento: {
    id: string;
    valorCobrado: string;
    servico: {
      nome: string;
    };
    cliente: {
      id: string;
      usuario: {
        nome: string;
      };
    };
  } | null;
  onConfirmar: (dados: {
    status: 'CONCLUIDO';
    formaPagamento: string;
    tipoDesconto: 'NENHUM' | 'REAIS' | 'PERCENTUAL' | 'PONTOS' | 'COMBINADO';
    pontosUsados?: number;
    descontoPercentual?: number;
    descontoReais?: number;
  }) => Promise<void>;
  fidelidadeCache?: any;
}

const FORMAS_PAGAMENTO = [
  { value: 'PIX', label: 'Pix' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Débito' },
  { value: 'CARTAO_CREDITO', label: 'Crédito' },
];

export function ModalConcluirServico({ aberto, onFechar, agendamento, onConfirmar, fidelidadeCache }: ModalConcluirServicoProps) {
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  
  // States do desconto
  const [tipoManual, setTipoManual] = useState<'NENHUM' | 'REAIS' | 'PERCENTUAL' | 'PONTOS'>('NENHUM');
  const [valorDescontoManual, setValorDescontoManual] = useState('');
  const [pontosUsados, setPontosUsados] = useState('');
  
  const pontosUsadosRef = useRef(pontosUsados);
  useEffect(() => { pontosUsadosRef.current = pontosUsados; }, [pontosUsados]);

  // State da fidelidade
  const [fidelidade, setFidelidade] = useState<{
    saldoPontos: number;
    valorPorPonto: number;
    percentualMaxPontos: number;
    resgatePontosAtivo: boolean;
    permitirCombinarDescontos: boolean;
    descontoMaxReais: number;
    descontoMaxPercentual: number;
    maxPontosUtilizaveis: number;
    limitador: 'SALDO' | 'TETO';
    tetoReais: number;
  } | null>(fidelidadeCache || null);

  // State da simulação
  const [simulacao, setSimulacao] = useState<{
    valorBruto: number;
    descontoManual: number;
    descontoPontos: number;
    valorLiquido: number;
  } | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroDesconto, setErroDesconto] = useState<string | null>(null);

  // Carregar saldo do cliente quando abre o modal
  useEffect(() => {
    if (aberto && agendamento) {
      setFormaPagamento('PIX');
      setTipoManual('NENHUM');
      setValorDescontoManual('');
      setPontosUsados('');
      setErro(null);
      setSimulacao(null);
      setFidelidade(fidelidadeCache || null);
      
      api.get(`/fidelidade/clientes/${agendamento.cliente.id}/saldo?valorServico=${agendamento.valorCobrado}`)
        .then(res => {
          setFidelidade(res.data);
          if (pontosUsadosRef.current && Number(pontosUsadosRef.current) > res.data.maxPontosUtilizaveis) {
            setPontosUsados(String(res.data.maxPontosUtilizaveis));
            setErroDesconto(`O saldo foi atualizado. O máximo de pontos foi corrigido para ${res.data.maxPontosUtilizaveis}.`);
          }
        })
        .catch(err => console.error('Erro ao buscar saldo:', err));
    }
  }, [aberto, agendamento]);

  // Simulação instantânea no frontend
  useEffect(() => {
    if (!aberto || !agendamento) return;

    setErro(null);

    const valorBruto = Number(agendamento.valorCobrado || 0);
    const taxa = fidelidade ? Number((fidelidade as any).taxaConversaoPontos || fidelidade.valorPorPonto) : 1;
    
    // 1. Desconto Manual
    let descontoManualFinal = 0;
    if (tipoManual === 'REAIS') {
      descontoManualFinal = Number(valorDescontoManual) || 0;
    } else if (tipoManual === 'PERCENTUAL') {
      const perc = Number(valorDescontoManual) || 0;
      descontoManualFinal = valorBruto * (perc / 100);
    }
    
    // 2. Desconto Fidelidade
    const maxPontos = fidelidade ? Number(fidelidade.maxPontosUtilizaveis) : 0;
    const pts = Math.min(Number(pontosUsados) || 0, maxPontos);
    const descontoPontos = pts * taxa;

    const totalDesconto = descontoManualFinal + descontoPontos;
    const valorLiquido = valorBruto - totalDesconto;

    if (totalDesconto > valorBruto) {
      const msg = 'O desconto não pode ser maior que o valor bruto.';
      setErroDesconto(msg);
      setErro(msg);
    } else {
      setErroDesconto(null);
    }

    setSimulacao({
      valorBruto,
      descontoManual: descontoManualFinal,
      descontoPontos,
      valorLiquido,
    });
  }, [tipoManual, valorDescontoManual, pontosUsados, aberto, agendamento, fidelidade]);

  const obterTipoGeral = (): 'NENHUM' | 'REAIS' | 'PERCENTUAL' | 'PONTOS' | 'COMBINADO' => {
    const temManual = tipoManual !== 'NENHUM' && Number(valorDescontoManual) > 0;
    const temPontos = Number(pontosUsados) > 0;
    if (temManual && temPontos) return 'COMBINADO';
    if (temPontos) return 'PONTOS';
    if (temManual) return tipoManual;
    return 'NENHUM';
  };

  const handleSubmit = async () => {
    if (erro || !simulacao) return;
    setSalvando(true);
    setErro(null);
    try {
      const tipo = obterTipoGeral();
      await onConfirmar({
        status: 'CONCLUIDO',
        formaPagamento,
        tipoDesconto: tipo,
        descontoReais: tipoManual === 'REAIS' ? Number(valorDescontoManual) : undefined,
        descontoPercentual: tipoManual === 'PERCENTUAL' ? Number(valorDescontoManual) : undefined,
        pontosUsados: Number(pontosUsados) || undefined,
      });
      onFechar();
    } catch (err: any) {
      setErro(err.response?.data?.erro || err.message || 'Erro ao concluir o agendamento');
    } finally {
      setSalvando(false);
    }
  };

  if (!agendamento) return null;

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Concluir Serviço">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="flex flex-col gap-1 text-sm text-[var(--text-primary)]">
          <p><strong className="text-[var(--texto-secundario)]">Serviço:</strong> {agendamento.servico.nome}</p>
          <p><strong className="text-[var(--texto-secundario)]">Cliente:</strong> {agendamento.cliente.usuario.nome}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--texto-secundario)] mb-2 block">Forma de pagamento</label>
          <div className="flex flex-wrap gap-2">
            {FORMAS_PAGAMENTO.map(forma => (
              <button
                key={forma.value}
                onClick={() => setFormaPagamento(forma.value)}
                className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border ${
                  formaPagamento === forma.value 
                  ? 'bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] border-[var(--cor-primaria)]' 
                  : 'bg-transparent text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--bg-surface2)]'
                }`}
              >
                {forma.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--texto-secundario)] mb-2 block">Desconto</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex flex-wrap gap-1 sm:flex-nowrap" style={{ flexShrink: 0 }}>
              {[
                { value: 'NENHUM', label: 'Nenhum' },
                { value: 'REAIS', label: 'R$' },
                { value: 'PERCENTUAL', label: '%' },
                { value: 'PONTOS', label: 'Pontos' },
              ].map(tipo => {
                const isPontos = tipo.value === 'PONTOS';
                const isLoading = isPontos && !fidelidade && !erro;
                const isDisabled = isPontos && (
                  isLoading || 
                  !!erro || 
                  (fidelidade && (!fidelidade.resgatePontosAtivo || fidelidade.saldoPontos === 0))
                );

                return (
                  <button
                    key={tipo.value}
                    type="button"
                    onClick={() => {
                      setTipoManual(tipo.value as any);
                      if (tipo.value === 'NENHUM') {
                        setValorDescontoManual('');
                        setPontosUsados('');
                      } else if (tipo.value === 'PONTOS') {
                        setValorDescontoManual('');
                      } else {
                        setPontosUsados('');
                      }
                    }}
                    disabled={!!isDisabled}
                    title={
                      isPontos
                        ? isLoading 
                          ? 'Carregando saldo...'
                          : erro 
                            ? 'Erro ao carregar fidelidade'
                            : (fidelidade && !fidelidade.resgatePontosAtivo) 
                              ? 'Fidelidade desativada'
                              : (fidelidade && fidelidade.saldoPontos === 0) 
                                ? 'Cliente sem saldo' 
                                : ''
                        : ''
                    }
                    className={`px-3 py-2 rounded-md text-xs font-medium transition-colors border disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ${
                      tipoManual === tipo.value 
                      ? 'bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] border-[var(--cor-primaria)]' 
                      : 'bg-transparent text-[var(--text-primary)] border-[var(--border)] hover:bg-[var(--bg-surface2)]'
                    }`}
                  >
                    {isLoading && <CircleNotch className="animate-spin" size={14} />}
                    {tipo.label}
                  </button>
                );
              })}
            </div>
            
            {tipoManual === 'PONTOS' ? (
              <div className="flex flex-col flex-1 gap-1">
                <div className="flex flex-1 gap-2">
                  <input 
                    type="number" 
                    min="0"
                    max={fidelidade?.maxPontosUtilizaveis || 0}
                    placeholder="Qtd. pontos" 
                    value={pontosUsados} 
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) {
                        setPontosUsados(val);
                        return;
                      }
                      const max = fidelidade?.maxPontosUtilizaveis || 0;
                      let p = Number(val);
                      if (p > max) {
                        setPontosUsados(String(max));
                      } else {
                        setPontosUsados(val);
                      }
                    }} 
                    onBlur={() => {
                      if (!pontosUsados) return;
                      let p = Math.floor(Number(pontosUsados) || 0);
                      if (p < 0) p = 0;
                      const max = fidelidade?.maxPontosUtilizaveis || 0;
                      if (p > max) p = max;
                      setPontosUsados(String(p));
                    }}
                    className={`ds-input flex-1 min-w-0 ${erroDesconto ? 'border-[var(--erro)] focus:border-[var(--erro)] focus:ring-[var(--erro)]' : ''}`}
                  />
                  <button 
                    onClick={() => setPontosUsados(String(fidelidade?.maxPontosUtilizaveis || 0))}
                    className="px-3 py-2 bg-[var(--bg-surface2)] border border-[var(--border)] rounded-md text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors whitespace-nowrap"
                    type="button"
                  >
                    Máximo
                  </button>
                </div>
                {erroDesconto && <p className="text-xs text-[var(--erro)] mt-1">{erroDesconto}</p>}
              </div>
            ) : (
              <div className="flex flex-col flex-1 gap-1">
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  placeholder={tipoManual === 'NENHUM' ? '---' : 'Ex: 10'} 
                  value={valorDescontoManual} 
                  onChange={e => {
                    const val = e.target.value;
                    if (!val) {
                      setValorDescontoManual(val);
                      return;
                    }
                    let v = Number(val);
                    if (tipoManual === 'PERCENTUAL' && v > 100) {
                      setValorDescontoManual('100');
                    } else {
                      setValorDescontoManual(val);
                    }
                  }} 
                  onBlur={() => {
                    if (!valorDescontoManual) return;
                    let v = Number(valorDescontoManual) || 0;
                    if (v < 0) v = 0;
                    if (tipoManual === 'PERCENTUAL' && v > 100) v = 100;
                    setValorDescontoManual(String(v));
                  }}
                  className={`ds-input flex-1 min-w-0 ${erroDesconto ? 'border-[var(--erro)] focus:border-[var(--erro)] focus:ring-[var(--erro)]' : ''}`}
                  disabled={tipoManual === 'NENHUM'}
                />
                {erroDesconto && <p className="text-xs text-[var(--erro)] mt-1">{erroDesconto}</p>}
              </div>
            )}
          </div>
          
          {tipoManual === 'PONTOS' && (
            <div className="flex flex-col gap-1 mt-2">
              <p className="text-xs text-[var(--texto-secundario)]">Saldo do cliente: <strong className="text-[var(--text-primary)]">{fidelidade?.saldoPontos || 0} pts</strong></p>
              {fidelidade && (
                <p className="text-xs text-[var(--perigo)]">
                  {fidelidade.limitador === 'TETO' 
                    ? `Limite de ${fidelidade.percentualMaxPontos}% do serviço: máximo ${fidelidade.maxPontosUtilizaveis} pontos` 
                    : `Limitado pelo saldo do cliente: máximo ${fidelidade.maxPontosUtilizaveis} pontos`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="bg-[var(--bg-surface2)] p-4 rounded-lg mt-2 font-mono text-sm border border-[var(--border)] relative overflow-hidden">
          
          <div className="flex justify-between text-[var(--text-primary)] mb-1">
            <span>Valor bruto:</span>
            <span className="tabular-nums">R$ {simulacao ? simulacao.valorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Number(agendamento.valorCobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
          
          {simulacao && simulacao.descontoManual > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto manual:</span>
              <span className="tabular-nums">- R$ {simulacao.descontoManual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          {simulacao && simulacao.descontoPontos > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto com pontos:</span>
              <span className="tabular-nums">- R$ {simulacao.descontoPontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
          
          <div className="flex justify-between font-bold text-lg text-[var(--text-primary)] mt-2 pt-2 border-t border-[var(--border)]">
            <span>Total a cobrar:</span>
            <span className="tabular-nums">R$ {simulacao ? simulacao.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Number(agendamento.valorCobrado).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {erro && !erroDesconto && (
          <div style={{ padding: '12px', background: 'var(--erro-fundo)', border: '1px solid var(--erro)', borderRadius: '6px', color: 'var(--erro)', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarningCircle size={16} /> {erro}
          </div>
        )}

        <button 
          onClick={handleSubmit} 
          className="w-full min-h-[48px] flex items-center justify-center gap-2 rounded-md font-semibold text-sm transition-opacity"
          style={{ 
            background: 'var(--cor-primaria)', 
            color: 'var(--texto-sobre-primaria)',
            opacity: (salvando || erro) ? 0.6 : 1,
            pointerEvents: (salvando || erro) ? 'none' : 'auto'
          }}
        >
          {salvando ? (
            <>
              <CircleNotch className="animate-spin" size={20} />
              <span>Concluindo...</span>
            </>
          ) : (
            'Confirmar Pagamento'
          )}
        </button>
      </div>
    </Modal>
  );
}
