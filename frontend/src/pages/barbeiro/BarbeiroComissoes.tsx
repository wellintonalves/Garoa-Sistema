import { useState, useEffect } from 'react';
import { DollarSign, Calendar as CalendarIcon, TrendingUp, Scissors } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';
import { dataBrasilia, hojeBrasilia } from '../../utils/datas';

interface ComissoesData {
  totalAtendimentos: number;
  valorBruto: number;
  percentualComissao: number;
  valorComissao: number;
  lancamentos: Array<{ id: string; data: string; valor: number; valorComissao: number; servico: string; cliente: string }>;
}

export function BarbeiroComissoes() {
  const hoje = hojeBrasilia();
  const [year, month] = hoje.split('-').map(Number);
  const primeiroDia = dataBrasilia(new Date(year, month - 1, 1, 12, 0, 0));
  const ultimoDia = dataBrasilia(new Date(year, month, 0, 12, 0, 0));

  const [inicio, setInicio] = useState(primeiroDia);
  const [fim, setFim] = useState(ultimoDia);
  const [dados, setDados] = useState<ComissoesData | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarComissoes();
  }, [inicio, fim]);

  async function carregarComissoes() {
    setCarregando(true);
    try {
      const res = await barbeiroApi.get<ComissoesData>('/barbeiro/comissoes', { params: { inicio, fim } });
      setDados(res.data);
    } catch { /* empty */ }
    finally { setCarregando(false); }
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="px-4 py-6 md:px-8 max-w-4xl mx-auto animate-fade-in" style={{ fontFamily: 'var(--fonte-interface)' }}>
      <h1 className="text-2xl md:text-3xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        Comissões
      </h1>

      {/* Filtros de data */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <label className="input-label flex items-center gap-1"><CalendarIcon size={14} />Início</label>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="ds-input" />
        </div>
        <div>
          <label className="input-label flex items-center gap-1"><CalendarIcon size={14} />Fim</label>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="ds-input" />
        </div>
      </div>

      {carregando ? (
        <div className="flex justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <TrendingUp className="animate-spin mr-2" /> Calculando...
        </div>
      ) : dados ? (
        <div className="space-y-6">
          {/* Card Principal */}
          <div className="p-6 md:p-8 rounded-2xl border relative overflow-hidden" style={{
            background: 'var(--bg-surface)',
            borderColor: 'var(--cor-primaria)'
          }}>
            {/* Efeito de fundo */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full pointer-events-none" style={{ background: 'var(--cor-primaria)' }}></div>
            
            <div className="flex items-center gap-3 mb-2 relative z-10">
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
                <DollarSign size={20} style={{ color: 'var(--cor-primaria)' }} />
              </div>
              <span className="text-sm font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Sua Comissão ({dados.percentualComissao}%)
              </span>
            </div>
            
            <p className="text-4xl md:text-5xl font-bold mt-4 mb-8 relative z-10" style={{ color: 'var(--cor-primaria)' }}>
              {fmt(dados.valorComissao)}
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Valor Bruto</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(dados.valorBruto)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-muted)' }}>Atendimentos</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{dados.totalAtendimentos}</p>
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div className="pt-4">
            <h2 className="text-sm font-medium mb-4 flex items-center gap-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              <TrendingUp size={16} /> Histórico de Lançamentos
            </h2>
            
            {dados.lancamentos.length === 0 ? (
              <div className="p-10 rounded-2xl border text-center flex flex-col items-center justify-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--bg-surface2)' }}>
                  <Scissors size={28} style={{ color: 'var(--text-muted)' }} />
                </div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Nenhum lançamento no período.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dados.lancamentos.map(l => (
                  <div key={l.id} className="p-4 rounded-xl border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 transition-colors hover:bg-black/5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <div>
                      <p className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                        {l.cliente}
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {l.servico}
                      </p>
                    </div>
                    <div className="flex sm:flex-col justify-between items-center sm:items-end w-full sm:w-auto">
                      <span className="font-semibold text-lg" style={{ color: 'var(--cor-primaria)' }}>
                        +{fmt(l.valorComissao)}
                      </span>
                      <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                        {new Date(l.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
