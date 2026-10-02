import { useCallback, useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import barbeiroApi from "../../api/barbeiroApi";
import { Botao } from "../../components/ui";
import {
  PageHeader,
  Notice,
  Loading,
  Empty,
  Status,
} from "../../components/barbeiro/ui";
import { AppointmentRow } from "../../components/barbeiro/AppointmentRow";
import {
  type Appointment,
  type Profile,
  type Commissions,
  dayKey,
  dateLabel,
  time,
  duration,
  money,
  pending,
  endTime,
  message,
  useBarberResource,
  notifyBarberChange,
} from "../../components/barbeiro/data";
import { formatarNomeServico } from "../../utils/formato";
import { BarberCheckout } from "../../components/barbeiro/BarberCheckout";
export function BarbeiroHoje() {
  const { barbeiro } = useOutletContext<{ barbeiro: { nome: string } }>();
  const [now, setNow] = useState(Date.now());
  const today = dayKey(new Date(now));
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const [a, p] = await Promise.all([
        barbeiroApi.get<Appointment[]>("/barbeiro/agenda-hoje", { signal }),
        barbeiroApi.get<Profile>("/barbeiro/perfil", { signal }),
      ]);
      return { appointments: a.data ?? [], profile: p.data };
    },
    [today],
  );
  const { data, loading, error, reload } = useBarberResource(loader);
  const commissionLoader = useCallback(
    async (signal: AbortSignal) =>
      (
        await barbeiroApi.get<Commissions>("/barbeiro/comissoes", {
          signal,
          params: { inicio: today, fim: today },
        })
      ).data,
    [today],
  );
  const commissions = useBarberResource(commissionLoader);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [checkout, setCheckout] = useState<Appointment | null>(null);
  const appointments = [...(data?.appointments ?? [])].sort(
    (a, b) => Date.parse(a.dataHora) - Date.parse(b.dataHora),
  );
  const outstanding = appointments.filter(pending);
  const completed = appointments.filter((a) => a.status === "CONCLUIDO");
  const next = outstanding.find((a) => endTime(a) > now);
  const overdue = outstanding.filter((a) => endTime(a) <= now);
  async function toggleWork() {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await barbeiroApi.patch("/barbeiro/status-trabalho", {
        trabalhandoAgora: !data?.profile.trabalhandoAgora,
      });
      setFeedback(
        data?.profile.trabalhandoAgora
          ? "Você está ausente."
          : "Você está disponível.",
      );
      notifyBarberChange();
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader
        title={`Olá, ${barbeiro.nome.split(" ")[0]}`}
        subtitle={dateLabel(today)}
      >
        <label className="bb-switch">
          <input
            type="checkbox"
            checked={data?.profile.trabalhandoAgora ?? false}
            disabled={busy || loading || !!error}
            onChange={toggleWork}
          />
          {busy
            ? "Atualizando…"
            : data?.profile.trabalhandoAgora
              ? "Disponível"
              : "Ausente"}
        </label>
      </PageHeader>
      {feedback && <Notice>{feedback}</Notice>}
      {actionError && <Notice error>{actionError}</Notice>}
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice error onRetry={reload}>
          {error}
        </Notice>
      ) : (
        <>
          <div className="bb-today-grid">
            <section className="bb-next" aria-label="Próximo atendimento">
              <p className="bb-eyebrow">
                {next
                  ? Date.parse(next.dataHora) <= now
                    ? "Horário atual"
                    : "Próximo atendimento"
                  : overdue.length
                    ? "Pendências do dia"
                    : "Agenda em dia"}
              </p>
              {next ? (
                <>
                  <div>
                    <p className="bb-next-time">{time(next.dataHora)}</p>
                    <Status value={next.status} />
                  </div>
                  <div>
                    <h2>{next.cliente.usuario.nome}</h2>
                    <p className="bb-muted">{formatarNomeServico(next)}</p>
                  </div>
                  <div className="bb-next-detail">
                    <span>{duration(next)} minutos</span>
                    <strong>{money(next.valorCobrado)}</strong>
                  </div>
                  <Botao onClick={() => setCheckout(next)}>
                    Concluir atendimento
                  </Botao>
                </>
              ) : (
                <>
                  <h2>
                    {overdue.length
                      ? "Revise os atendimentos pendentes"
                      : "Nenhum atendimento a seguir"}
                  </h2>
                  <p className="bb-muted">
                    {overdue.length
                      ? "Os horários já passaram. Confirme a conclusão apenas dos serviços realizados."
                      : "Consulte a agenda para acompanhar os próximos dias."}
                  </p>
                  <Link
                    className="btn-base btn-secundario"
                    to="/barbeiro/agenda"
                  >
                    Ver agenda
                  </Link>
                </>
              )}
            </section>
            <div className="bb-daily-summary">
              <dl className="bb-summary">
                <div>
                  <dt>Concluídos hoje</dt>
                  <dd>
                    {completed.length}
                    <small>de {appointments.length} agendados</small>
                  </dd>
                </div>
                <div>
                  <dt>A concluir</dt>
                  <dd>
                    {outstanding.length}
                    <small>
                      {overdue.length
                        ? `${overdue.length} com horário encerrado`
                        : "na agenda de hoje"}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Comissão do dia</dt>
                  <dd>
                    {commissions.loading
                      ? "…"
                      : commissions.error
                        ? "—"
                        : money(commissions.data?.valorComissao ?? 0)}
                    <small>dos lançamentos registrados</small>
                  </dd>
                </div>
              </dl>
              {commissions.error && (
                <Notice error onRetry={commissions.reload}>
                  Não foi possível consultar a comissão do dia.
                </Notice>
              )}
            </div>
            <section className="bb-today-list">
              <div className="bb-section-heading">
                <h2>Agenda de hoje</h2>
                <Link to="/barbeiro/agenda">Ver agenda completa</Link>
              </div>
              {appointments.length ? (
                <div className="bb-list">
                  {appointments.map((a) => (
                    <AppointmentRow
                      key={a.id}
                      appointment={a}
                      onComplete={pending(a) ? () => setCheckout(a) : undefined}
                    />
                  ))}
                </div>
              ) : (
                <Empty title="Sem agendamentos hoje">
                  Os horários marcados para hoje aparecerão aqui.
                </Empty>
              )}
            </section>
          </div>
        </>
      )}
      {checkout && (
        <BarberCheckout
          appointment={checkout}
          onClose={() => setCheckout(null)}
          onSuccess={() => {
            setCheckout(null);
            setFeedback(
              "Atendimento concluído. Agenda e comissões atualizadas.",
            );
            notifyBarberChange();
          }}
        />
      )}
    </>
  );
}
