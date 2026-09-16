// Aba Perfil do cliente — dados editáveis, barbearias conectadas, logout
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useClienteAuth } from '../../../hooks/useClienteAuth';
import { SeletorTema } from '../../../components/SeletorTema';
import { ModalAlert } from '../../../components/ModalAlert';
import { User, SignOut, LinkBreak, Scissors, FloppyDisk, Monitor, CalendarCheck, CalendarX, CurrencyDollar, Medal } from '@phosphor-icons/react';
import clienteApi from '../../../api/clienteApi';
import { SkeletonCard, SkeletonText } from '../../../components/ui/Skeleton';

interface PerfilData {
  id: string;
  telefone: string | null;
  dataNascimento: string | null;
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

interface PreferenciaPromocional {
  origem: 'VALEN' | 'BARBEARIA';
  barbeariaId: string | null;
  nome: string;
  emailHabilitado: boolean;
  emailAlteradoEm: string | null;
  inAppHabilitado: boolean;
  inAppAlteradoEm: string | null;
}

function dataLocalIso(): string {
  const agora = new Date();
  const deslocamentoMs = agora.getTimezoneOffset() * 60_000;
  return new Date(agora.getTime() - deslocamentoMs).toISOString().slice(0, 10);
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
  const [perfil, setPerfil] = useState<PerfilData | null>(null);
  const [barbearias, setBarbearias] = useState<BarbeariaConectada[]>([]);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');
  const [preferencias, setPreferencias] = useState<PreferenciaPromocional[]>([]);
  const [alterandoPreferencia, setAlterandoPreferencia] = useState('');
  const [modalObj, setModalObj] = useState<{aberto: boolean; titulo: string; mensagem: string; tipo: 'erro'|'sucesso'|'aviso'|'info'; isConfirm?: boolean, onConfirm?: () => void, textoBotao?: string}>({ aberto: false, titulo: '', mensagem: '', tipo: 'info' });

  // Stats por barbearia (calculados dos agendamentos da barbearia atual)
  const [statsLocais, setStatsLocais] = useState<{ atendimentos: number; faltas: number; gastoTotal: number } | null>(null);

  useEffect(() => {
    setCarregando(true);
    Promise.allSettled([
      clienteApi.get<PerfilData>('/cliente/perfil'),
      clienteApi.get<BarbeariaConectada[]>('/cliente/minhas-barbearias'),
      clienteApi.get<PreferenciaPromocional[]>('/cliente/preferencias-promocionais'),
    ]).then(([resPerfil, resBarbearias, resPreferencias]) => {
      if (resPerfil.status === 'fulfilled') {
        setPerfil(resPerfil.value.data);
        setNome(resPerfil.value.data.usuario.nome);
        setTelefone(resPerfil.value.data.telefone || '');
        setDataNascimento(resPerfil.value.data.dataNascimento?.slice(0, 10) || '');
      }
      if (resBarbearias.status === 'fulfilled') {
        setBarbearias(resBarbearias.value.data);
      }
      if (resPreferencias.status === 'fulfilled') {
        setPreferencias(resPreferencias.value.data);
      }
    }).finally(() => setCarregando(false));

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
      await clienteApi.put('/cliente/perfil', {
        nome,
        telefone,
        ...(dataNascimento ? { dataNascimento } : {}),
      });
      setMensagem('Perfil atualizado com sucesso!');
      setTimeout(() => setMensagem(''), 3000);
    } catch { 
      setMensagem('Erro ao salvar. Tente novamente.'); 
    } finally { 
      setSalvando(false); 
    }
  }

  async function alterarPreferencia(preferencia: PreferenciaPromocional, canal: 'EMAIL' | 'IN_APP') {
    const chave = `${preferencia.origem}:${preferencia.barbeariaId || 'VALEN'}:${canal}`;
    const campo = canal === 'EMAIL' ? 'emailHabilitado' : 'inAppHabilitado';
    setAlterandoPreferencia(chave);
    setMensagem('');
    try {
      await clienteApi.put('/cliente/preferencias-promocionais', {
        origem: preferencia.origem,
        barbeariaId: preferencia.barbeariaId || undefined,
        canal,
        habilitado: !preferencia[campo],
      });
      setPreferencias((atuais) => atuais.map((item) =>
        item.origem === preferencia.origem && item.barbeariaId === preferencia.barbeariaId
          ? { ...item, [campo]: !item[campo] }
          : item
      ));
    } catch (error) {
      const texto = (error as { response?: { data?: { erro?: string } } })?.response?.data?.erro
        || 'Não foi possível atualizar a preferência.';
      setMensagem(`Erro: ${texto}`);
    } finally {
      setAlterandoPreferencia('');
    }
  }

  const handleDesconectar = async (barbId: string) => {
    setModalObj({
      aberto: true,
      titulo: 'Desconectar Barbearia',
      mensagem: 'Desconectar desta barbearia? Você deixará de acessá-la na sua lista rápida.',
      tipo: 'aviso',
      isConfirm: true,
      textoBotao: 'Desconectar',
      onConfirm: async () => {
        try {
          await clienteApi.delete(`/cliente/desconectar-barbearia/${barbId}`);
          setBarbearias(prev => prev.filter(b => b.id !== barbId));
          setModalObj(m => ({ ...m, aberto: false }));
        } catch { 
          setModalObj({ aberto: true, titulo: 'Erro', mensagem: 'Erro ao desconectar', tipo: 'erro', textoBotao: 'Entendi' });
        }
      }
    });
  };

  function handleLogout() {
    logout();
    navigate('/cliente');
  }

  const fmtMonetario = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (carregando) {
    return (
      <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <SkeletonCard style={{ width: '96px', height: '96px', borderRadius: '9999px' }} />
          <SkeletonText lines={2} style={{ width: '40%' }} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <SkeletonCard style={{ height: '80px', width: '100%' }} />
          <SkeletonCard style={{ height: '80px', width: '100%' }} />
          <SkeletonCard style={{ height: '80px', width: '100%' }} />
        </div>
        <SkeletonCard style={{ height: '220px', width: '100%' }} />
      </div>
    );
  }

  // Stats a exibir: usa os locais (por barbearia) quando disponíveis
  const atendimentos = statsLocais?.atendimentos ?? perfil?.stats?.atendimentos ?? 0;
  const faltas       = statsLocais?.faltas       ?? perfil?.stats?.faltas       ?? 0;
  const gastoTotal   = statsLocais?.gastoTotal   ?? perfil?.stats?.gastoTotal   ?? 0;
  const dataRegistro = perfil?.stats?.dataRegistro;

  const tier = getTier(atendimentos);

  return (
    <div className="px-5 py-6 animate-fade-in max-w-2xl mx-auto pb-32 md:pb-16">
      {/* Header do Perfil (Avatar + Badge) */}
      <div className="flex flex-col items-center justify-center text-center mb-8">
        <div className="relative mb-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center bg-[var(--fundo-sidebar)] border-2 border-[var(--cor-primaria)] shadow-md">
            <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '32px', color: 'var(--cor-primaria)', fontWeight: 700 }}>
              {perfil?.usuario.nome ? perfil.usuario.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : <User size={32} />}
            </span>
          </div>
          {tier.show && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] rounded-full px-3 py-1 flex items-center gap-1 shadow-md whitespace-nowrap border border-[var(--borda)]">
              <Medal size={14} weight="fill" />
              <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                {tier.label}
              </span>
            </div>
          )}
        </div>

        <h1 style={{ fontFamily: 'var(--fonte-serif)', fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', marginTop: tier.show ? '10px' : '0' }}>
          {perfil?.usuario.nome || 'Carregando...'}
        </h1>
        <p style={{ fontFamily: 'var(--fonte-interface)', fontSize: '12px', color: 'var(--texto-secundario)', marginTop: '4px' }}>
          {dataRegistro
            ? `Membro desde ${new Date(dataRegistro).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
            : ''}
        </p>
      </div>

      {/* Stats Horizontais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <div className="min-w-0 flex flex-col items-center justify-center py-4 px-2 sm:px-4 rounded-md shadow-sm" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <CalendarCheck size={20} weight="bold" style={{ color: 'var(--cor-primaria)', marginBottom: '8px' }} />
          <span className="tabular-nums tracking-tight" style={{ fontFamily: 'var(--fonte-mono)', fontSize: 'clamp(1.1rem,5vw,1.5rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {atendimentos}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--texto-secundario)', marginTop: '2px', letterSpacing: '0.06em', fontWeight: 600 }}>
            Visitas
          </span>
        </div>

        <div className="min-w-0 flex flex-col items-center justify-center py-4 px-2 sm:px-4 rounded-md shadow-sm" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <CalendarX size={20} weight="bold" style={{ color: 'var(--text-disabled)', marginBottom: '8px' }} />
          <span className="tabular-nums tracking-tight" style={{ fontFamily: 'var(--fonte-mono)', fontSize: 'clamp(1.1rem,5vw,1.5rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {faltas}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--texto-secundario)', marginTop: '2px', letterSpacing: '0.06em', fontWeight: 600 }}>
            Faltas
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1 min-w-0 flex flex-col items-center justify-center py-4 px-2 sm:px-4 rounded-md shadow-sm" style={{ background: 'var(--fundo-sidebar)', border: '1px solid var(--borda)' }}>
          <CurrencyDollar size={20} weight="bold" style={{ color: 'var(--sucesso)', marginBottom: '8px' }} />
          <span className="tabular-nums tracking-tight" style={{ fontFamily: 'var(--fonte-mono)', fontSize: 'clamp(1.1rem,5vw,1.5rem)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {fmtMonetario(gastoTotal)}
          </span>
          <span style={{ fontFamily: 'var(--fonte-interface)', fontSize: '10px', textTransform: 'uppercase', color: 'var(--texto-secundario)', marginTop: '2px', letterSpacing: '0.06em', fontWeight: 600 }}>
            Investido
          </span>
        </div>
      </div>

      {/* Formulário de Dados Pessoais */}
      <div className="mb-8 p-5 rounded-xl bg-[var(--fundo-sidebar)] border border-[var(--borda)] shadow-sm">
        <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>
          <User size={16} weight="bold" /> Dados Pessoais
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block mb-1.5" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>Nome Completo</label>
            <input value={nome} onChange={e => setNome(e.target.value)}
                   className="w-full bg-[var(--fundo-input)] border border-[var(--borda-forte)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--cor-primaria)] transition-colors" />
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>WhatsApp</label>
            <input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000"
                   className="w-full bg-[var(--fundo-input)] border border-[var(--borda-forte)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--cor-primaria)] transition-colors" style={{ fontFamily: 'var(--fonte-mono)' }} />
          </div>
          <div>
            <label htmlFor="perfil-data-nascimento" className="block mb-1.5" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>Data de nascimento</label>
            <input
              id="perfil-data-nascimento"
              type="date"
              value={dataNascimento}
              onChange={e => setDataNascimento(e.target.value)}
              max={dataLocalIso()}
              className="w-full bg-[var(--fundo-input)] border border-[var(--borda-forte)] rounded p-3 text-[var(--text-primary)] font-interface focus:outline-none focus:border-[var(--cor-primaria)] transition-colors"
              style={{ fontFamily: 'var(--fonte-mono)' }}
            />
            {!dataNascimento && (
              <p className="mt-1.5 text-[13px] text-[var(--texto-secundario)]">Data ainda não informada.</p>
            )}
          </div>
          <div>
            <label className="block mb-1.5" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--texto-secundario)', fontWeight: 600 }}>Email (Somente leitura)</label>
            <input value={perfil?.usuario.email || ''} disabled
                   className="w-full bg-[var(--superficie-1)] border border-[var(--borda)] rounded p-3 text-[var(--text-disabled)] font-interface cursor-not-allowed" style={{ fontFamily: 'var(--fonte-mono)' }} />
          </div>

          {mensagem && (
            <div className={`p-3 rounded border text-xs font-interface font-medium flex items-center justify-center ${mensagem.includes('Erro') ? 'bg-[var(--perigo-fundo)] border-[var(--erro)] text-[var(--erro)]' : 'bg-[var(--sucesso-fundo)] border-[var(--sucesso)] text-[var(--sucesso)]'}`}>
              {mensagem}
            </div>
          )}

          <button onClick={salvar} disabled={salvando} className="btn-primary w-full justify-center mt-2 py-3 flex items-center gap-2" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            <FloppyDisk size={18} weight="bold" /> {salvando ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Preferências promocionais: consentimento separado por remetente e canal. */}
      <div className="mb-8 p-5 rounded-xl bg-[var(--fundo-sidebar)] border border-[var(--borda)] shadow-sm">
        <h2 className="mb-2 text-[16px] font-semibold text-[var(--text-primary)]">Comunicações promocionais</h2>
        <p className="mb-4 text-[13px] leading-relaxed text-[var(--texto-secundario)]">
          Escolha separadamente quem pode enviar promoções. Avisos necessários da sua conta e dos seus agendamentos não são alterados aqui.
        </p>
        <div className="flex flex-col gap-3">
          {preferencias.map((preferencia) => (
            <div key={`${preferencia.origem}:${preferencia.barbeariaId || 'VALEN'}`} className="rounded-lg border border-[var(--borda)] bg-[var(--superficie-1)] p-4">
              <p className="mb-3 text-[14px] font-semibold text-[var(--text-primary)]">{preferencia.nome}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {([
                  ['EMAIL', 'Promoções por e-mail', preferencia.emailHabilitado],
                  ['IN_APP', 'Promoções no aplicativo', preferencia.inAppHabilitado],
                ] as const).map(([canal, rotulo, habilitado]) => {
                  const chave = `${preferencia.origem}:${preferencia.barbeariaId || 'VALEN'}:${canal}`;
                  return (
                    <button
                      key={canal}
                      type="button"
                      role="switch"
                      aria-checked={habilitado}
                      disabled={alterandoPreferencia === chave}
                      onClick={() => alterarPreferencia(preferencia, canal)}
                      className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-[var(--borda)] px-3 py-2 text-left text-[13px] text-[var(--text-primary)] transition-colors hover:border-[var(--cor-primaria)] disabled:opacity-60"
                    >
                      <span>{rotulo}</span>
                      <span className={`h-5 w-9 rounded-full p-0.5 transition-colors ${habilitado ? 'bg-[var(--cor-primaria)]' : 'bg-[var(--borda-forte)]'}`} aria-hidden="true">
                        <span className={`block h-4 w-4 rounded-full bg-[var(--texto-inverso)] transition-transform ${habilitado ? 'translate-x-4' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {preferencias.length === 0 && (
            <p className="text-[13px] text-[var(--texto-secundario)]">Nenhuma origem promocional disponível.</p>
          )}
        </div>
      </div>

      {/* Aparência */}
      <div className="mb-8 p-5 rounded-xl bg-[var(--fundo-superficie)] border border-[var(--borda-sutil)] shadow-sm">
        <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>
          <Monitor size={16} weight="bold" /> Aparência
        </h2>
        <SeletorTema />
      </div>

      {/* Barbearias conectadas */}
      {barbearias.length > 0 && (
        <div className="mb-8 p-5 rounded-xl bg-[var(--fundo-sidebar)] border border-[var(--borda)] shadow-sm">
          <h2 className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--fonte-interface)', fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--texto-secundario)', fontWeight: 600 }}>
            <Scissors size={16} weight="bold" /> Minhas Barbearias Conectadas
          </h2>
          <div className="flex flex-col gap-2">
            {barbearias.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3.5 rounded-md transition-colors bg-[var(--superficie-1)] border border-[var(--borda)] hover:border-[var(--cor-primaria)]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--superficie-2)] border border-[var(--borda)] flex items-center justify-center">
                    <Scissors size={14} className="text-[var(--cor-primaria)]" />
                  </div>
                  <span style={{ fontFamily: 'var(--fonte-interface)', fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>{b.nome}</span>
                </div>
                <button
                  onClick={() => handleDesconectar(b.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--borda)] flex-shrink-0 transition-colors"
                  style={{ color: 'var(--erro)' }}
                  aria-label="Desconectar desta barbearia"
                >
                  <LinkBreak size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botão sair */}
      <div className="pt-4">
        <button onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-md transition-all hover:bg-[var(--perigo-fundo)]"
          style={{ background: 'var(--perigo-fundo)', color: 'var(--erro)', border: '1px solid var(--perigo-fundo)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          <SignOut size={18} weight="bold" /> Sair da Conta
        </button>
      </div>

      <ModalAlert 
        aberto={modalObj.aberto} 
        titulo={modalObj.titulo} 
        mensagem={modalObj.mensagem} 
        tipo={modalObj.tipo} 
        isConfirm={modalObj.isConfirm}
        textoBotao={modalObj.textoBotao || 'Entendi'}
        onConfirmar={modalObj.onConfirm}
        onFechar={() => {
          setModalObj(m => ({ ...m, aberto: false }));
        }} 
      />
    </div>
  );
}
