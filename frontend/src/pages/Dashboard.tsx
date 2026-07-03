import { useEffect, useState, useCallback } from 'react';
import { DollarSign, CalendarCheck, Clock, AlertTriangle, TrendingUp, Award, Calendar, BarChart3 } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { SkeletonPage } from '../components/Skeleton';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface DadosDashboard {
  faturamentoTotal: number;
  faturamentoServicos: number;
  faturamentoProdutos: number;
  totalSaidas: number;
  saldo: number;
  totalAtendimentos: number;
  pendentes: number;
  estoqueBaixo: number;
  ticketMedio: number;
  servicoMaisRealizado: { nome: string; count: number; total: number } | null;
  porDia: Array<{ data: string; entradas: number; produtos: number; saidas: number }>;
}

function getPeriodDates(period: 'hoje' | 'esta_semana' | 'este_mes' | 'mes_anterior') {
  const today = new Date();
  let start = new Date();
  let end = new Date();

  if (period === 'hoje') {
    // start and end are today
  } else if (period === 'esta_semana') {
    const day = today.getDay();
    const diff = today.getDate() - day; // Adjust to Sunday
    start = new Date(today.setDate(diff));
    end = new Date(); // up to today
  } else if (period === 'este_mes') {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === 'mes_anterior') {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0);
  }

  return {
    inicio: start.toISOString().split('T')[0],
    fim: end.toISOString().split('T')[0],
  };
}

