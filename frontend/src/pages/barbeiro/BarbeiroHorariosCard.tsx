import { useEffect, useRef, useState } from "react";
import barbeiroApi from "../../api/barbeiroApi";
import { Botao } from "../../components/ui";
import { message } from "../../components/barbeiro/data";
import { Notice } from "../../components/barbeiro/ui";
export interface DiaConfig {
  fechado: boolean;
  abertura?: string;
  fechamento?: string;
  temAlmoco?: boolean;
  almocoInicio?: string;
  almocoFim?: string;
}
interface Props {
  horariosIniciais: Record<string, DiaConfig> | null;
  onSuccess: () => void;
  mostrarErro: (msg: string) => void;
  mostrarSucesso: (msg: string) => void;
  onSalvar?: (horarios: Record<string, DiaConfig>) => Promise<void>;
  titulo?: string;
}
const days = [
  ["segunda", "Segunda-feira"],
  ["terca", "Terça-feira"],
  ["quarta", "Quarta-feira"],
  ["quinta", "Quinta-feira"],
  ["sexta", "Sexta-feira"],
  ["sabado", "Sábado"],
  ["domingo", "Domingo"],
];
const defaults: DiaConfig = {
  fechado: false,
  abertura: "09:00",
  fechamento: "18:00",
  temAlmoco: false,
  almocoInicio: "12:00",
  almocoFim: "13:00",
};
function initial(value: Props["horariosIniciais"]) {
  return Object.fromEntries(
    days.map(([day]) => [
      day,
      { ...defaults, ...(value?.[day] ?? { fechado: day === "domingo" }) },
    ]),
  ) as Record<string, DiaConfig>;
}
export function BarbeiroHorariosCard({
  horariosIniciais,
  onSuccess,
  mostrarErro,
  mostrarSucesso,
  onSalvar,
  titulo = "Seus horários de trabalho",
}: Props) {
  const [hours, setHours] = useState(() => initial(horariosIniciais));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) setHours(initial(horariosIniciais));
  }, [horariosIniciais]);
  function change(
    day: string,
    field: keyof DiaConfig,
    value: string | boolean,
  ) {
    dirty.current = true;
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    for (const [day, name] of days) {
      const h = hours[day];
      if (
        !h.fechado &&
        (!h.abertura || !h.fechamento || h.abertura >= h.fechamento)
      ) {
        setError(`${name}: o fim do expediente deve ser posterior ao início.`);
        return;
      }
      if (
        !h.fechado &&
        h.temAlmoco &&
        (!h.almocoInicio ||
          !h.almocoFim ||
          h.almocoInicio >= h.almocoFim ||
          h.almocoInicio < h.abertura! ||
          h.almocoFim > h.fechamento!)
      ) {
        setError(
          `${name}: o intervalo deve estar dentro do expediente, com fim posterior ao início.`,
        );
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (onSalvar) await onSalvar(hours);
      else
        await barbeiroApi.put("/barbeiro/perfil", { horariosTrabalho: hours });
      dirty.current = false;
      mostrarSucesso("Horários salvos e aplicados à agenda.");
      onSuccess();
    } catch (e) {
      setError(message(e));
      mostrarErro(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="bb-hours" onSubmit={save}>
      <h3>{titulo}</h3>
      <p className="bb-muted">
        Defina o expediente e os intervalos de cada dia.
      </p>
      {error && <Notice error>{error}</Notice>}
      <fieldset disabled={busy}>
        {days.map(([day, name]) => {
          const h = hours[day];
          return (
            <div key={day} className="bb-hours-day">
              <div className="bb-hours-heading">
                <strong>{name}</strong>
                <label className="bb-switch">
                  <input
                    type="checkbox"
                    aria-label={`Trabalha ${name}`}
                    checked={!h.fechado}
                    onChange={(e) => change(day, "fechado", !e.target.checked)}
                  />
                  {h.fechado ? "Folga" : "Trabalho"}
                </label>
              </div>
              {!h.fechado && (
                <>
                  <div className="bb-hours-fields">
                    <label className="bb-field">
                      Início do expediente
                      <input
                        className="bb-input"
                        aria-label={`Início ${name}`}
                        type="time"
                        required
                        value={h.abertura}
                        onChange={(e) =>
                          change(day, "abertura", e.target.value)
                        }
                      />
                    </label>
                    <label className="bb-field">
                      Fim do expediente
                      <input
                        className="bb-input"
                        aria-label={`Fim ${name}`}
                        type="time"
                        required
                        value={h.fechamento}
                        onChange={(e) =>
                          change(day, "fechamento", e.target.value)
                        }
                      />
                    </label>
                  </div>
                  <label className="bb-switch">
                    <input
                      type="checkbox"
                      aria-label={`Intervalo ${name}`}
                      checked={!!h.temAlmoco}
                      onChange={(e) =>
                        change(day, "temAlmoco", e.target.checked)
                      }
                    />
                    Intervalo neste dia
                  </label>
                  {h.temAlmoco && (
                    <div className="bb-hours-fields">
                      <label className="bb-field">
                        Início do intervalo
                        <input
                          className="bb-input"
                          aria-label={`Início do intervalo ${name}`}
                          type="time"
                          required
                          value={h.almocoInicio}
                          onChange={(e) =>
                            change(day, "almocoInicio", e.target.value)
                          }
                        />
                      </label>
                      <label className="bb-field">
                        Fim do intervalo
                        <input
                          className="bb-input"
                          aria-label={`Fim do intervalo ${name}`}
                          type="time"
                          required
                          value={h.almocoFim}
                          onChange={(e) =>
                            change(day, "almocoFim", e.target.value)
                          }
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      <div className="bb-actions">
        <Botao
          type="button"
          variante="secundario"
          disabled={busy}
          onClick={() => {
            dirty.current = true;
            setHours((prev) => ({
              ...prev,
              ...Object.fromEntries(
                ["terca", "quarta", "quinta", "sexta"].map((day) => [
                  day,
                  { ...prev.segunda },
                ]),
              ),
            }));
            mostrarSucesso(
              "Segunda-feira copiada para terça a sexta. Salve para aplicar.",
            );
          }}
        >
          Copiar segunda-feira
        </Botao>
        <Botao type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar horários"}
        </Botao>
      </div>
    </form>
  );
}
