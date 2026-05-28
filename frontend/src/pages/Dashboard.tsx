// Dashboard — painel principal com metric cards + resumo
import { useEffect, useState } from 'react';
import { DollarSign, CalendarCheck, Clock, AlertTriangle } from 'lucide-react';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import api from '../api/client';
import { useAuth } from '../hooks/useAuth';

interface DadosDashboard {
  faturamentoDia: number;
  atendimentosDia: number;
  pendentes: number;
  estoqueBaixo: number;
}

export function Dashboard() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState<DadosDashboard | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      try {
        const hoje = new Date().toISOString().split('T')[0];

        // Busca dados em paralelo
        const [agendRes, estoqueRes, finRes] = await Promise.all([
          api.get('/agendamentos', { params: { data: hoje } }),
          api.get('/estoque/baixo'),
          api.get('/financeiro/resumo-dia', { params: { data: hoje } }),
        ]);

        const agendamentos = agendRes.data as Array<{ status: string; valorCobrado: string }>;
        const concluidos = agendamentos.filter((a) => a.status === 'CONCLUIDO');
        const pendentes = agendamentos.filter((a) => a.status === 'AGUARDANDO' || a.status === 'CONFIRMADO');

        setDados({
          faturamentoDia: (finRes.data as { totalEntradas: number }).totalEntradas,
          atendimentosDia: concluidos.length,
          pendentes: pendentes.length,
          estoqueBaixo: (estoqueRes.data as Array<unknown>).length,
        });
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
        setDados({ faturamentoDia: 0, atendimentosDia: 0, pendentes: 0, estoqueBaixo: 0 });
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  if (carregando) return <LoadingSpinner />;

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
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
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            marginTop: '8px',
            letterSpacing: '0.06em',
          }}
        >
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}
        </p>
      </div>

      {/* Cards */}
      <div className="dashboard-grid">
        <StatCard
          titulo="Faturamento Hoje"
          valor={formatarMoeda(dados?.faturamentoDia || 0)}
          icone={DollarSign}
          subtexto="Entradas do dia"
          destaque
        />
        <StatCard
          titulo="Atendimentos"
          valor={String(dados?.atendimentosDia || 0)}
          icone={CalendarCheck}
          subtexto="Concluídos hoje"
        />
        <StatCard
          titulo="Pendentes"
          valor={String(dados?.pendentes || 0)}
          icone={Clock}
          subtexto="Aguardando / Confirmados"
        />
        <StatCard
          titulo="Estoque Baixo"
          valor={String(dados?.estoqueBaixo || 0)}
          icone={AlertTriangle}
          subtexto="Itens abaixo do mínimo"
        />
      </div>
    </div>
  );
}