export function Dashboard() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const hojeStr = new Date().toISOString().split('T')[0];
  const [filtros, setFiltros] = useState({ inicio: hojeStr, fim: hojeStr });
  const [periodoAtivo, setPeriodoAtivo] = useState<string>('hoje');

  const buscarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.get('/financeiro/dashboard', {
        params: { inicio: filtros.inicio, fim: filtros.fim },
      });
      setDados(res.data);
    } catch (err: any) {
      console.error('Erro ao carregar dashboard:', err);
      const mensagem = err?.response?.data?.erro || err?.message || 'Erro ao carregar os dados.';
      setErro(mensagem);
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [filtros]);

  useEffect(() => {
    buscarDados();
  }, [buscarDados]);

  const setShortcut = (period: 'hoje' | 'esta_semana' | 'este_mes' | 'mes_anterior') => {
    const { inicio, fim } = getPeriodDates(period);
    setPeriodoAtivo(period);
    setFiltros({ inicio, fim });
  };

  const handleCustomDateChange = (field: 'inicio' | 'fim', value: string) => {
    setPeriodoAtivo('custom');
    setFiltros((prev) => ({ ...prev, [field]: value }));
  };

  const formatarMoeda = (valor: number) =>
    (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Cálculo para o gráfico
  const maxFaturamento = dados?.porDia ? Math.max(...dados.porDia.map((d) => d.entradas), 1) : 1;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '32px',
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
            lineHeight: 1.1,
          }}
        >
          Olá, {usuario?.nome?.split(' ')[0]}
        </h1>
        <p
          style={{
            fontFamily: 'var(--fonte-interface)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            letterSpacing: '0.06em',
          }}
        >
          Acompanhe os resultados da sua barbearia
        </p>
      </div>

      {/* Filtros */}
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            className={`${periodoAtivo === 'hoje' ? 'btn-primary' : 'btn-secondary'} max-md:min-h-[48px]`}
            onClick={() => setShortcut('hoje')}
            style={{ padding: '8px 16px', fontSize: '10px' }}
          >
            Hoje
          </button>
          <button
            className={`${periodoAtivo === 'esta_semana' ? 'btn-primary' : 'btn-secondary'} max-md:min-h-[48px]`}
            onClick={() => setShortcut('esta_semana')}
            style={{ padding: '8px 16px', fontSize: '10px' }}
          >
            Esta Semana
          </button>
          <button
            className={`${periodoAtivo === 'este_mes' ? 'btn-primary' : 'btn-secondary'} max-md:min-h-[48px]`}
            onClick={() => setShortcut('este_mes')}
            style={{ padding: '8px 16px', fontSize: '10px' }}
          >
            Este Mês
          </button>
          <button
            className={`${periodoAtivo === 'mes_anterior' ? 'btn-primary' : 'btn-secondary'} max-md:min-h-[48px]`}
            onClick={() => setShortcut('mes_anterior')}
            style={{ padding: '8px 16px', fontSize: '10px' }}
          >
            Mês Anterior
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div>
            <label className="input-label">Data Início</label>
            <input
              type="date"
              value={filtros.inicio}
              onChange={(e) => handleCustomDateChange('inicio', e.target.value)}
              className="ds-input"
              style={{ minHeight: '34px', padding: '6px 12px' }}
            />
          </div>
          <div>
            <label className="input-label">Data Fim</label>
            <input
              type="date"
              value={filtros.fim}
              onChange={(e) => handleCustomDateChange('fim', e.target.value)}
              className="ds-input"
              style={{ minHeight: '34px', padding: '6px 12px' }}
            />
          </div>
          <button onClick={buscarDados} className="btn-primary max-md:min-h-[48px]" disabled={carregando} style={{ padding: '8px 16px', fontSize: '10px', height: '34px' }}>
            <Calendar size={12} /> {carregando ? 'Buscando...' : 'Aplicar'}
          </button>
        </div>
      </div>

      {carregando ? (
        <SkeletonPage />
      ) : erro ? (
        <div
          className="card"
          style={{
            borderLeft: '2px solid var(--error-text)',
            padding: '1.25rem',
          }}
        >
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            Erro ao carregar dados do dashboard
          </p>
          <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {erro}
          </p>
        </div>
      ) : dados ? (
        <>
          {/* Cards Principais */}
          <div className="dashboard-grid">
            <StatCard
              titulo="Serviços"
              valor={formatarMoeda(dados.faturamentoServicos)}
              icone={DollarSign}
              subtexto="Faturamento"
              destaque
            />
            <StatCard
              titulo="Produtos"
              valor={formatarMoeda(dados.faturamentoProdutos)}
              icone={DollarSign}
              subtexto="Faturamento"
            />
            <StatCard
              titulo="Atendimentos"
              valor={String(dados.totalAtendimentos)}
              icone={CalendarCheck}
              subtexto="Concluídos no período"
            />
            <StatCard
              titulo="Pendentes"
              valor={String(dados.pendentes)}
              icone={Clock}
              subtexto="Aguardando / Confirmados"
            />
            <StatCard
              titulo="Estoque Baixo"
              valor={String(dados.estoqueBaixo)}
              icone={AlertTriangle}
              subtexto="Itens abaixo do mínimo"
              alerta={dados.estoqueBaixo > 0}
            />
          </div>

          {/* Cards Secundários (Resumo) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
            <StatCard
              titulo="Ticket Médio"
              valor={formatarMoeda(dados.ticketMedio)}
              icone={TrendingUp}
              subtexto="Por atendimento no período"
            />
            <div className="metric-card animate-fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="metric-label">Serviço Mais Realizado</span>
                <div className="flex items-center justify-center" style={{ width: '36px', height: '36px', background: 'rgba(var(--cor-primaria-rgb), 0.10)', border: '1px solid var(--border)' }}>
                  <Award size={16} strokeWidth={1.5} style={{ color: 'var(--cor-icone)' }} />
                </div>
              </div>
              {dados.servicoMaisRealizado ? (
                <>
                  <p className="metric-value" style={{ fontSize: '24px' }}>{dados.servicoMaisRealizado.nome}</p>
                  <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', letterSpacing: '0.04em' }}>
                    {dados.servicoMaisRealizado.count} vezes ({formatarMoeda(dados.servicoMaisRealizado.total)})
                  </p>
                </>
              ) : (
                <p className="metric-value" style={{ fontSize: '18px', color: 'var(--text-muted)' }}>Nenhum serviço</p>
              )}
            </div>
          </div>

          {/* Gráfico de Faturamento */}
          <div className="card">
            <h3 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '24px' }}>
              Faturamento Dia a Dia
            </h3>
            
            {dados.porDia.length > 0 && dados.porDia.some(dia => dia.entradas > 0) ? (
              <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '4px', position: 'relative', paddingTop: '20px' }}>
                {/* Linhas de grade horizontais */}
                <div style={{ position: 'absolute', top: '0', left: '0', right: '0', borderTop: '1px dashed var(--border)', zIndex: 0 }}></div>
                <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', borderTop: '1px dashed var(--border)', zIndex: 0 }}></div>
                <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', borderTop: '1px solid var(--border)', zIndex: 0 }}></div>

                {/* Barras */}
                {dados.porDia.map((dia, idx) => {
                  const totalDia = dia.entradas + dia.produtos;
                  const altura = maxFaturamento > 0 ? (totalDia / maxFaturamento) * 100 : 0;
                  const dataObj = new Date(dia.data + 'T12:00:00');
                  const isHoje = dia.data === hojeStr;

                  return (
                    <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', zIndex: 1, position: 'relative', minWidth: '20px' }}>
                      {/* Tooltip ao passar o mouse */}
                      <div className="chart-tooltip" style={{ opacity: 0, position: 'absolute', bottom: '100%', marginBottom: '8px', background: 'var(--bg-surface2)', border: '1px solid var(--border)', padding: '6px 8px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none', transition: 'opacity 0.2s', zIndex: 10 }}>
                        <p style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '10px', color: 'var(--text-muted)' }}>{dataObj.toLocaleDateString('pt-BR')}</p>
                        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatarMoeda(totalDia)}</p>
                      </div>

                      <div 
                        style={{ 
                          width: '100%', 
                          maxWidth: '30px', 
                          height: `${altura}%`, 
                          background: isHoje ? 'rgba(var(--cor-primaria-rgb), 0.15)' : 'var(--amber)', 
                          minHeight: totalDia > 0 ? '4px' : '0',
                          transition: 'height 0.4s ease-out',
                          cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                          const tooltip = e.currentTarget.previousSibling as HTMLElement;
                          if (tooltip) tooltip.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          const tooltip = e.currentTarget.previousSibling as HTMLElement;
                          if (tooltip) tooltip.style.opacity = '0';
                        }}
                      />
                      
                      {/* Mostrar rótulo do dia X se couber, senão a cada N dias para não embolar */}
                      {dados.porDia.length <= 14 || idx % Math.ceil(dados.porDia.length / 10) === 0 ? (
                        <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '9px', color: 'var(--text-muted)', marginTop: '8px', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                          {dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      ) : (
                        <span style={{ marginTop: '8px', height: '12px' }}></span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: '220px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <BarChart3 size={32} strokeWidth={1} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
                <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)' }}>Nenhum faturamento registrado neste período</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
