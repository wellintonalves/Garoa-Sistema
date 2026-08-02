

interface Barbeiro {
  id: string;
  usuario: { nome: string };
}

interface AgendaMobileChipsProps {
  barbeiros: Barbeiro[];
  selecionado: string;
  onSelect: (id: string) => void;
  getColor: (id: string) => string;
}

export function AgendaMobileChips({ barbeiros, selecionado, onSelect, getColor }: AgendaMobileChipsProps) {
  return (
    <div className="flex w-full overflow-x-auto scrollbar-hide snap-x gap-3 py-2 px-1">
      {barbeiros.map(b => {
        const isActive = b.id === selecionado;
        const color = getColor(b.id);
        const primeiroNome = b.usuario.nome.split(' ')[0];
        
        return (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className="snap-start shrink-0 flex items-center justify-center rounded-full px-4 transition-colors"
            style={{
              minHeight: '44px',
              fontFamily: 'var(--fonte-interface)',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 500,
              border: isActive ? `1px solid var(--cor-primaria)` : `1px solid var(--border)`,
              background: isActive ? 'var(--cor-primaria)' : 'var(--bg-surface)',
              color: isActive ? 'var(--texto-sobre-primaria)' : 'var(--text-primary)',
            }}
          >
            <div
              className="mr-2 rounded-full"
              style={{
                width: '12px',
                height: '12px',
                background: color,
                border: isActive ? '1px solid rgba(255,255,255,0.4)' : 'none'
              }}
            />
            {primeiroNome}
          </button>
        );
      })}
    </div>
  );
}
