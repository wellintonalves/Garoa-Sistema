import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import api from '../api/client';
import { CircleNotch } from '@phosphor-icons/react';

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
    valorCobrado: number;
    pontosUsados: number;
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
  const [tipoDesconto, setTipoDesconto] = useState<'REAIS' | 'PERCENTUAL'>('REAIS');
  const [valorDesconto, setValorDesconto] = useState('');
  const [pontosUsados, setPontosUsados] = useState('');
  const [saldoPontos, setSaldoPontos] = useState(0);
  const [valorPorPonto, setValorPorPonto] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (aberto && agendamento) {
      setFormaPagamento('PIX');
      setTipoDesconto('REAIS');
      setValorDesconto('');
      setPontosUsados('');
      setErro(null);
      
      // Buscar saldo de pontos do cliente e valor por ponto
      api.get(`/clientes/${agendamento.cliente.id}/fidelidade`)
        .then(res => {
          setSaldoPontos(res.data.saldoPontos || 0);
          setValorPorPonto(res.data.valorPorPonto ? Number(res.data.valorPorPonto) : 0);
        })
        .catch(err => console.error('Erro ao buscar pontos do cliente:', err));
    }
  }, [aberto, agendamento]);

  if (!agendamento) return null;

  const valorOriginal = Number(agendamento.valorCobrado);
  
  let descontoCalculado = 0;
  let descPct = 0;
  let descReais = 0;

  if (valorDesconto) {
    const val = Number(valorDesconto);
    if (!isNaN(val) && val > 0) {
      if (tipoDesconto === 'REAIS') {
        descontoCalculado = val;
        descReais = val;
      } else {
        descontoCalculado = (valorOriginal * val) / 100;
        descPct = val;
      }
    }
  }

  let descontoPontosVal = 0;
  const pontos = Number(pontosUsados);
  if (!isNaN(pontos) && pontos > 0) {
    descontoPontosVal = pontos * valorPorPonto;
  }

  const valorFinal = Math.max(0, valorOriginal - descontoCalculado - descontoPontosVal);

  const handleSubmit = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const pts = Number(pontosUsados) || 0;
      if (pts > saldoPontos) {
        setErro('O cliente não possui essa quantidade de pontos.');
        setSalvando(false);
        return;
      }

      await onConfirmar({
        status: 'CONCLUIDO',
        formaPagamento,
        valorCobrado: valorFinal,
        pontosUsados: pts,
        descontoPercentual: descPct || undefined,
        descontoReais: descReais || undefined,
      });
      onFechar();
    } catch (err: any) {
      setErro(err.response?.data?.erro || err.message || 'Erro ao concluir o agendamento');
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} onFechar={onFechar} titulo="Concluir Serviço">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {erro && (
          <div style={{ padding: '12px', background: 'var(--perigo-fundo)', border: '1px solid var(--error-text)', borderRadius: '6px', color: 'var(--error-text)', fontFamily: 'var(--fonte-interface)', fontSize: '13px', fontWeight: 500 }}>
            {erro}
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm font-interface text-[var(--text-primary)]">
          <p><strong className="text-[var(--texto-secundario)]">Serviço:</strong> {agendamento.servico.nome}</p>
          <p><strong className="text-[var(--texto-secundario)]">Cliente:</strong> {agendamento.cliente.usuario.nome}</p>
        </div>

        <div>
          <label className="input-label mb-2">Forma de Pagamento</label>
          <div className="flex flex-wrap gap-2">
            {FORMAS_PAGAMENTO.map(forma => (
              <button
                key={forma.value}
                onClick={() => setFormaPagamento(forma.value)}
                className={`px-3 py-2 rounded-full text-xs font-medium transition-colors border ${
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
          <label className="input-label">Desconto</label>
          <div className="flex gap-2">
            <select value={tipoDesconto} onChange={(e) => setTipoDesconto(e.target.value as any)} className="ds-select w-24">
              <option value="REAIS">R$</option>
              <option value="PERCENTUAL">%</option>
            </select>
            <input 
              type="number" 
              min="0"
              step="any"
              placeholder="Ex: 10" 
              value={valorDesconto} 
              onChange={(e) => setValorDesconto(e.target.value)} 
              className="ds-input flex-1"
            />
          </div>
        </div>

        {valorPorPonto > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <label className="input-label mb-2">Usar Pontos (Fidelidade)</label>
            <div className="flex justify-between items-center mb-2">
              <p className="text-xs text-[var(--texto-secundario)]">Saldo: {saldoPontos} pontos</p>
              <p className="text-xs text-[var(--texto-secundario)]">Valor por ponto: R$ {valorPorPonto.toFixed(2)}</p>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <input 
                  type="number" 
                  min="0"
                  max={saldoPontos}
                  placeholder="Qtd. Pontos" 
                  value={pontosUsados} 
                  onChange={(e) => setPontosUsados(e.target.value)} 
                  className="ds-input"
                />
              </div>
              <div className="flex-1">
                <input 
                  type="text" 
                  readOnly
                  placeholder="Desconto em R$" 
                  value={descontoPontosVal > 0 ? `R$ ${descontoPontosVal.toFixed(2)}` : ''} 
                  className="ds-input bg-[var(--bg-surface2)] text-[var(--texto-secundario)] cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-surface2)] p-4 rounded-lg mt-2 font-mono text-sm border border-[var(--border)]">
          <div className="flex justify-between text-[var(--text-primary)] mb-1">
            <span>Valor Bruto:</span>
            <span>R$ {valorOriginal.toFixed(2)}</span>
          </div>
          {descontoCalculado > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto (Manual):</span>
              <span>- R$ {descontoCalculado.toFixed(2)}</span>
            </div>
          )}
          {descontoPontosVal > 0 && (
            <div className="flex justify-between text-[var(--perigo)] mb-1">
              <span>Desconto (Pontos):</span>
              <span>- R$ {descontoPontosVal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-lg text-[var(--text-primary)] mt-2 pt-2 border-t border-[var(--border)]">
            <span>Total a Cobrar:</span>
            <span>R$ {valorFinal.toFixed(2)}</span>
          </div>
        </div>

        <button 
          onClick={handleSubmit} 
          className="btn-primary w-full justify-center mt-2 min-h-[48px] flex items-center gap-2 transition-opacity"
          disabled={salvando}
          style={{ opacity: salvando ? 0.7 : 1 }}
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
