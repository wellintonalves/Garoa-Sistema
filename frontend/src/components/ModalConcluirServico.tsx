import { useState, useEffect } from 'react';
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
}

const FORMAS_PAGAMENTO = [
  { value: 'PIX', label: 'Pix' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_DEBITO', label: 'Débito' },
  { value: 'CARTAO_CREDITO', label: 'Crédito' },
];

export function ModalConcluirServico({ aberto, onFechar, agendamento, onConfirmar }: ModalConcluirServicoProps) {
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  
  // States do desconto
  const [tipoManual, setTipoManual] = useState<'NENHUM' | 'REAIS' | 'PERCENTUAL'>('NENHUM');
  const [valorDescontoManual, setValorDescontoManual] = useState('');
  const [pontosUsados, setPontosUsados] = useState('');
  
  // State da fidelidade
  const [fidelidade, setFidelidade] = useState<{
    saldoPontos: number;
    valorPorPonto: number;
    percentualMaxPontos: number;
    resgatePontosAtivo: boolean;
    permitirCombinarDescontos: boolean;
    descontoMaxReais: number;
    descontoMaxPercentual: number;
  } | null>(null);

  // State da simulação
  const [simulacao, setSimulacao] = useState<{
    valorBruto: number;
    descontoManual: number;
    descontoPontos: number;
    valorLiquido: number;
    maxPontosUtilizaveis: number;
  } | null>(null);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Carregar saldo do cliente quando abre o modal
  useEffect(() => {
    if (aberto && agendamento) {
      setFormaPagamento('PIX');
      setTipoManual('NENHUM');
      setValorDescontoManual('');
      setPontosUsados('');
      setErro(null);
      setSimulacao(null);
      setFidelidade(null);
      
      api.get(`/fidelidade/clientes/${agendamento.cliente.id}/saldo`)
        .then(res => setFidelidade(res.data))
        .catch(err => console.error('Erro ao buscar saldo:', err));
    }
  }, [aberto, agendamento]);

  // Simulação instantânea no frontend
  useEffect(() => {
    if (!aberto || !agendamento) return;

    setErro(null);

    const valorBruto = Number(agendamento.valorCobrado || 0);
    const taxa = fidelidade ? Number((fidelidade as any).taxaConversaoPontos || fidelidade.valorPorPonto) : 1;
    const saldoPontos = fidelidade ? Number(fidelidade.saldoPontos) : 0;
    
    // 1. Desconto Manual
    let descontoManualFinal = 0;
    if (tipoManual === 'REAIS') {
      descontoManualFinal = Number(valorDescontoManual) || 0;
    } else if (tipoManual === 'PERCENTUAL') {
      const perc = Number(valorDescontoManual) || 0;
      descontoManualFinal = valorBruto * (perc / 100);
    }
    
    // Calcula maxPontos baseado no que sobrou pra abater
    const valorRestante = valorBruto - descontoManualFinal;
    const maxPontosConvertiveis = Math.max(0, Math.floor(valorRestante / taxa));
    const maxPontos = Math.min(saldoPontos, maxPontosConvertiveis);
    
    // 2. Desconto Fidelidade
    const pts = Math.min(Number(pontosUsados) || 0, maxPontos);
    const descontoPontos = pts * taxa;

    let totalDesconto = descontoManualFinal + descontoPontos;
    if (totalDesconto > valorBruto) {
      totalDesconto = valorBruto;
    }

    const valorLiquido = Math.max(0, valorBruto - totalDesconto);

    setSimulacao({
      valorBruto,
      descontoManual: descontoManualFinal,
      descontoPontos,
      valorLiquido,
      maxPontosUtilizaveis: maxPontos,
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
        {erro && (
          <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--perigo)', borderRadius: '6px', color: 'var(--perigo)', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <WarningCircle size={16} /> {erro}
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm text-[var(--text-primary)]">
          <p><strong className="text-[var(--texto-secundario)]">Serviço:</strong> {agendamento.servico.nome}</p>
          <p><strong className="text-[var(--texto-secundario)]">Cliente:</strong> {agendamento.cliente.usuario.nome}</p>
        </div>

        <div>
          <label className="text-xs font-semibold text-[var(--texto-secundario)] uppercase tracking-wider mb-2 block">Forma de Pagamento</label>
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
          <label className="text-xs font-semibold text-[var(--texto-secundario)] uppercase tracking-wider mb-2 block">Desconto Manual</label>
          <div className="flex gap-2">
            <select 
              value={tipoManual} 
              onChange={(e) => {
                setTipoManual(e.target.value as any);
                if (e.target.value === 'NENHUM') setValorDescontoManual('');
              }} 
              className="ds-select"
              style={{ width: '110px', flexShrink: 0 }}
            >
              <option value="NENHUM">Nenhum</option>
              <option value="REAIS">R$</option>
              <option value="PERCENTUAL">%</option>
            </select>
            <input 
              type="number" 
              min="0"
              step="any"
              placeholder={tipoManual === 'NENHUM' ? '---' : 'Ex: 10'} 
              value={valorDescontoManual} 
              onChange={e => setValorDescontoManual(e.target.value)} 
              className="ds-input flex-1"
              disabled={tipoManual === 'NENHUM'}
            />
          </div>
        </div>

        {fidelidade?.resgatePontosAtivo && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <label className="text-xs font-semibold text-[var(--texto-secundario)] uppercase tracking-wider mb-2 block">Resgatar Pontos</label>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-[var(--texto-secundario)]">Saldo: <strong className="text-[var(--text-primary)]">{fidelidade.saldoPontos} pts</strong></p>
              {simulacao && (
                <p className="text-xs text-[var(--texto-secundario)]">
                  Máximo: {simulacao.maxPontosUtilizaveis} pts
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <input 
                type="number" 
                min="0"
                max={simulacao?.maxPontosUtilizaveis || fidelidade.saldoPontos}
                placeholder="Qtd. de pontos a resgatar" 
                value={pontosUsados} 
                onChange={e => setPontosUsados(e.target.value)} 
                className="ds-input w-full"
              />
              <button 
                onClick={() => setPontosUsados(String(simulacao?.maxPontosUtilizaveis || fidelidade.saldoPontos))}
                className="px-3 py-2 bg-[var(--bg-surface2)] border border-[var(--border)] rounded-md text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
                type="button"
              >
                Máx
              </button>
            </div>
            {!fidelidade.permitirCombinarDescontos && tipoManual !== 'NENHUM' && Number(valorDescontoManual) > 0 && (
              <p className="text-xs text-[var(--perigo)] mt-2">Atenção: A configuração não permite combinar desconto manual com pontos.</p>
            )}
          </div>
        )}

        <div className="bg-[var(--bg-surface2)] p-4 rounded-lg mt-2 font-mono text-sm border border-[var(--border)] relative overflow-hidden">
          

          <div className="flex justify-between text-[var(--text-primary)] mb-1">
            <span>Valor Bruto:</span>
            <span>R$ {simulacao ? simulacao.valorBruto.toFixed(2) : Number(agendamento.valorCobrado).toFixed(2)}</span>
          </div>
          
          {simulacao && simulacao.descontoManual > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto (Manual):</span>
              <span>- R$ {simulacao.descontoManual.toFixed(2)}</span>
            </div>
          )}
          
          {simulacao && simulacao.descontoPontos > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto (Pontos):</span>
              <span>- R$ {simulacao.descontoPontos.toFixed(2)}</span>
            </div>
          )}
          
          <div className="flex justify-between font-bold text-lg text-[var(--text-primary)] mt-2 pt-2 border-t border-[var(--border)]">
            <span>Total a Cobrar:</span>
            <span>R$ {simulacao ? simulacao.valorLiquido.toFixed(2) : Number(agendamento.valorCobrado).toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={handleSubmit} 
          className="w-full mt-2 min-h-[48px] flex items-center justify-center gap-2 rounded-md font-semibold text-sm transition-opacity"
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
