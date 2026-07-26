import React from 'react';
import { Sun, Moon, Desktop, type IconWeight } from '@phosphor-icons/react';
import { useTema } from '../../hooks/useTema';
import type { PreferenciaTema } from '../../theme/tema';

export function SeletorTemaCompacto() {
  const { preferencia, alterar } = useTema();

  const opcoes: { id: PreferenciaTema; label: string; icone: React.ComponentType<{ size?: number; weight?: IconWeight }> }[] = [
    { id: 'claro', label: 'Tema claro', icone: Sun },
    { id: 'escuro', label: 'Tema escuro', icone: Moon },
    { id: 'auto', label: 'Seguir o sistema', icone: Desktop },
  ];

  return (
    <div
      className="inline-flex items-center gap-1 p-1 bg-[var(--fundo-superficie-2)] border border-[var(--borda-sutil)] rounded-[var(--raio-md)] max-md:w-full max-md:flex"
      role="radiogroup"
      aria-label="Aparência"
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
            aria-label={op.label}
            title={op.label}
            onClick={() => alterar(op.id)}
            className={`flex items-center justify-center rounded-[var(--raio-sm)] transition-all cursor-pointer w-9 h-9 md:w-9 md:h-9 max-md:flex-1 max-md:min-h-[var(--alvo-mobile)] ${
              selecionado
                ? 'bg-[var(--fundo-superficie)] text-[var(--cor-primaria-texto)] shadow-[var(--sombra-1)] font-semibold'
                : 'bg-transparent text-[var(--texto-secundario)] hover:text-[var(--texto-principal)] hover:bg-[var(--superficie-2)]'
            }`}
          >
            <Icone size={18} weight={selecionado ? 'fill' : 'regular'} />
          </button>
        );
      })}
    </div>
  );
}
