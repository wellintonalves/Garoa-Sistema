import { useState, useEffect } from 'react';
import { Gear as Settings, FloppyDisk as Save, QrCode, Star } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { QRCodeSVG } from 'qrcode.react';

const diasSemana = [
  { key: 'domingo', label: 'Domingo' },
  { key: 'segunda', label: 'Segunda-feira' },
  { key: 'terca', label: 'Terça-feira' },
  { key: 'quarta', label: 'Quarta-feira' },
  { key: 'quinta', label: 'Quinta-feira' },
  { key: 'sexta', label: 'Sexta-feira' },
  { key: 'sabado', label: 'Sábado' },
];

export function Configuracoes() {
  const navigate = useNavigate();
  const [horarios, setHorarios] = useState<any>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);



  useEffect(() => {
    carregarConfiguracao();
  }, []);

  async function carregarConfiguracao() {
    try {
      const res = await api.get('/configuracoes');
      setHorarios(res.data.horariosFuncionamento || {});
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
      await api.put('/configuracoes', {
        horariosFuncionamento: horarios
      });
      alert('Configurações salvas com sucesso!');
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

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="text-[var(--cor-primaria)]" size={24} />
        <h1 className="text-2xl font-bold font-display tracking-wide text-[var(--texto-principal)]">
          Configurações
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minha Barbearia */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow">
          <h2 className="text-xl font-bold mb-4 text-[var(--texto-principal)]">Minha Barbearia</h2>
          <form onSubmit={salvarBarbearia} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome da Barbearia</label>
              <input type="text" className="form-input w-full p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded" value={barbearia.nome || ''} onChange={e => setBarbearia({...barbearia, nome: e.target.value})} required />
            </div>
            
            <div className="p-4 bg-fundo border bg-[var(--superficie-2)] border-[var(--borda)] rounded space-y-4">
              <h3 className="text-sm font-bold text-[var(--cor-primaria)] uppercase tracking-wider">Identidade Visual</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Logo da Barbearia (Max 2MB)</label>
                <div className="flex items-center gap-4 max-w-full overflow-hidden">
                  {barbearia.logo && (
                    <img src={barbearia.logo} alt="Logo" className="w-16 h-16 object-cover rounded bg-[var(--superficie)] border border-[var(--border)] flex-shrink-0" />
                  )}
                  <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <div className="flex items-center gap-2 max-w-full overflow-hidden">
                      <label htmlFor="logo-upload" className="cursor-pointer bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-bold px-4 py-2 rounded text-sm whitespace-nowrap flex-shrink-0 hover:opacity-90 transition-opacity">
                        Escolher Arquivo
                      </label>
                      <span className="text-sm text-[var(--texto-secundario)] truncate">
                        {nomeArquivo ? nomeArquivo : 'Nenhum arquivo selecionado'}
                      </span>
                    </div>
                    <input id="logo-upload" type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" className="hidden" onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setNomeArquivo(file.name);
                        if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande (Max 2MB)'); return; }
                      
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

              <div className="mt-4 p-4 rounded border bg-[var(--superficie-2)] border-[var(--borda)] bg-[var(--superficie)] text-[var(--texto-principal)]">
                <p className="text-xs opacity-70 mb-2 uppercase tracking-widest">Preview no App</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    {barbearia.logo ? (
                      <img src={barbearia.logo} alt="Logo" className="h-8 object-contain" />
                    ) : (
                       <div className="h-8 w-8 bg-[var(--superficie)] rounded flex items-center justify-center">L</div>
                    )}
                    <h1 className="text-2xl m-0 font-bold" style={{ fontFamily: 'var(--fonte-interface)' }}>
                      {barbearia.nome || 'GAROA BARBEARIA'}
                    </h1>
                  </div>
                </div>

                <div className="mb-4">
                  <p style={{ fontFamily: 'var(--fonte-interface)' }}>Corte Social — João Silva</p>
                  <p className="mt-1" style={{ fontFamily: 'var(--fonte-numeros)' }}>R$ 45,00 — 10:30</p>
                </div>

                <button type="button" className="px-4 py-2 rounded font-bold text-[var(--texto-sobre-primaria)] text-sm" style={{ backgroundColor: 'var(--cor-primaria)', fontFamily: 'var(--fonte-interface)' }}>
                  Agendar Horário
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input type="text" className="form-input w-full p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded" value={barbearia.slug || ''} onChange={e => setBarbearia({...barbearia, slug: e.target.value})} required />
              <p className="text-xs text-[var(--texto-secundario)] mt-1 break-all">Sua url será: {window.location.origin}/cliente/home?slug={barbearia.slug || '...'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" className="form-input w-full p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded" value={barbearia.endereco || ''} onChange={e => setBarbearia({...barbearia, endereco: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input type="text" className="form-input w-full p-2 bg-[var(--superficie)] border border-[var(--borda-forte)] rounded" value={barbearia.telefone || ''} onChange={e => setBarbearia({...barbearia, telefone: e.target.value})} />
            </div>

            {/* Campos de Horário de Funcionamento removidos (agora centralizados por dia) */}
            
            <div className="p-4 bg-fundo border bg-[var(--superficie-2)] border-[var(--borda)] rounded flex justify-between items-center">
              <div>
                <p className="text-[var(--texto-secundario)] text-sm">Clientes Cadastrados</p>
                <p className="text-2xl font-bold text-primaria">{barbearia.clientesCount || 0}</p>
              </div>
            </div>

            <button type="submit" disabled={salvandoBarbearia} className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-bold rounded transition-colors">
              <Save size={20} />
              {salvandoBarbearia ? 'Salvando...' : 'Salvar Barbearia'}
            </button>
          </form>
        </div>

        {/* Horários de Funcionamento */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow">
          <h2 className="text-xl font-bold mb-4 text-[var(--texto-principal)]">Horário de Funcionamento</h2>
          {erro && <p className="text-[var(--error-text)] mb-4">{erro}</p>}
          
          <form onSubmit={salvar} className="space-y-4">
            {diasSemana.map((dia) => {
              const configDia = horarios[dia.key] || { fechado: true, abertura: '', fechamento: '' };
              
              return (
                <div key={dia.key} className="flex flex-wrap items-center gap-3 p-3 bg-[var(--superficie)] rounded">
                  <div className="min-w-[120px] flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`check-${dia.key}`}
                      checked={!configDia.fechado}
                      onChange={(e) => handleChange(dia.key, 'fechado', !e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--superficie)] text-[var(--cor-primaria)] focus:ring-[var(--cor-primaria)]"
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
                          className="form-input flex-1 p-2 bg-[var(--superficie)] rounded border border-[var(--borda-forte)]"
                          required
                        />
                        <span>às</span>
                        <input
                          type="time"
                          value={configDia.fechamento || ''}
                          onChange={(e) => handleChange(dia.key, 'fechamento', e.target.value)}
                          className="form-input flex-1 p-2 bg-[var(--superficie)] rounded border border-[var(--borda-forte)]"
                          required
                        />
                      </div>
                      
                      {/* Almoço */}
                      <div className="flex items-center justify-between mt-1 pt-2 border-t bg-[var(--superficie-2)] border-[var(--borda)]/50">
                        <label htmlFor={`toggle-almoco-${dia.key}`} className="text-sm text-[var(--texto-secundario)] cursor-pointer">
                          Tem almoço?
                        </label>
                        <button
                          id={`toggle-almoco-${dia.key}`}
                          type="button"
                          onClick={() => handleChange(dia.key, 'temAlmoco', !configDia.temAlmoco)}
                          className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
                          style={{
                            background: configDia.temAlmoco ? 'var(--amber)' : 'var(--bg-surface2)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          <span
                            className="inline-block h-3 w-3 transform rounded-full bg-[var(--superficie)] transition-transform"
                            style={{
                              transform: configDia.temAlmoco ? 'translateX(16px)' : 'translateX(2px)',
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
                            className="form-input flex-1 p-2 bg-[var(--superficie)] rounded border border-[var(--borda-forte)] text-sm"
                            required
                          />
                          <span className="text-sm text-[var(--texto-secundario)]">às</span>
                          <input
                            type="time"
                            value={configDia.almocoFim || ''}
                            onChange={(e) => handleChange(dia.key, 'almocoFim', e.target.value)}
                            className="form-input flex-1 p-2 bg-[var(--superficie)] rounded border border-[var(--borda-forte)] text-sm"
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
            
            <button
              type="submit"
              disabled={salvando}
              className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-[var(--texto-sobre-primaria)] font-bold rounded transition-colors"
            >
              <Save size={20} />
              {salvando ? 'Salvando...' : 'Salvar Horários'}
            </button>
          </form>
        </div>

        {/* QR Code */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow h-fit">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="text-[var(--cor-primaria)]" size={24} />
            <h2 className="text-xl font-bold text-[var(--texto-principal)]">QR Code de Agendamento</h2>
          </div>
          <p className="text-sm text-[var(--texto-secundario)] mb-6">
            Imprima este QR Code e coloque na sua barbearia para que os clientes possam acessar o seu App.
          </p>
          
          <div className="flex flex-col items-center justify-center p-6 bg-[var(--superficie)] rounded">
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
          
          <div className="mt-4 p-3 bg-[var(--superficie)] rounded border border-[var(--border)] text-center break-all text-sm font-mono text-[var(--cor-primaria)]">
            {urlQR}
          </div>

          <button onClick={handleDownloadQR} className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-[var(--superficie-2)] border-[var(--borda)] hover:bg-[var(--superficie-2)] border-[var(--borda)] text-[var(--texto-principal)] font-bold rounded transition-colors border border-[var(--border)]">
             <QrCode size={20} />
             Baixar QR Code (PNG)
          </button>
        </div>
        
        {/* Programa de Fidelidade — link para a página dedicada */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow col-span-1 lg:col-span-2 mt-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(var(--cor-primaria-rgb), 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} color="var(--cor-primaria)" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--texto-principal)]">Programa de Fidelidade</h3>
                <p className="text-sm text-[var(--texto-secundario)] mt-0.5">Configure pontos, recompensas e acompanhe clientes</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/admin/fidelidade')}
              className="flex items-center gap-2 px-5 py-2.5 rounded font-semibold text-sm transition-colors"
              style={{ background: 'var(--cor-primaria)', color: 'var(--texto-sobre-primaria)', border: 'none', cursor: 'pointer' }}
            >
              <Star size={16} />
              Gerenciar Fidelidade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
