import { useState, useEffect } from 'react';
import { Settings, Save, QrCode } from 'lucide-react';
import api from '../api/client';
import { QRCodeSVG } from 'qrcode.react';
import { FidelidadeConfig } from '../components/admin/FidelidadeConfig';
import { useTema } from '../hooks/useTema';
// @ts-ignore
import { getPalette } from 'colorthief';

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }
  return [0, s, l]; // Apenas S e L importam aqui
}

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
  const { aplicarTema } = useTema();
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
  const [sugestaoCores, setSugestaoCores] = useState<{
    primaria: string;
    secundaria: string;
    fundo: string;
    logoBase64: string;
  } | null>(null);

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
      aplicarTema(barbearia);
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
        <h1 className="text-2xl font-bold font-display tracking-wide text-white">
          Configurações
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minha Barbearia */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow">
          <h2 className="text-xl font-bold mb-4 text-white">Minha Barbearia</h2>
          <form onSubmit={salvarBarbearia} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome da Barbearia</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.nome || ''} onChange={e => setBarbearia({...barbearia, nome: e.target.value})} required />
            </div>
            
            <div className="p-4 bg-fundo border border-zinc-800 rounded space-y-4">
              <h3 className="text-sm font-bold text-[var(--cor-primaria)] uppercase tracking-wider">Identidade Visual</h3>
              
              <div>
                <label className="block text-sm font-medium mb-1">Logo da Barbearia (Max 2MB)</label>
                <div className="flex items-center gap-4">
                  {barbearia.logo && (
                    <img src={barbearia.logo} alt="Logo" className="w-16 h-16 object-cover rounded bg-black/50 border border-[var(--border)]" />
                  )}
                  <input type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml" onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 2 * 1024 * 1024) { alert('Arquivo muito grande (Max 2MB)'); return; }
                      
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const base64 = event.target?.result as string;
                        
                        const img = new Image();
                        img.crossOrigin = "Anonymous";
                        img.onload = () => {
                          const extractColors = async (imageObj: HTMLImageElement) => {
                            try {
                              const palette = await getPalette(imageObj, { colorCount: 3 });
                              if (palette && palette.length >= 3) {
                                const colors = palette.map((p: any) => {
                                   const rgbArray = p.array ? p.array() : p;
                                   const [, s, l] = rgbToHsl(rgbArray[0], rgbArray[1], rgbArray[2]);
                                   return { rgb: rgbArray, hex: rgbToHex(rgbArray[0], rgbArray[1], rgbArray[2]), s, l };
                                });
                                
                                colors.sort((a: any, b: any) => a.l - b.l);
                                const fundo = colors[0]; 
                                
                                const remaining = [colors[1], colors[2]];
                                remaining.sort((a: any, b: any) => b.s - a.s);
                                const primaria = remaining[0];
                                const secundaria = remaining[1];
                                
                                setSugestaoCores({
                                   fundo: fundo.hex,
                                   primaria: primaria.hex,
                                   secundaria: secundaria.hex,
                                   logoBase64: base64
                                });
                              } else {
                                setBarbearia({ ...barbearia, logo: base64 });
                              }
                            } catch (error) {
                              console.error('Erro ColorThief', error);
                              setBarbearia({ ...barbearia, logo: base64 });
                            }
                          };

                          if (file.type === 'image/svg+xml') {
                             const canvas = document.createElement('canvas');
                             canvas.width = img.width || 256;
                             canvas.height = img.height || 256;
                             const ctx = canvas.getContext('2d');
                             if (ctx) {
                               ctx.fillStyle = '#ffffff';
                               ctx.fillRect(0, 0, canvas.width, canvas.height);
                               ctx.drawImage(img, 0, 0);
                               const newImg = new Image();
                               newImg.onload = () => extractColors(newImg);
                               newImg.src = canvas.toDataURL('image/png');
                               return;
                             }
                          }
                          extractColors(img);
                        };
                        img.src = base64;
                      };
                      reader.readAsDataURL(file);
                    }
                  }} className="text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-bold file:bg-[var(--cor-primaria)] file:text-black hover:file:bg-[var(--cor-primaria)] cursor-pointer" />
                </div>
                
                {sugestaoCores && (
                  <div className="mt-4 p-4 border border-emerald-500/30 bg-emerald-500/10 rounded animate-fade-in">
                    <p className="text-sm font-bold text-emerald-400 mb-2">Detectamos estas cores na sua logo. Deseja aplicá-las no sistema?</p>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full border border-zinc-700 shadow" style={{ backgroundColor: sugestaoCores.primaria }}></div>
                        <span className="text-[10px] text-zinc-400">{sugestaoCores.primaria}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full border border-zinc-700 shadow" style={{ backgroundColor: sugestaoCores.secundaria }}></div>
                        <span className="text-[10px] text-zinc-400">{sugestaoCores.secundaria}</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full border border-zinc-700 shadow" style={{ backgroundColor: sugestaoCores.fundo }}></div>
                        <span className="text-[10px] text-zinc-400">{sugestaoCores.fundo}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => {
                        setBarbearia({
                          ...barbearia,
                          logo: sugestaoCores.logoBase64,
                          corPrimaria: sugestaoCores.primaria
                        });
                        setSugestaoCores(null);
                      }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded">
                        Aplicar cores sugeridas
                      </button>
                      <button type="button" onClick={() => {
                        setBarbearia({ ...barbearia, logo: sugestaoCores.logoBase64 });
                        setSugestaoCores(null);
                      }} className="px-3 py-1.5 bg-transparent border border-zinc-600 hover:bg-zinc-800 text-zinc-300 text-xs rounded">
                        Ignorar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Cor Primária (Destaques)</label>
                  <input type="color" className="w-full h-10 bg-transparent rounded cursor-pointer" value={barbearia.corPrimaria || '#ff6b00'} onChange={e => setBarbearia({...barbearia, corPrimaria: e.target.value})} required />
                </div>
              </div>

              <div className="mt-4 p-4 rounded border border-zinc-700 bg-black/20 text-white">
                <p className="text-xs opacity-70 mb-2 uppercase tracking-widest">Preview no App</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 mb-4">
                    {barbearia.logo ? (
                      <img src={barbearia.logo} alt="Logo" className="h-8 object-contain" />
                    ) : (
                       <div className="h-8 w-8 bg-black/20 rounded flex items-center justify-center">L</div>
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

                <button type="button" className="px-4 py-2 rounded font-bold text-black text-sm" style={{ backgroundColor: barbearia.corPrimaria || '#ff6b00', fontFamily: 'var(--fonte-interface)' }}>
                  Agendar Horário
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.slug || ''} onChange={e => setBarbearia({...barbearia, slug: e.target.value})} required />
              <p className="text-xs text-zinc-500 mt-1">Sua url será: {window.location.origin}/cliente/home?slug={barbearia.slug || '...'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.endereco || ''} onChange={e => setBarbearia({...barbearia, endereco: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.telefone || ''} onChange={e => setBarbearia({...barbearia, telefone: e.target.value})} />
            </div>

            {/* Horário de Abertura e Fechamento */}
            <div className="p-4 bg-fundo border border-zinc-800 rounded space-y-3">
              <h3 className="text-sm font-bold text-[var(--cor-primaria)] uppercase tracking-wider">Horário de Funcionamento</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Horário de Abertura</label>
                  <input type="time" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.horarioAbertura || '08:00'} onChange={e => setBarbearia({...barbearia, horarioAbertura: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Horário de Fechamento</label>
                  <input type="time" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.horarioFechamento || '19:00'} onChange={e => setBarbearia({...barbearia, horarioFechamento: e.target.value})} />
                </div>
              </div>

              {/* Toggle Horário de Almoço */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <label htmlFor="toggle-almoco" className="text-sm text-zinc-300 cursor-pointer">
                  Tem horário de almoço?
                </label>
                <button
                  id="toggle-almoco"
                  type="button"
                  onClick={() => setBarbearia({...barbearia, temAlmoco: !barbearia.temAlmoco})}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                  style={{
                    background: barbearia.temAlmoco ? 'var(--amber)' : 'var(--bg-surface2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{
                      transform: barbearia.temAlmoco ? 'translateX(22px)' : 'translateX(4px)',
                    }}
                  />
                </button>
              </div>

              {/* Campos de almoço (visíveis apenas quando toggle ativado) */}
              {barbearia.temAlmoco && (
                <div className="grid grid-cols-2 gap-3 pt-2 animate-fade-in">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Início do Almoço</label>
                    <input type="time" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.horarioAlmocoInicio || '12:00'} onChange={e => setBarbearia({...barbearia, horarioAlmocoInicio: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Fim do Almoço</label>
                    <input type="time" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.horarioAlmocoFim || '13:00'} onChange={e => setBarbearia({...barbearia, horarioAlmocoFim: e.target.value})} />
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-fundo border border-zinc-800 rounded flex justify-between items-center">
              <div>
                <p className="text-zinc-400 text-sm">Clientes Cadastrados</p>
                <p className="text-2xl font-bold text-primaria">{barbearia.clientesCount || 0}</p>
              </div>
            </div>

            <button type="submit" disabled={salvandoBarbearia} className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-black font-bold rounded transition-colors">
              <Save size={20} />
              {salvandoBarbearia ? 'Salvando...' : 'Salvar Barbearia'}
            </button>
          </form>
        </div>

        {/* Horários de Funcionamento */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow">
          <h2 className="text-xl font-bold mb-4 text-white">Horário de Funcionamento</h2>
          {erro && <p className="text-[var(--error-text)] mb-4">{erro}</p>}
          
          <form onSubmit={salvar} className="space-y-4">
            {diasSemana.map((dia) => {
              const configDia = horarios[dia.key] || { fechado: true, abertura: '', fechamento: '' };
              
              return (
                <div key={dia.key} className="flex items-center gap-4 p-3 bg-black/20 rounded">
                  <div className="w-32 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`check-${dia.key}`}
                      checked={!configDia.fechado}
                      onChange={(e) => handleChange(dia.key, 'fechado', !e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-black/50 text-[var(--cor-primaria)] focus:ring-[var(--cor-primaria)]"
                    />
                    <label htmlFor={`check-${dia.key}`} className="text-sm font-medium">
                      {dia.label}
                    </label>
                  </div>
                  
                  {!configDia.fechado ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={configDia.abertura || ''}
                        onChange={(e) => handleChange(dia.key, 'abertura', e.target.value)}
                        className="form-input flex-1 p-2 bg-black/50 rounded border border-[var(--border)]"
                        required
                      />
                      <span>às</span>
                      <input
                        type="time"
                        value={configDia.fechamento || ''}
                        onChange={(e) => handleChange(dia.key, 'fechamento', e.target.value)}
                        className="form-input flex-1 p-2 bg-black/50 rounded border border-[var(--border)]"
                        required
                      />
                    </div>
                  ) : (
                    <div className="flex-1 text-sm text-[var(--text-muted)] italic">
                      Fechado
                    </div>
                  )}
                </div>
              );
            })}
            
            <button
              type="submit"
              disabled={salvando}
              className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--cor-primaria)] hover:bg-[var(--cor-primaria)] text-black font-bold rounded transition-colors"
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
            <h2 className="text-xl font-bold text-white">QR Code de Agendamento</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Imprima este QR Code e coloque na sua barbearia para que os clientes possam acessar o seu App.
          </p>
          
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded">
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
          
          <div className="mt-4 p-3 bg-black/30 rounded border border-[var(--border)] text-center break-all text-sm font-mono text-[var(--cor-primaria)]">
            {urlQR}
          </div>

          <button onClick={handleDownloadQR} className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded transition-colors border border-[var(--border)]">
             <QrCode size={20} />
             Baixar QR Code (PNG)
          </button>
        </div>
        
        {/* Programa de Fidelidade */}
        <FidelidadeConfig />
      </div>
    </div>
  );
}
