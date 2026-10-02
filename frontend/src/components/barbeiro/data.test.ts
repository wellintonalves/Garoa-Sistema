import { describe, expect, it } from "vitest";
import {
  dayKey,
  shiftDay,
  time,
  duration,
  endTime,
  pending,
  type Appointment,
} from "./data";
const appointment: Appointment = {
  id: "fixture",
  dataHora: "2026-10-02T02:45:00Z",
  status: "CONFIRMADO",
  valorCobrado: "80",
  servico: { nome: "Corte", preco: 50, duracaoMinutos: 30 },
  cliente: { id: "fixture-client", usuario: { nome: "Lucas Ferreira" } },
};
describe("Agenda do barbeiro em Brasília", () => {
  it("mantém o dia local na virada UTC", () => {
    expect(dayKey(new Date("2026-10-02T02:59:59Z"))).toBe("2026-10-01");
    expect(dayKey(new Date("2026-10-02T03:00:00Z"))).toBe("2026-10-02");
  });
  it("navega viradas de mês e ano", () => {
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("mostra horários de minuto arbitrário e término no outro dia", () => {
    expect(time(appointment.dataHora)).toBe("23:45");
    expect(time(endTime(appointment))).toBe("00:15");
  });
  it("usa a duração total dos serviços de um combo", () => {
    expect(
      duration({
        ...appointment,
        servicosAdicionais: [
          { nome: "Corte", preco: 50, duracaoMinutos: 45 },
          { nome: "Barba", preco: 30, duracaoMinutos: 30 },
        ],
      }),
    ).toBe(75);
  });
  it("não permite conclusão de cancelados ou já concluídos", () => {
    expect(pending(appointment)).toBe(true);
    expect(pending({ ...appointment, status: "CANCELADO" })).toBe(false);
    expect(pending({ ...appointment, status: "CONCLUIDO" })).toBe(false);
  });
});
