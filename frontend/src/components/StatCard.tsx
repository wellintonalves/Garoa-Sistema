// Card de estatística para o dashboard
import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  titulo: string;
  valor: string;
  icone: LucideIcon;
  cor: 'cyan' | 'green' | 'blue' | 'red';
  subtexto?: string;
}

const cores = {
  cyan: { bg: 'bg-cyan-500/10', icon: 'text-cyan-400', border: 'border-cyan-500/20' },
  green: { bg: 'bg-green-500/10', icon: 'text-green-400', border: 'border-green-500/20' },
  blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/20' },
  red: { bg: 'bg-red-500/10', icon: 'text-red-400', border: 'border-red-500/20' },
};

export function StatCard({ titulo, valor, icone: Icone, cor, subtexto }: StatCardProps) {
  const tema = cores[cor];

  return (
    <div className={`bg-neutral-900 rounded-xl border ${tema.border} p-5 animate-fade-in hover:bg-neutral-800/80 transition-colors`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{titulo}</span>
        <div className={`w-9 h-9 rounded-lg ${tema.bg} flex items-center justify-center`}>
          <Icone className={`w-4 h-4 ${tema.icon}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{valor}</p>
      {subtexto && <p className="text-xs text-neutral-500 mt-1">{subtexto}</p>}
    </div>
  );
}
