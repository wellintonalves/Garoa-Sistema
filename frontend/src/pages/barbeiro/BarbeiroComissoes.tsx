// Aba Comissões do barbeiro — métricas financeiras
import { useState, useEffect } from 'react';
import { DollarSign, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
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
    <div className="px-5 py-6 animate-fade-in">
      <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '24px', color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '0.04em' }}>
        Comissões
      </h1>

      {/* Filtros de data */}
      <div className="flex gap-2 mb-6">
        <div className="flex-1">
          <label className="input-label"><CalendarIcon size={10} className="inline mr-1" />Início</label>
          <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className="ds-input" style={{ fontSize: '12px', padding: '10px' }} />
        </div>
        <div className="flex-1">
          <label className="input-label"><CalendarIcon size={10} className="inline mr-1" />Fim</label>
          <input type="date" value={fim} onChange={e => setFim(e.target.value)} className="ds-input" style={{ fontSize: '12px', padding: '10px' }} />
        </div>
      </div>

      {carregando ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem' }}>Carregando...</p>
      ) : dados ? (
        <>
          {/* Card Principal */}
          <div className="p-6 mb-6" style={{
            background: 'linear-gradient(135deg, rgba(var(--cor-primaria-rgb), 0.10) 0%, var(--bg-surface) 100%)',
            border: '1px solid var(--amber)',
          }}>
            <div className="flex items-center gap-3 mb-4">
              <DollarSign size={20} style={{ color: 'rgba(var(--cor-primaria-rgb), 0.15)' }} />
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.15em', textTransform: '', color: 'var(--cor-icone)' }}>
                Sua Comissão ({dados.percentualComissao}%)
              </span>
            </div>
            <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '40px', color: 'rgba(var(--cor-primaria-rgb), 0.15)', lineHeight: 1 }}>
              {fmt(dados.valorComissao)}
            </p>
            <div className="flex justify-between mt-6 pt-4" style={{ borderTop: '1px solid rgba(212, 130, 10, 0.2)' }}>
              <div>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Valor Bruto</p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{fmt(dados.valorBruto)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>Atendimentos</p>
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', color: 'var(--text-primary)', fontWeight: 600 }}>{dados.totalAtendimentos}</p>
              </div>
            </div>
          </div>

          {/* Histórico */}
          <div>
            <h2 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', letterSpacing: '0.18em', textTransform: '', color: 'var(--cor-icone)', marginBottom: '12px' }}>
              <TrendingUp size={12} className="inline mr-1" /> Histórico no Período
            </h2>
            {dados.lancamentos.length === 0 ? (
              <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                Nenhum lançamento no período.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {dados.lancamentos.map(l => (
                  <div key={l.id} className="p-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-start mb-2">
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>
                        {l.cliente}
                      </p>
                      <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '13px', color: 'var(--cor-icone)' }}>
                        +{fmt(l.valorComissao)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', color: 'var(--text-muted)' }}>
                        {l.servico}
                      </p>
                      <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '9px', color: 'var(--text-disabled)' }}>
                        {new Date(l.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
