// Aba Perfil do cliente — dados editáveis, barbearias conectadas, logout
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClienteAuth } from '../../../hooks/useClienteAuth';
import { useModoTema } from '../../../hooks/useModoTema';
import { User, LogOut, Unlink, Scissors, Save, Moon, Sun, Monitor, CalendarCheck, CalendarX, DollarSign, Award } from 'lucide-react';
import clienteApi from '../../../api/clienteApi';

interface PerfilData {
  id: string;
  telefone: string | null;
  usuario: { id: string; nome: string; email: string };
  stats: {
    atendimentos: number;
    faltas: number;
    gastoTotal: number;
    dataRegistro: string;
  };
}

interface BarbeariaConectada {
  id: string;
  nome: string;
  slug: string;
}

interface AgendamentoItem {
  id: string;
  status: string;
  valorCobrado: string;
}

function getTier(atendimentos: number): { label: string; show: boolean } {
  if (atendimentos >= 10) return { label: 'Cliente VIP', show: true };
  if (atendimentos >= 5)  return { label: 'Cliente Frequente', show: true };
  return { label: '', show: false };
}

export function ClienteBarbeariaPerfil() {
  const navigate = useNavigate();
  const { barbeariaId } = useParams<{ barbeariaId: string }>();
  const { logout } = useClienteAuth();
  const { modo, setModo } = useModoTema();
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [barbearias, setBarbearias] = useState<BarbeariaConectada[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  // Stats por barbearia (calculados dos agendamentos da barbearia atual)
  const [statsLocais, setStatsLocais] = useState<{ atendimentos: number; faltas: number; gastoTotal: number } | null>(null);

  useEffect(() => {
    clienteApi.get<PerfilData>('/cliente/perfil').then(res => {
      setPerfil(res.data);
      setNome(res.data.usuario.nome);
      setTelefone(res.data.telefone || '');
    });
    clienteApi.get<BarbeariaConectada[]>('/cliente/minhas-barbearias').then(res => setBarbearias(res.data));

    // Stats específicos desta barbearia
    if (barbeariaId) {
      clienteApi.get<AgendamentoItem[]>(`/cliente/barbearia/${barbeariaId}/agendamentos`)
        .then(res => {
          const agendamentos = res.data;
          const atendimentos = agendamentos.filter(a => a.status === 'CONCLUIDO').length;
          const faltas = agendamentos.filter(a => a.status === 'CANCELADO').length;
          const gastoTotal = agendamentos
            .filter(a => a.status === 'CONCLUIDO')
            .reduce((sum, a) => sum + Number(a.valorCobrado || 0), 0);
          setStatsLocais({ atendimentos, faltas, gastoTotal });
        })
        .catch(() => { /* empty */ });
    }
  }, [barbeariaId]);

  async function salvar() {
    setSalvando(true);
    setMensagem('');
    try {
      await clienteApi.put('/cliente/perfil', { nome, telefone });
      setMensagem('Perfil atualizado com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    } catch { setMensagem('Erro ao salvar. Tente novamente.'); }
    finally { setSalvando(false); }
  }

  async function desconectar(barbId: string) {
    if (!confirm('Desconectar desta barbearia?')) return;
    try {
      await clienteApi.delete(`/cliente/desconectar-barbearia/${barbId}`);
      setBarbearias(prev => prev.filter(b => b.id !== barbId));
    } catch { /* empty */ }
  }

  function handleLogout() {
    logout();
    navigate('/cliente');
  }

  const fmtMonetario = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Stats a exibir: usa os locais (por barbearia) quando disponíveis
  const atendimentos = statsLocais?.atendimentos ?? perfil?.stats?.atendimentos ?? 0;
  const faltas       = statsLocais?.faltas       ?? perfil?.stats?.faltas       ?? 0;
  const gastoTotal   = statsLocais?.gastoTotal   ?? perfil?.stats?.gastoTotal   ?? 0;
  const dataRegistro = perfil?.stats?.dataRegistro;

  const tier = getTier(atendimentos);

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto">
      {/* Header do Perfil (Avatar + Badge) */}
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[var(--fundo-sidebar)] border-2 border-[var(--amber)] shadow-lg shadow-amber-900/20">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '32px', color: 'var(--amber)', fontWeight: 600 }}>
              {perfil?.usuario.nome ? perfil.usuario.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User size={32} />}
            </span>
          </div>
          {tier.show && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[var(--amber)] text-black rounded-full px-3 py-1 flex items-center gap-1 shadow-md whitespace-nowrap">
              <Award size={12} />
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                {tier.label}
              </span>
            </div>
          )}
        </div>

        <h1 style={{ fontFamily: 'var(--fonte-interface)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginTop: tier.show ? '12px' : '0' }}>
          {perfil?.usuario.nome || 'Carregando...'}
        </h1>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
          {dataRegistro
            ? `Membro desde ${new Date(dataRegistro).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
            : ''}
        </p>
      </div>

      {/* Stats Horizontais */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="flex flex-col items-center justify-center p-4 rounded-md" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <CalendarCheck size={18} style={{ color: 'var(--amber)', marginBottom: '8px' }} />
          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {atendimentos}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em' }}>
            Visitas
          </span>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-md" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <CalendarX size={18} style={{ color: 'var(--text-disabled)', marginBottom: '8px' }} />
          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {faltas}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em' }}>
            Faltas
          </span>
        </div>

        <div className="flex flex-col items-center justify-center p-4 rounded-md" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <DollarSign size={18} style={{ color: '#22C55E', marginBottom: '8px' }} />
          <span style={{ fontFamily: 'var(--fonte-numeros)', fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {fmtMonetario(gastoTotal)}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginTop: '2px', letterSpacing: '0.04em' }}>
            Investido
          </span>
        </div>
      </div>

      {/* Formulário de Dados Pessoais */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
          <User size={14} /> Dados Pessoais
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Nome Completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
                   className="w-full bg-[var(--fundo-input)] border border-[var(--borda)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--amber)] transition-colors" />
          </div>
          <div>
            <label className="block mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>WhatsApp</label>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000"
                   className="w-full bg-[var(--fundo-input)] border border-[var(--borda)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--amber)] transition-colors" />
          </div>
          <div>
            <label className="block mb-2" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Email (Somente leitura)</label>
            <input value={perfil?.usuario.email || ''} disabled
                   className="w-full bg-[var(--fundo-sidebar)] border border-[var(--borda)] rounded p-3 text-[var(--text-disabled)] font-interface cursor-not-allowed" />
          </div>

          {mensagem && (
            <div className={`p-3 rounded border text-sm font-interface font-medium flex items-center justify-center ${mensagem.includes('Erro') ? 'bg-[rgba(239,68,68,0.1)] border-[#EF4444] text-[#EF4444]' : 'bg-[rgba(34,197,94,0.1)] border-[#22C55E] text-[#22C55E]'}`}>
              {mensagem}
            </div>
          )}

          <button onClick={salvar} disabled={salvando} className="btn-primary w-full justify-center mt-2 py-3" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Aparência */}
      <div className="mb-8">
        <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
          <Monitor size={14} /> Aparência
        </h2>
        <div className="flex bg-[var(--fundo-sidebar)] border border-[var(--borda)] rounded-md overflow-hidden p-1 gap-1">
          <button
            onClick={() => setModo('light')}
            className={`flex-1 py-2 rounded flex flex-col items-center justify-center gap-1.5 transition-all ${modo === 'light' ? 'text-black bg-[var(--amber)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Sun size={18} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Claro</span>
          </button>

          <button
            onClick={() => setModo('dark')}
            className={`flex-1 py-2 rounded flex flex-col items-center justify-center gap-1.5 transition-all ${modo === 'dark' ? 'text-black bg-[var(--amber)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Moon size={18} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Escuro</span>
          </button>

          <button
            onClick={() => setModo('auto')}
            className={`flex-1 py-2 rounded flex flex-col items-center justify-center gap-1.5 transition-all ${modo === 'auto' ? 'text-black bg-[var(--amber)] shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            <Monitor size={18} />
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>Auto</span>
          </button>
        </div>
      </div>

      {/* Barbearias conectadas */}
      {barbearias.length > 0 && (
        <div className="mb-8">
          <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
            <Scissors size={14} /> Minhas Barbearias
          </h2>
          <div className="flex flex-col gap-2">
            {barbearias.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 rounded-md transition-colors hover:bg-[var(--fundo-sidebar)]"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--borda)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[var(--fundo-sidebar)] border border-[var(--borda)] flex items-center justify-center">
                    <Scissors size={14} className="text-[var(--text-muted)]" />
                  </div>
                  <span style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{b.nome}</span>
                </div>
                <button onClick={() => desconectar(b.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '8px' }}
                  title="Desconectar">
                  <Unlink size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão sair */}
      <div className="pt-4 border-t border-[var(--borda)]">
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-md transition-colors"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          <LogOut size={16} /> Sair da Conta
        </button>
      </div>
    </div>
  );
}
