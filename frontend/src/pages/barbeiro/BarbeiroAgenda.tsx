import { Fragment, useCallback, useRef, useState } from "react";
import { CaretLeft, CaretRight, Prohibit } from "@phosphor-icons/react";
import { useBarbeiroAuth } from "../../hooks/useBarbeiroAuth";
import barbeiroApi from "../../api/barbeiroApi";
import { Botao } from "../../components/ui";
import {
  PageHeader,
  Notice,
  Loading,
  Empty,
  Dialog,
} from "../../components/barbeiro/ui";
import { AppointmentRow } from "../../components/barbeiro/AppointmentRow";
import {
  type Appointment,
  type Block,
  dayKey,
  dateLabel,
  shiftDay,
  time,
  endTime,
  message,
  useBarberResource,
  notifyBarberChange,
} from "../../components/barbeiro/data";
import { formatarNomeServico } from "../../utils/formato";
export function BarbeiroAgenda() {
  const { barbeiro } = useBarbeiroAuth();
  const [day, setDay] = useState(() => dayKey());
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("TODOS");
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [a, b] = await Promise.all([
        barbeiroApi.get<Appointment[]>("/barbeiro/agenda", {
          signal,
          params: { data: day },
        }),
        barbeiroApi.get<Block[]>("/bloqueios", { signal }),
      ]);
      const start = Date.parse(`${day}T00:00:00-03:00`),
        end = Date.parse(`${shiftDay(day, 1)}T00:00:00-03:00`);
      return {
        appointments: a.data ?? [],
        blocks: (b.data ?? []).filter(
          (b) =>
            Date.parse(b.dataInicio) < end && Date.parse(b.dataFim) > start,
        ),
      };
    },
    [day],
  );
  const { data, loading, error, reload } = useBarberResource(loader);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<Block | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [form, setForm] = useState({
    data: day,
    horaInicio: "",
    horaFim: "",
    motivo: "",
  });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    const start = `${form.data}T${form.horaInicio}:00-03:00`,
      end = `${form.data}T${form.horaFim}:00-03:00`;
    if (Date.parse(end) <= Date.parse(start)) {
      setFormError("O fim deve ser posterior ao início.");
      return;
    }
    if (Date.parse(start) < Date.now()) {
      setFormError("Escolha um horário que ainda não passou.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setFormError("");
    try {
      await barbeiroApi.post("/bloqueios", {
        barbeiroId: barbeiro?.barbeiroId,
        dataInicio: start,
        dataFim: end,
        motivo: form.motivo.trim(),
      });
      setOpen(false);
      setDay(form.data);
      setFeedback("Horário bloqueado. Sua agenda foi atualizada.");
      notifyBarberChange();
    } catch (e) {
      setFormError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (
      !removing ||
      lock.current ||
      confirmation !== (removing.motivo || "Bloqueio")
    )
      return;
    lock.current = true;
    setBusy(true);
    setFormError("");
    try {
      await barbeiroApi.delete(`/bloqueios/${removing.id}`);
      setRemoving(null);
      setFeedback("Bloqueio removido. Sua agenda foi atualizada.");
      notifyBarberChange();
    } catch (e) {
      setFormError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const events = [
    ...(data?.appointments ?? []).map((a) => ({
      id: a.id,
      start: Date.parse(a.dataHora),
      end: endTime(a),
      appointment: a,
      block: null as Block | null,
    })),
    ...(data?.blocks ?? []).map((b) => ({
      id: b.id,
      start: Date.parse(b.dataInicio),
      end: Date.parse(b.dataFim),
      appointment: null as Appointment | null,
      block: b,
    })),
  ].sort((a, b) => a.start - b.start);
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const visible = events.filter((e) => {
    const text = e.appointment
      ? `${e.appointment.cliente.usuario.nome} ${formatarNomeServico(e.appointment)}`
      : e.block?.motivo || "Bloqueio";
    return (
      text.toLocaleLowerCase("pt-BR").includes(query) &&
      (filter === "TODOS" ||
        (filter === "BLOQUEIO" ? !!e.block : e.appointment?.status === filter))
    );
  });
  let occupiedUntil = 0;
  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Seus atendimentos e bloqueios, em ordem de horário."
      >
        <Botao
          onClick={() => {
            setForm({ data: day, horaInicio: "", horaFim: "", motivo: "" });
            setFormError("");
            setOpen(true);
          }}
        >
          <Prohibit size={18} aria-hidden />
          Bloquear horário
        </Botao>
      </PageHeader>
      {feedback && <Notice>{feedback}</Notice>}
      <div className="bb-toolbar">
        <div className="bb-date-controls">
          <Botao
            variante="fantasma"
            aria-label="Dia anterior"
            onClick={() => setDay(shiftDay(day, -1))}
          >
            <CaretLeft size={20} />
          </Botao>
          <label className="bb-field">
            Data
            <input
              className="bb-input"
              type="date"
              value={day}
              onChange={(e) => {
                if (e.target.value) setDay(e.target.value);
              }}
            />
          </label>
          <Botao
            variante="fantasma"
            aria-label="Próximo dia"
            onClick={() => setDay(shiftDay(day, 1))}
          >
            <CaretRight size={20} />
          </Botao>
          <Botao variante="secundario" onClick={() => setDay(dayKey())}>
            Hoje
          </Botao>
        </div>
        <label className="bb-field bb-search">
          Buscar na agenda
          <input
            className="bb-input"
            type="search"
            placeholder="Cliente, serviço ou bloqueio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="bb-field bb-filter">
          Exibir
          <select
            aria-label="Exibir"
            className="bb-input"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="TODOS">Todos</option>
            <option value="CONFIRMADO">Confirmados</option>
            <option value="AGUARDANDO">Aguardando</option>
            <option value="CONCLUIDO">Concluídos</option>
            <option value="BLOQUEIO">Bloqueios</option>
          </select>
        </label>
      </div>
      <div className="bb-section-heading">
        <h2>{dateLabel(day)}</h2>
        <span className="bb-muted">Horário de Brasília</span>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice error onRetry={reload}>
          {error}
        </Notice>
      ) : !events.length ? (
        <Empty title="Sem eventos neste dia">
          Os atendimentos e bloqueios deste dia aparecerão aqui. Use as setas
          para consultar outras datas.
        </Empty>
      ) : !visible.length ? (
        <Empty title="Nenhum evento corresponde aos filtros">
          Tente outro cliente ou serviço, ou{" "}
          <button
            className="bb-text-button"
            onClick={() => {
              setSearch("");
              setFilter("TODOS");
            }}
          >
            limpe os filtros
          </button>
          .
        </Empty>
      ) : (
        <div className="bb-list">
          {visible.map((e) => {
            const gap =
              !query &&
              filter === "TODOS" &&
              occupiedUntil > 0 &&
              e.start > occupiedUntil
                ? { start: occupiedUntil, end: e.start }
                : null;
            occupiedUntil = Math.max(occupiedUntil, e.end);
            return (
              <Fragment key={e.id}>
                {gap && (
                  <div className="bb-gap">
                    <span>
                      {time(gap.start)}–{time(gap.end)}
                    </span>
                    <span>
                      Sem eventos · {Math.round((gap.end - gap.start) / 60000)}{" "}
                      min
                    </span>
                  </div>
                )}
                {e.appointment ? (
                  <AppointmentRow appointment={e.appointment} />
                ) : (
                  e.block && (
                    <article className="bb-appointment bb-block">
                      <div className="bb-time">
                        <strong>{time(e.start)}</strong>
                        <span>{time(e.end)}</span>
                      </div>
                      <div className="bb-client">
                        <h3>{e.block.motivo || "Indisponível"}</h3>
                        <p>
                          Horário bloqueado
                          {dayKey(new Date(e.start)) !== dayKey(new Date(e.end))
                            ? " · mais de um dia"
                            : ""}
                        </p>
                      </div>
                      <Botao
                        variante="fantasma"
                        onClick={() => {
                          setRemoving(e.block);
                          setConfirmation("");
                          setFormError("");
                        }}
                      >
                        Remover bloqueio
                      </Botao>
                    </article>
                  )
                )}
              </Fragment>
            );
          })}
        </div>
      )}
      {open && (
        <Dialog
          title="Bloquear horário"
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form onSubmit={create} className="bb-form">
            {formError && <Notice error>{formError}</Notice>}
            <label className="bb-field">
              Data do bloqueio
              <input
                className="bb-input"
                type="date"
                required
                min={dayKey()}
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </label>
            <div className="bb-form-row">
              <label className="bb-field">
                Início
                <input
                  className="bb-input"
                  type="time"
                  required
                  value={form.horaInicio}
                  onChange={(e) =>
                    setForm({ ...form, horaInicio: e.target.value })
                  }
                />
              </label>
              <label className="bb-field">
                Fim
                <input
                  className="bb-input"
                  type="time"
                  required
                  value={form.horaFim}
                  onChange={(e) =>
                    setForm({ ...form, horaFim: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="bb-field">
              Motivo (opcional)
              <input
                className="bb-input"
                maxLength={200}
                placeholder="Ex.: almoço ou compromisso pessoal"
                value={form.motivo}
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </label>
            <div className="bb-dialog-footer">
              <Botao
                type="button"
                variante="secundario"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Botao>
              <Botao type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Confirmar bloqueio"}
              </Botao>
            </div>
          </form>
        </Dialog>
      )}
      {removing && (
        <Dialog
          title="Remover bloqueio"
          busy={busy}
          onClose={() => setRemoving(null)}
        >
          <p>
            O intervalo {time(removing.dataInicio)}–{time(removing.dataFim)}{" "}
            será liberado.
          </p>
          <form className="bb-form" onSubmit={remove}>
            {formError && <Notice error>{formError}</Notice>}
            <label className="bb-field">
              Digite “{removing.motivo || "Bloqueio"}” para confirmar
              <input
                className="bb-input"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <div className="bb-dialog-footer">
              <Botao
                type="button"
                variante="secundario"
                disabled={busy}
                onClick={() => setRemoving(null)}
              >
                Cancelar
              </Botao>
              <Botao
                type="submit"
                variante="destrutivo"
                disabled={
                  busy || confirmation !== (removing.motivo || "Bloqueio")
                }
              >
                {busy ? "Removendo…" : "Remover bloqueio"}
              </Botao>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
