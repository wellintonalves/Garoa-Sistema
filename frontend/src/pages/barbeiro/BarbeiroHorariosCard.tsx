import { useState, useEffect } from 'react';
import { Clock, Save, Copy, Info } from 'lucide-react';
import barbeiroApi from '../../api/barbeiroApi';

export interface DiaConfig {
  fechado: boolean;
  abertura?: string;
  fechamento?: string;
  temAlmoco?: boolean;
  almocoInicio?: string;
  almocoFim?: string;
}

interface Props {
  horariosIniciais: any;
  onSuccess: () => void;
  mostrarErro: (msg: string) => void;
  mostrarSucesso: (msg: string) => void;
}

const DIAS_SEMANA = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];
const NOMES_DIAS: Record<string, string> = {
  segunda: 'Segunda-feira',
  terca: 'Terça-feira',
  quarta: 'Quarta-feira',
  quinta: 'Quinta-feira',
  sexta: 'Sexta-feira',
  sabado: 'Sábado',
  domingo: 'Domingo'
};

const DEFAULT_DIA: DiaConfig = {
  fechado: false,
  abertura: '09:00',
  fechamento: '18:00',
  temAlmoco: false,
  almocoInicio: '12:00',
  almocoFim: '13:00'
};

export function BarbeiroHorariosCard({ horariosIniciais, onSuccess, mostrarErro, mostrarSucesso }: Props) {
  const [horarios, setHorarios] = useState<Record<string, DiaConfig>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    // Inicializa com os dados do banco ou cria o default
    const iniciais = horariosIniciais || {};
    const novoHorarios: Record<string, DiaConfig> = {};
    DIAS_SEMANA.forEach(dia => {
      if (iniciais[dia]) {
        novoHorarios[dia] = { ...iniciais[dia] };
      } else {
        novoHorarios[dia] = { ...DEFAULT_DIA, fechado: dia === 'domingo' };
      }
    });
    setHorarios(novoHorarios);
  }, [horariosIniciais]);

  const handleChange = (dia: string, field: keyof DiaConfig, value: any) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        [field]: value
      }
    }));
  };

  const copiarSegundaParaUteis = () => {
    if (!horarios['segunda']) return;
    const ref = { ...horarios['segunda'] };
    setHorarios(prev => ({
      ...prev,
      terca: { ...ref },
      quarta: { ...ref },
      quinta: { ...ref },
      sexta: { ...ref }
    }));
    mostrarSucesso('Horários da segunda copiados para terça a sexta.');
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await barbeiroApi.put('/barbeiro/perfil', {
        horariosTrabalho: horarios
      });
      mostrarSucesso('Horários atualizados e aplicados à agenda!');
      onSuccess();
    } catch (err: any) {
      mostrarErro(err.response?.data?.erro || 'Erro ao salvar horários');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 rounded-2xl border flex flex-col gap-6 md:col-span-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ background: 'var(--bg-surface2)' }}>
            <Clock size={16} style={{ color: 'var(--cor-primaria)' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
              Seus Horários de Trabalho
            </h3>
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Info size={12} /> Define a sua disponibilidade na agenda
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={copiarSegundaParaUteis} className="btn-secondary text-xs px-3 py-2 flex items-center gap-1" title="Copiar Segunda para Terça-Sexta">
            <Copy size={12} /> Copiar Segunda p/ Úteis
          </button>
          <button onClick={salvar} disabled={salvando} className="btn-primary text-xs px-4 py-2 flex items-center gap-1">
            {salvando ? 'Salvando...' : <><Save size={12} /> Salvar</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {DIAS_SEMANA.map(dia => {
          const conf = horarios[dia] || DEFAULT_DIA;
          return (
            <div key={dia} className="flex flex-col xl:flex-row xl:items-center gap-4 p-4 rounded-xl border transition-colors" style={{ borderColor: conf.fechado ? 'var(--border)' : 'var(--cor-primaria)', background: conf.fechado ? 'var(--bg-surface2)' : 'transparent', opacity: conf.fechado ? 0.7 : 1 }}>
              
              <div className="flex items-center justify-between xl:w-48">
                <span className="font-semibold text-sm capitalize" style={{ color: 'var(--text-primary)' }}>
                  {NOMES_DIAS[dia]}
                </span>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
                  <span style={{ color: conf.fechado ? 'var(--error-text)' : 'var(--success-text)' }}>
                    {conf.fechado ? 'Folga' : 'Trabalho'}
                  </span>
                  <input type="checkbox" className="hidden" checked={!conf.fechado} onChange={(e) => handleChange(dia, 'fechado', !e.target.checked)} />
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${conf.fechado ? 'bg-gray-300 dark:bg-gray-700' : ''}`} style={{ background: conf.fechado ? '' : 'var(--cor-primaria)' }}>
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${conf.fechado ? 'left-0.5' : 'translate-x-4'}`} />
                  </div>
                </label>
              </div>

              {!conf.fechado && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Das</span>
                    <input type="time" value={conf.abertura} onChange={e => handleChange(dia, 'abertura', e.target.value)} className="ds-input py-1 px-2 text-sm w-24" />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>às</span>
                    <input type="time" value={conf.fechamento} onChange={e => handleChange(dia, 'fechamento', e.target.value)} className="ds-input py-1 px-2 text-sm w-24" />
                  </div>

                  <div className="w-[1px] h-6 hidden sm:block" style={{ background: 'var(--border)' }} />

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input type="checkbox" checked={conf.temAlmoco} onChange={e => handleChange(dia, 'temAlmoco', e.target.checked)} className="rounded text-orange-500 focus:ring-orange-500 border-gray-300" />
                      <span style={{ color: 'var(--text-primary)' }}>Tem Intervalo?</span>
                    </label>

                    {conf.temAlmoco && (
                      <div className="flex items-center gap-2">
                        <input type="time" value={conf.almocoInicio} onChange={e => handleChange(dia, 'almocoInicio', e.target.value)} className="ds-input py-1 px-2 text-sm w-24" />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>
                        <input type="time" value={conf.almocoFim} onChange={e => handleChange(dia, 'almocoFim', e.target.value)} className="ds-input py-1 px-2 text-sm w-24" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
