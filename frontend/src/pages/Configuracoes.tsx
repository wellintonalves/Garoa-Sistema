import { useState, useEffect } from 'react';
import { Gear as Settings, FloppyDisk as Save, QrCode, Star, Desktop, Storefront, Clock, SlidersHorizontal, Copy, CreditCard } from '@phosphor-icons/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { QRCodeSVG } from 'qrcode.react';
import { SeletorTema } from '../components/SeletorTema';
import { Modal } from '../components/Modal';
import { WarningCircle, ArrowRight } from '@phosphor-icons/react';
import { CancelamentoAssinaturaCard } from '../components/CancelamentoAssinaturaCard';
import { GestaoAssinaturaCard } from '../components/GestaoAssinaturaCard';

const diasSemana = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
];

type SecaoConfiguracao = 'barbearia' | 'funcionamento' | 'sistema' | 'assinatura';

export function Configuracoes() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [secaoAtiva, setSecaoAtiva] = useState<SecaoConfiguracao>(() => searchParams.get('secao') === 'assinatura' ? 'assinatura' : 'barbearia');
  useEffect(() => {
    if (searchParams.get('secao') === 'assinatura') setSecaoAtiva('assinatura');
  }, [searchParams]);
  const [horarios, setHorarios] = useState<any>({});
  const [regrasNegocio, setRegrasNegocio] = useState<{ baseCalculoComissao: string; baseCalculoPontos: string }>({
    baseCalculoComissao: 'VALOR_LIQUIDO',
    baseCalculoPontos: 'VALOR_LIQUIDO'
  });
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [horariosReplicados, setHorariosReplicados] = useState(false);

  const [conflitos, setConflitos] = useState<any[]>([]);
  const [mostrarModalConflitos, setMostrarModalConflitos] = useState(false);

  useEffect(() => {
    carregarConfiguracao();
  }, []);

  async function carregarConfiguracao() {
    try {
      const res = await api.get('/configuracoes');
      setHorarios(res.data.horariosFuncionamento || {});
      setRegrasNegocio({
        baseCalculoComissao: res.data.baseCalculoComissao || 'VALOR_LIQUIDO',
        baseCalculoPontos: res.data.baseCalculoPontos || 'VALOR_LIQUIDO'
      });
    } catch (error) {
      setErro('Erro ao carregar configurações');
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await api.put('/configuracoes', {
        horariosFuncionamento: horarios,
        baseCalculoComissao: regrasNegocio.baseCalculoComissao,
        baseCalculoPontos: regrasNegocio.baseCalculoPontos
      });
      if (res.data.conflitosGerados && res.data.conflitosGerados.length > 0) {
        setConflitos(res.data.conflitosGerados);
        setMostrarModalConflitos(true);
      } else {
        alert('Configurações salvas com sucesso!');
      }
    } catch (error) {
      alert('Erro ao salvar configurações');
    } finally {
      setSalvando(false);
    }
  }

  function handleChange(dia: string, campo: string, valor: any) {
    setHorarios((prev: any) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [campo]: valor
      }
    }));
  }

  function replicarSegundaNosDiasUteis() {
    const horarioSegunda = horarios.segunda;
    if (!horarioSegunda) return;

    setHorarios((prev: any) => ({
      ...prev,
      terca: { ...horarioSegunda },
      quarta: { ...horarioSegunda },
      quinta: { ...horarioSegunda },
      sexta: { ...horarioSegunda },
    }));
    setHorariosReplicados(true);
    window.setTimeout(() => setHorariosReplicados(false), 2500);
  }

  const [barbearia, setBarbearia] = useState<any>({});
  const [salvandoBarbearia, setSalvandoBarbearia] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);

  async function carregarMinhaBarbearia() {
    try {
      const res = await api.get('/configuracoes/minha-barbearia');
      setBarbearia(res.data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    carregarMinhaBarbearia();
  }, []);

  async function salvarBarbearia(e: React.FormEvent) {
    e.preventDefault();
    setSalvandoBarbearia(true);
    try {
      await api.put('/configuracoes/minha-barbearia', barbearia);
      alert('Dados da barbearia atualizados!');
    } catch (error) {
      alert('Erro ao atualizar barbearia');
    } finally {
      setSalvandoBarbearia(false);
    }
  }

  const handleDownloadQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
         ctx.fillStyle = 'white';
         ctx.fillRect(0,0, canvas.width, canvas.height);
         ctx.drawImage(img, 0, 0);
         const pngFile = canvas.toDataURL('image/png');
         const downloadLink = document.createElement('a');
         downloadLink.download = `${barbearia.slug || 'barbearia'}-qrcode.png`;
         downloadLink.href = `${pngFile}`;
         downloadLink.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const urlQR = barbearia.slug ? `${window.location.origin}/cliente/home?slug=${barbearia.slug}` : window.location.origin;

  if (carregando) {
    return <div className="p-6">Carregando configurações...</div>;
  }

  const secoes: Array<{ id: SecaoConfiguracao; label: string; descricao: string; icon: typeof Storefront }> = [
    { id: 'barbearia', label: 'Barbearia', descricao: 'Dados, identidade visual e acesso por QR Code', icon: Storefront },
    { id: 'funcionamento', label: 'Horários', descricao: 'Dias, horários e intervalos', icon: Clock },
    { id: 'sistema', label: 'Sistema', descricao: 'Regras, fidelidade e aparência', icon: SlidersHorizontal },
    { id: 'assinatura', label: 'Assinatura', descricao: 'Plano atual, cobrança e cancelamento', icon: CreditCard },
  ];

  return (
    <div className="animate-fade-in space-y-6 max-w-[1280px] mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-[10px] bg-[rgba(var(--cor-primaria-rgb),0.15)] flex items-center justify-center shrink-0">
          <Settings className="text-[var(--cor-primaria)]" size={20} />
        </div>
        <div>
          <h1 className="text-[32px] leading-tight font-bold text-[var(--texto-principal)]">
            Configurações
          </h1>
          <p className="text-[13px] text-[var(--texto-secundario)] mt-1">
            Organize os dados da barbearia, o funcionamento e as regras do sistema
          </p>
        </div>
      </div>

      <nav aria-label="Seções das configurações" className="flex gap-1 p-1 bg-[var(--bg-surface)] border border-[var(--border)] rounded-[10px] overflow-x-auto">
        {secoes.map((secao) => {
          const Icone = secao.icon;
          const ativa = secaoAtiva === secao.id;
          return (
            <button
              key={secao.id}
              type="button"
              aria-current={ativa ? 'page' : undefined}
              onClick={() => setSecaoAtiva(secao.id)}
              className="flex-1 min-w-max min-h-12 md:min-h-10 px-2 sm:px-4 rounded-[7px] flex items-center justify-center gap-1 sm:gap-2 text-sm font-semibold transition-colors"
              style={{
                background: ativa ? 'var(--cor-primaria)' : 'transparent',
                color: ativa ? 'var(--texto-sobre-primaria)' : 'var(--texto-secundario)',
              }}
              title={secao.descricao}
            >
              <Icone size={18} />
              {secao.label}
            </button>
          );
        })}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minha Barbearia */}
        {secaoAtiva === 'barbearia' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 text-[var(--texto-principal)]">Minha barbearia</h2>
          <form onSubmit={salvarBarbearia} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome da barbearia</label>
              <input type="text" className="form-input w-full min-h-10 p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded-lg" value={barbearia.nome || ''} onChange={e => setBarbearia({...barbearia, nome: e.target.value})} required />
            </div>
            
            <div className="p-4 bg-fundo border bg-[var(--superficie-2)] border-[var(--borda)] rounded-lg space-y-4">
              <h3 className="text-base font-semibold text-[var(--texto-principal)]">Identidade visual</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Logo da barbearia (máx. 2 MB)</label>
                <div className="flex items-center gap-4 max-w-full overflow-hidden">
                  {barbearia.logo && (
                    <img src={barbearia.logo} alt="Logo" className="w-16 h-16 object-cover rounded bg-[var(--superficie)] border border-[var(--border)] flex-shrink-0" />
                  )}
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                      <label htmlFor="logo-upload" className="cursor-pointer bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-semibold px-4 rounded-lg text-sm whitespace-nowrap flex-shrink-0 hover:opacity-90 transition-opacity min-h-12 md:min-h-10 flex items-center">
                        Escolher arquivo
                      </label>
                      <span className="text-sm text-[var(--texto-secundario)] truncate">
                        {nomeArquivo ? nomeArquivo : 'Nenhum arquivo selecionado'}
                      </span>
                    </div>
                    <input id="logo-upload" type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setNomeArquivo(file.name);
                        if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande (máx. 2 MB)'); return; }
                      
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const base64 = event.target?.result as string;
                          setBarbearia({ ...barbearia, logo: base64 });
                        };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 rounded-lg border bg-[var(--superficie-2)] border-[var(--borda)] bg-[var(--superficie)] text-[var(--texto-principal)]">
                <p className="text-[13px] text-[var(--texto-secundario)] mb-2">Prévia no aplicativo</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    {barbearia.logo ? (
                      <img src={barbearia.logo} alt="Logo" className="h-8 object-contain" />
                    ) : (
                       <div className="h-8 w-8 bg-[var(--superficie)] rounded flex items-center justify-center">L</div>
                    )}
                    <p className="text-xl m-0 font-bold" style={{ fontFamily: 'var(--fonte-interface)' }}>
                      {barbearia.nome || 'GAROA BARBEARIA'}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p style={{ fontFamily: 'var(--fonte-interface)' }}>Corte Social — João Silva</p>
                  <p className="mt-1" style={{ fontFamily: 'var(--fonte-numeros)' }}>R$ 45,00 — 10:30</p>
                </div>

                <button type="button" className="px-4 rounded-lg font-semibold text-[var(--texto-sobre-primaria)] text-sm min-h-12 md:min-h-10" style={{ backgroundColor: 'var(--cor-primaria)', fontFamily: 'var(--fonte-interface)' }}>
                  Agendar horário
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input type="text" className="form-input w-full min-h-10 p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded-lg" value={barbearia.slug || ''} onChange={e => setBarbearia({...barbearia, slug: e.target.value})} required />
              <p className="text-[13px] text-[var(--texto-secundario)] mt-1 break-all">Sua URL será: {window.location.origin}/cliente/home?slug={barbearia.slug || '...'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" className="form-input w-full min-h-10 p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded-lg" value={barbearia.endereco || ''} onChange={e => setBarbearia({...barbearia, endereco: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input type="text" className="form-input w-full min-h-10 p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded-lg" value={barbearia.telefone || ''} onChange={e => setBarbearia({...barbearia, telefone: e.target.value})} />
            </div>

            {/* Campos de Horário de Funcionamento removidos (agora centralizados por dia) */}
            
            <div className="p-4 bg-fundo border bg-[var(--superficie-2)] border-[var(--borda)] rounded-lg flex justify-between items-center">
              <div>
                <p className="text-[var(--texto-secundario)] text-sm">Clientes cadastrados</p>
                <p className="text-2xl font-bold text-[var(--cor-primaria)]" style={{ fontFamily: 'var(--fonte-numeros)', fontVariantNumeric: 'tabular-nums' }}>{barbearia.clientesCount || 0}</p>
              </div>
            </div>

            <button type="submit" disabled={salvandoBarbearia} className="mt-4 flex items-center justify-center gap-2 w-full min-h-12 md:min-h-10 px-4 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-semibold rounded-lg transition-colors">
              <Save size={20} />
              {salvandoBarbearia ? 'Salvando...' : 'Salvar barbearia'}
            </button>
          </form>
        </div>
        )}

        {/* Horários de Funcionamento */}
        {secaoAtiva === 'funcionamento' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold mb-1 text-[var(--texto-principal)]">Horário de funcionamento</h2>
              <p className="text-sm text-[var(--texto-secundario)]">Defina os dias, os horários de atendimento e os intervalos de almoço.</p>
            </div>
            <button
              type="button"
              onClick={replicarSegundaNosDiasUteis}
              disabled={!horarios.segunda}
              className="min-h-12 md:min-h-10 px-4 rounded-lg border border-[var(--border)] bg-[var(--superficie-2)] text-[var(--texto-principal)] text-sm font-semibold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto shrink-0"
              title="Copiar a configuração de segunda-feira para terça, quarta, quinta e sexta"
            >
              <Copy size={18} />
              {horariosReplicados ? 'Horários replicados' : 'Replicar segunda-feira'}
            </button>
          </div>
          {erro && <p className="text-[var(--error-text)] mb-4">{erro}</p>}
          
          <form onSubmit={salvar}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {diasSemana.map((dia) => {
              const configDia = horarios[dia.key] || { fechado: true, abertura: '', fechamento: '' };
              
              return (
                <div key={dia.key} className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 bg-[var(--superficie)] border border-[var(--border)] rounded-lg">
                  <div className="min-w-[120px] min-h-10 flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`check-${dia.key}`}
                      checked={!configDia.fechado}
                      onChange={(e) => handleChange(dia.key, 'fechado', !e.target.checked)}
                      className="w-5 h-5 rounded border-[var(--border)] bg-[var(--superficie)] text-[var(--cor-primaria)] focus:ring-[var(--cor-primaria)]"
                    />
                    <label htmlFor={`check-${dia.key}`} className="text-sm font-medium">
                      {dia.label}
                    </label>
                  </div>
                  
                  {!configDia.fechado ? (
                    <div className="flex flex-col gap-2 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={configDia.abertura || ''}
                          onChange={(e) => handleChange(dia.key, 'abertura', e.target.value)}
                          className="form-input flex-1 min-w-0 min-h-10 p-2 bg-[var(--superficie)] rounded-lg border border-[var(--borda-forte)]"
                          required
                        />
                        <span>às</span>
                        <input
                          type="time"
                          value={configDia.fechamento || ''}
                          onChange={(e) => handleChange(dia.key, 'fechamento', e.target.value)}
                          className="form-input flex-1 min-w-0 min-h-10 p-2 bg-[var(--superficie)] rounded-lg border border-[var(--borda-forte)]"
                          required
                        />
                      </div>
                      
                      {/* Almoço */}
                      <div className="flex items-center justify-between mt-1 pt-2 border-t border-[var(--borda)]/50">
                        <label htmlFor={`toggle-almoco-${dia.key}`} className="text-sm text-[var(--texto-secundario)] cursor-pointer">
                          Tem almoço?
                        </label>
                        <button
                          id={`toggle-almoco-${dia.key}`}
                          type="button"
                          onClick={() => handleChange(dia.key, 'temAlmoco', !configDia.temAlmoco)}
                          className="relative inline-flex h-10 w-12 items-center justify-center rounded-full transition-colors"
                          aria-pressed={Boolean(configDia.temAlmoco)}
                        >
                          <span
                            aria-hidden="true"
                            className="absolute h-6 w-11 rounded-full"
                            style={{
                              background: configDia.temAlmoco ? 'var(--cor-primaria)' : 'var(--bg-surface2)',
                              border: '1px solid var(--border)',
                            }}
                          />
                          <span
                            className="relative inline-block h-4 w-4 transform rounded-full bg-[var(--superficie)] transition-transform"
                            style={{
                              transform: configDia.temAlmoco ? 'translateX(10px)' : 'translateX(-10px)',
                            }}
                          />
                        </button>
                      </div>
                      
                      {configDia.temAlmoco && (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <input
                            type="time"
                            value={configDia.almocoInicio || ''}
                            onChange={(e) => handleChange(dia.key, 'almocoInicio', e.target.value)}
                            className="form-input flex-1 min-w-0 min-h-10 p-2 bg-[var(--superficie)] rounded-lg border border-[var(--borda-forte)] text-sm"
                            required
                          />
                          <span className="text-sm text-[var(--texto-secundario)]">às</span>
                          <input
                            type="time"
                            value={configDia.almocoFim || ''}
                            onChange={(e) => handleChange(dia.key, 'almocoFim', e.target.value)}
                            className="form-input flex-1 min-w-0 min-h-10 p-2 bg-[var(--superficie)] rounded-lg border border-[var(--borda-forte)] text-sm"
                            required
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-[var(--texto-secundario)] italic">
                      Fechado
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            
            <button
              type="submit"
              disabled={salvando}
              className="mt-6 flex items-center justify-center gap-2 w-full min-h-12 md:min-h-10 px-4 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-semibold rounded-lg transition-colors"
            >
              <Save size={20} />
              {salvando ? 'Salvando...' : 'Salvar horários'}
            </button>
          </form>
        </div>
        )}

        {/* QR Code */}
        {secaoAtiva === 'barbearia' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-fit">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="text-[var(--cor-primaria)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--texto-principal)]">QR Code de agendamento</h2>
          </div>
          <p className="text-sm text-[var(--texto-secundario)] mb-6">
            Imprima este QR Code e coloque na barbearia para que os clientes acessem o aplicativo.
          </p>
          
          <div className="flex flex-col items-center justify-center p-6 bg-[var(--superficie)] rounded-lg">
            <QRCodeSVG 
              id="qr-code-svg" 
              value={urlQR} 
              size={200} 
              level="H" 
              includeMargin={true}
              imageSettings={barbearia.logo ? {
                src: barbearia.logo,
                x: undefined,
                y: undefined,
                height: 48,
                width: 48,
                excavate: true,
              } : undefined}
            />
          </div>
          
          <div className="mt-4 p-3 bg-[var(--superficie)] rounded-lg border border-[var(--border)] text-center break-all text-sm font-mono text-[var(--cor-primaria)]">
            {urlQR}
          </div>

          <button onClick={handleDownloadQR} className="mt-4 w-full min-h-12 md:min-h-10 px-4 flex items-center justify-center gap-2 bg-[var(--superficie-2)] hover:bg-[var(--superficie-2)] text-[var(--texto-principal)] font-semibold rounded-lg transition-colors border border-[var(--border)]">
             <QrCode size={20} />
             Baixar QR Code (PNG)
          </button>
        </div>
        )}
        
        {/* Programa de Fidelidade — link para a página dedicada */}
        {secaoAtiva === 'sistema' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(var(--cor-primaria-rgb), 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} color="var(--cor-primaria)" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--texto-principal)]">Programa de fidelidade</h2>
                <p className="text-sm text-[var(--texto-secundario)] mt-0.5">Configure pontos, recompensas e acompanhe clientes</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/fidelidade')}
              className="flex items-center justify-center gap-2 px-5 min-h-12 md:min-h-10 rounded-lg font-semibold text-sm transition-colors w-full sm:w-auto"
              style={{ background: 'var(--cor-primaria)', color: 'var(--texto-sobre-primaria)', border: 'none', cursor: 'pointer' }}
            >
              <Star size={16} />
              Gerenciar fidelidade
            </button>
          </div>
        </div>
        )}

        {/* Regras de Negócio */}
        {secaoAtiva === 'sistema' && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 col-span-1 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="text-[var(--cor-primaria)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--texto-principal)]">Regras de negócio</h2>
          </div>
          <p className="text-sm text-[var(--texto-secundario)] mb-6">
            Configure as bases de cálculo globais do sistema quando um desconto é aplicado no checkout.
          </p>

          <form onSubmit={salvar} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--texto-principal)]">Base de cálculo da comissão</label>
                <p className="text-[13px] text-[var(--texto-secundario)] mb-2">Sobre qual valor o percentual do barbeiro será calculado?</p>
                <select 
                  className="ds-input w-full"
                  value={regrasNegocio.baseCalculoComissao}
                  onChange={e => setRegrasNegocio({...regrasNegocio, baseCalculoComissao: e.target.value})}
                >
                  <option value="VALOR_LIQUIDO">Valor líquido (após descontos)</option>
                  <option value="VALOR_BRUTO">Valor bruto (preço cheio do serviço)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-[var(--texto-principal)]">Base de acúmulo de pontos</label>
                <p className="text-[13px] text-[var(--texto-secundario)] mb-2">Se a regra de pontos for "por real gasto", usar qual valor?</p>
                <select 
                  className="ds-input w-full"
                  value={regrasNegocio.baseCalculoPontos}
                  onChange={e => setRegrasNegocio({...regrasNegocio, baseCalculoPontos: e.target.value})}
                >
                  <option value="VALOR_LIQUIDO">Valor líquido (após descontos)</option>
                  <option value="VALOR_BRUTO">Valor bruto (preço cheio do serviço)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="ds-btn ds-btn-primary flex items-center gap-2 min-h-12 md:min-h-10"
              >
                <Save size={20} />
                {salvando ? 'Salvando...' : 'Salvar regras de negócio'}
              </button>
            </div>
          </form>
        </div>
        )}

        {/* Aparência e Preferências */}
        {secaoAtiva === 'sistema' && (
        <div className="bg-[var(--fundo-superficie)] border border-[var(--borda-sutil)] rounded-xl p-6 col-span-1 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Desktop className="text-[var(--cor-primaria)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--texto-principal)]">Preferências de aparência</h2>
          </div>
          <p className="text-sm text-[var(--texto-secundario)] mb-6">
            Alterne entre modo claro ou escuro para a interface do painel administrativo ou prefira seguir o padrão do seu sistema operacional.
          </p>
          <SeletorTema />
        </div>
        )}

        {secaoAtiva === 'assinatura' && (
          <>
            <GestaoAssinaturaCard />
            <CancelamentoAssinaturaCard nomeBarbearia={barbearia.nome || ''} />
          </>
        )}
      </div>

      <Modal
        aberto={mostrarModalConflitos}
        onFechar={() => setMostrarModalConflitos(false)}
        titulo="Atenção: conflitos na agenda"
        largura="max-w-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border" style={{ backgroundColor: 'rgba(var(--cor-erro-rgb), 0.1)', borderColor: 'var(--cor-erro)', color: 'var(--cor-erro)' }}>
            <WarningCircle size={24} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-bold mb-1">O horário de funcionamento foi alterado com sucesso, porém {conflitos.length} agendamento(s) futuro(s) ficaram fora do expediente.</p>
              <p className="text-sm opacity-90">Eles não foram apagados. Por favor, verifique a lista abaixo e reagende-os com os clientes.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[var(--superficie-2)] text-[var(--texto-secundario)]">
                <tr>
                  <th className="p-3 font-medium">Data / Hora</th>
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">Barbeiro</th>
                  <th className="p-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] bg-[var(--superficie)]">
                {conflitos.map((c, idx) => {
                  const dataObj = new Date(c.dataHora);
                  const dhFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={idx}>
                      <td className="p-3 text-[var(--texto-principal)]">{dhFormatada}</td>
                      <td className="p-3 text-[var(--texto-principal)]">{c.cliente || 'Sem nome'}</td>
                      <td className="p-3 text-[var(--texto-principal)]">{c.barbeiro || 'Sem preferência'}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setMostrarModalConflitos(false);
                            const dataIso = dataObj.toISOString().split('T')[0];
                            navigate(`/admin/agenda?data=${dataIso}`);
                          }}
                          className="inline-flex items-center gap-1 text-[var(--cor-primaria)] hover:underline font-medium min-h-10"
                        >
                          Tratar
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setMostrarModalConflitos(false)}
              className="ds-btn ds-btn-primary min-h-12 md:min-h-10"
            >
              Ciente
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
