// Dashboard — painel principal com 4 cards + resumo
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Olá, {usuario?.nome?.split(' ')[0]}! 👋
        </h1>
        <p className="text-neutral-500 text-sm mt-1">
          Aqui está o resumo do seu dia — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          titulo="Faturamento Hoje"
          valor={formatarMoeda(dados?.faturamentoDia || 0)}
          icone={DollarSign}
          cor="cyan"
          subtexto="Entradas do dia"
        />
        <StatCard
          titulo="Atendimentos"
          valor={String(dados?.atendimentosDia || 0)}
          icone={CalendarCheck}
          cor="green"
          subtexto="Concluídos hoje"
        />
        <StatCard
          titulo="Pendentes"
          valor={String(dados?.pendentes || 0)}
          icone={Clock}
          cor="blue"
          subtexto="Aguardando / Confirmados"
        />
        <StatCard
          titulo="Estoque Baixo"
          valor={String(dados?.estoqueBaixo || 0)}
          icone={AlertTriangle}
          cor="red"
          subtexto="Itens abaixo do mínimo"
        />
      </div>
    </div>
  );
}
