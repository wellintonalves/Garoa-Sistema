import { Sun, Moon, Desktop, type IconWeight } from '@phosphor-icons/react';
import { useTema } from '../hooks/useTema';
import type { PreferenciaTema } from '../theme/tema';

export function SeletorTema() {
  const { preferencia, modo, alterar } = useTema();

  const opcoes: { id: PreferenciaTema; label: string; icone: React.ComponentType<{ size?: number; weight?: IconWeight }> }[] = [
    { id: 'claro', label: 'Claro', icone: Sun },
    { id: 'escuro', label: 'Escuro', icone: Moon },
    { id: 'auto', label: 'Automático', icone: Desktop },
  ];

  return (
    <div className="flex flex-col gap-3 w-full">
      <div 
        className="flex bg-[var(--superficie)] border border-[var(--borda)] rounded-xl overflow-hidden p-1.5 gap-1.5 shadow-sm"
        role="radiogroup" 
        aria-label="Seleção de tema"
      >
        {opcoes.map((op) => {
          const Icone = op.icone;
          const selecionado = preferencia === op.id;
          return (
            <button
              key={op.id}
              type="button"
              role="radio"
              aria-checked={selecionado}
              onClick={() => alterar(op.id)}
              className={`flex-1 min-h-[var(--alvo-mobile)] md:min-h-[var(--alvo-desktop)] px-3 py-2.5 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-2 transition-all cursor-pointer ${
                selecionado
                  ? 'bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-semibold shadow'
                  : 'text-[var(--texto-secundario)] hover:text-[var(--texto-principal)] hover:bg-[var(--superficie-2)]'
              }`}
              style={{
                fontFamily: 'var(--fonte-interface)',
              }}
            >
              <Icone size={20} weight={selecionado ? 'fill' : 'regular'} />
              <span className="text-xs sm:text-sm tracking-wide">{op.label}</span>
            </button>
          );
        })}
      </div>
      {preferencia === 'auto' && (
        <p className="text-xs text-[var(--texto-secundario)] px-1 font-medium animate-fade-in" style={{ fontFamily: 'var(--fonte-interface)' }}>
          Seguindo o tema do sistema (atual: <strong className="text-[var(--texto-principal)] font-semibold">{modo === 'escuro' ? 'Escuro' : 'Claro'}</strong>).
        </p>
      )}
    </div>
  );
}
