import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, User, X } from '@phosphor-icons/react';
import api from '../api/client';

interface ClienteBasico {
  id: string;
  usuario: { nome: string; email: string };
  telefone: string | null;
}

interface BuscaClienteProps {
  onSelect: (clienteId: string | null) => void;
  selectedClienteId?: string | null;
}

export function BuscaCliente({ onSelect, selectedClienteId }: BuscaClienteProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ClienteBasico[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<ClienteBasico | null>(null);
  
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Busca inicial caso já exista um selectedClienteId
  useEffect(() => {
    if (selectedClienteId && !selectedCliente && !busca) {
      api.get(`/clientes/${selectedClienteId}`)
        .then(res => {
          setSelectedCliente(res.data);
          setBusca(res.data.usuario.nome);
        })
        .catch(err => console.error('Erro ao buscar cliente selecionado', err));
    } else if (!selectedClienteId) {
      setSelectedCliente(null);
      setBusca('');
    }
  }, [selectedClienteId]); // eslint-disable-line

  // Efeito de debounce para buscar clientes
  useEffect(() => {
    if (!busca || selectedCliente?.usuario.nome === busca) {
      setResultados([]);
      return;
    }

    const delay = setTimeout(() => {
      setLoading(true);
      api.get(`/clientes?busca=${encodeURIComponent(busca)}`)
        .then(res => {
          setResultados(res.data);
          setIsOpen(true);
        })
        .catch(err => console.error('Erro ao buscar clientes', err))
        .finally(() => setLoading(false));
    }, 400);

    return () => clearTimeout(delay);
  }, [busca, selectedCliente]);

  const handleSelect = (cliente: ClienteBasico) => {
    setSelectedCliente(cliente);
    setBusca(cliente.usuario.nome);
    setIsOpen(false);
    onSelect(cliente.id);
  };

  const handleClear = () => {
    setSelectedCliente(null);
    setBusca('');
    setIsOpen(false);
    onSelect(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
        Cliente (Opcional)
      </label>
      <div className="relative flex items-center">
        <MagnifyingGlass 
          size={18} 
          className="absolute left-3 text-[var(--text-muted)]" 
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            if (selectedCliente) {
              setSelectedCliente(null);
              onSelect(null);
            }
          }}
          onFocus={() => { if (resultados.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por nome, telefone ou email..."
          className="w-full bg-[var(--fundo-card)] border border-[var(--border)] rounded-md py-2 pl-10 pr-10 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--cor-primaria)] placeholder-[var(--text-muted)]"
          autoComplete="off"
        />
        {busca && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isOpen && (busca.length > 0) && (
        <div className="absolute z-[99999] top-full left-0 w-full mt-1 bg-[var(--fundo-card)] border border-[var(--border)] rounded-md shadow-xl max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-sm text-[var(--text-muted)]">Buscando...</div>
          ) : resultados.length > 0 ? (
            <ul className="py-1">
              {resultados.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(cliente)}
                    className="w-full text-left px-3 py-2 hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-surface2)] flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-[var(--text-secondary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {cliente.usuario.nome}
                      </div>
                      {(cliente.telefone || cliente.usuario.email) && (
                        <div className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                          {cliente.telefone || cliente.usuario.email}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-center text-sm text-[var(--text-muted)]">Nenhum cliente encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}
