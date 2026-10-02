import { type Appointment, duration, endTime, money, time } from "./data";
import { Status } from "./ui";
import { Botao } from "../ui";
import { formatarNomeServico } from "../../utils/formato";
export function AppointmentRow({
  appointment: a,
  onComplete,
}: {
  appointment: Appointment;
  onComplete?: () => void;
}) {
  return (
    <article className="bb-appointment">
      <div className="bb-time">
        <strong>{time(a.dataHora)}</strong>
        <span>{time(endTime(a))}</span>
      </div>
      <div className="bb-client">
        <h3>{a.cliente.usuario.nome}</h3>
        <p>
          {formatarNomeServico(a)} · {duration(a)} min
        </p>
      </div>
      <div className="bb-appointment-meta">
        <Status value={a.status} />
        <strong>{money(a.valorCobrado)}</strong>
      </div>
      {onComplete && (
        <Botao
          variante="secundario"
          onClick={onComplete}
          aria-label={`Concluir atendimento de ${a.cliente.usuario.nome}`}
        >
          Concluir
        </Botao>
      )}
    </article>
  );
}
