import { useState, useEffect } from 'react';
import { Settings, Save, QrCode } from 'lucide-react';
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
  const [horarios, setHorarios] = useState<any>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const urlAgendar = `${window.location.origin}/agendar`;

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
    const ctx = canvas.getContext('new');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
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

  const urlQR = barbearia.slug ? `${window.location.origin}/b/${barbearia.slug}` : window.location.origin;

  if (carregando) {
    return <div className="p-6">Carregando configurações...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="text-[var(--amber)]" size={24} />
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
            <div>
              <label className="block text-sm font-medium mb-1">Slug (URL)</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.slug || ''} onChange={e => setBarbearia({...barbearia, slug: e.target.value})} required />
              <p className="text-xs text-zinc-500 mt-1">Sua url será: {window.location.origin}/b/{barbearia.slug || '...'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cor Primária (Hex)</label>
              <input type="color" className="w-full h-10 bg-transparent rounded cursor-pointer" value={barbearia.corPrimaria || '#ff6b00'} onChange={e => setBarbearia({...barbearia, corPrimaria: e.target.value})} required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.endereco || ''} onChange={e => setBarbearia({...barbearia, endereco: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Telefone</label>
              <input type="text" className="form-input w-full p-2 bg-black/50 border border-[var(--border)] rounded" value={barbearia.telefone || ''} onChange={e => setBarbearia({...barbearia, telefone: e.target.value})} />
            </div>
            
            <div className="p-4 bg-zinc-900 border border-zinc-800 rounded flex justify-between items-center">
              <div>
                <p className="text-zinc-400 text-sm">Clientes Cadastrados</p>
                <p className="text-2xl font-bold text-orange-500">{barbearia.clientesCount || 0}</p>
              </div>
            </div>

            <button type="submit" disabled={salvandoBarbearia} className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--amber)] hover:bg-amber-600 text-black font-bold rounded transition-colors">
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
                      className="w-4 h-4 rounded border-[var(--border)] bg-black/50 text-[var(--amber)] focus:ring-[var(--amber)]"
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
              className="mt-6 flex items-center justify-center gap-2 w-full py-2.5 bg-[var(--amber)] hover:bg-amber-600 text-black font-bold rounded transition-colors"
            >
              <Save size={20} />
              {salvando ? 'Salvando...' : 'Salvar Horários'}
            </button>
          </form>
        </div>

        {/* QR Code */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded p-6 shadow h-fit">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="text-[var(--amber)]" size={24} />
            <h2 className="text-xl font-bold text-white">QR Code de Agendamento</h2>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6">
            Imprima este QR Code e coloque na sua barbearia para que os clientes possam acessar o seu App.
          </p>
          
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded">
            <QRCodeSVG id="qr-code-svg" value={urlQR} size={200} level="H" includeMargin={true} />
          </div>
          
          <div className="mt-4 p-3 bg-black/30 rounded border border-[var(--border)] text-center break-all text-sm font-mono text-[var(--amber)]">
            {urlQR}
          </div>

          <button onClick={handleDownloadQR} className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded transition-colors border border-[var(--border)]">
             <QrCode size={20} />
             Baixar QR Code (PNG)
          </button>
        </div>
      </div>
    </div>
  );
}
