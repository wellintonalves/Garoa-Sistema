import React, { useState, useEffect, useRef } from 'react';
import { MagnifyingGlass, User, X } from '@phosphor-icons/react';
import api from '../api/client';
import { Z_INDEX } from '../utils/constantes';

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
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
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

  // Reset selectedIndex ao mudar resultados
  useEffect(() => {
    setSelectedIndex(-1);
  }, [resultados, isOpen]);

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

  // Função para buscar os últimos clientes atendidos
  const fetchRecentes = () => {
    setLoading(true);
    api.get(`/clientes`)
      .then(res => {
        setResultados(res.data.slice(0, 5));
        setIsOpen(true);
      })
      .catch(err => console.error('Erro ao buscar clientes recentes', err))
      .finally(() => setLoading(false));
  };

  // Efeito de debounce para buscar clientes
  useEffect(() => {
    if (selectedCliente?.usuario.nome === busca) {
      setResultados([]);
      return;
    }

    const query = busca.trim();

    // Cenário 9 e 3: Se vazio (e campo em foco/já abriu), busca recentes
    if (query.length === 0) {
      if (isOpen) {
        fetchRecentes();
      }
      return;
    }

    // Cenário 5: Mínimo de 2 caracteres
    if (query.length === 1) {
      setResultados([]);
      return;
    }

    const delay = setTimeout(() => {
      setLoading(true);
      api.get(`/clientes?busca=${encodeURIComponent(query)}`)
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

  const handleFocus = () => {
    if (busca.trim().length === 0 && !selectedCliente) {
      fetchRecentes();
    } else if (resultados.length > 0) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        handleFocus();
      } else if (resultados.length > 0) {
        setSelectedIndex(prev => (prev < resultados.length - 1 ? prev + 1 : prev));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && resultados.length > 0) {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < resultados.length) {
        handleSelect(resultados[selectedIndex]);
      }
    }
  };

  const mostrarDropdown = isOpen && (busca.trim().length === 0 || busca.trim().length >= 2);

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
          onFocus={handleFocus}
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

      {mostrarDropdown && (
        <div className="absolute top-full left-0 w-full mt-1 bg-[var(--fundo-card)] border border-[var(--border)] rounded-md shadow-xl max-h-60 overflow-y-auto" style={{ zIndex: Z_INDEX.SUSPENSO_EM_MODAL }}>
          {loading ? (
            <div className="p-3 text-center text-sm text-[var(--text-muted)]">Buscando...</div>
          ) : resultados.length > 0 ? (
            <>
              {busca.trim().length === 0 && (
                <div className="px-3 pt-2 pb-1 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Últimos Atendidos
                </div>
              )}
              <ul className="py-1">
                {resultados.map((cliente, index) => (
                  <li key={cliente.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setSelectedIndex(index)}
                      onClick={() => handleSelect(cliente)}
                      className={`w-full text-left px-3 py-2 transition-colors flex items-center gap-3 ${selectedIndex === index ? 'bg-[var(--bg-surface2)]' : 'hover:bg-[var(--bg-surface2)]'}`}
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
            </>
          ) : (
            <div className="p-3 text-center flex flex-col items-center gap-2">
              <span className="text-sm text-[var(--text-muted)]">
                Nenhum cliente encontrado
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-[13px] font-medium text-[var(--cor-primaria)] hover:brightness-110 transition-all"
              >
                Marcar como não cadastrado
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
