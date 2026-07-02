import { Sun, Moon, Monitor } from 'lucide-react';
import { useModoTema, type ModoTema } from '../hooks/useModoTema';

export function ToggleModo() {
  const { modo, setModo } = useModoTema();

  const opcoes: { valor: ModoTema; icone: React.ReactNode; label: string }[] = [
    { valor: 'light', icone: <Sun size={14} strokeWidth={1.5} />, label: 'Claro' },
    { valor: 'dark',  icone: <Moon size={14} strokeWidth={1.5} />, label: 'Escuro' },
    { valor: 'auto',  icone: <Monitor size={14} strokeWidth={1.5} />, label: 'Auto' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '8px 12px',
      borderTop: '1px solid var(--borda)',
      marginTop: 'auto',
    }}>
      {opcoes.map(({ valor, icone, label }) => (
        <button
          key={valor}
          onClick={() => setModo(valor)}
          title={label}
          className="max-md:min-h-[48px]"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: '6px',
            border: '1px solid transparent',
            cursor: 'pointer',
            background: modo === valor ? 'rgba(var(--cor-primaria-rgb), 0.12)' : 'transparent',
            borderColor: modo === valor ? 'var(--cor-primaria)' : 'transparent',
            color: modo === valor ? 'var(--cor-primaria)' : 'var(--texto-secundario)',
            transition: 'all 0.15s',
          }}
        >
          {icone}
        </button>
      ))}
    </div>
  );
}
