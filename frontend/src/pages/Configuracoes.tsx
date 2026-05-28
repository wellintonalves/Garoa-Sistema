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
            Imprima este QR Code e coloque na sua barbearia para que os clientes possam agendar online.
          </p>
          
          <div className="flex flex-col items-center justify-center p-6 bg-white rounded">
            <QRCodeSVG value={urlAgendar} size={200} level="H" includeMargin={true} />
          </div>
          
          <div className="mt-4 p-3 bg-black/30 rounded border border-[var(--border)] text-center break-all text-sm font-mono text-[var(--amber)]">
            {urlAgendar}
          </div>
        </div>
      </div>
    </div>
  );
}
