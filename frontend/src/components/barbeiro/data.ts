import { useCallback, useEffect, useState } from "react";
import { dataBrasilia } from "../../utils/datas";
export const zone = "America/Sao_Paulo";
export const dayKey = dataBrasilia;
export const time = (value: string | number) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
  });
export const money = (value: string | number) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: zone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
export function shiftDay(value: string, delta: number) {
  const date = new Date(`${value}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + delta);
  return dayKey(date);
}
export const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível realizar a ação. Tente novamente.";
export interface Service {
  id?: string;
  nome: string;
  preco: string | number;
  duracaoMinutos: number;
}
export interface Appointment {
  id: string;
  dataHora: string;
  status: string;
  valorCobrado: string;
  servico: Service;
  servicosAdicionais?: Service[];
  cliente: { id: string; usuario: { nome: string } };
}
export interface Block {
  id: string;
  dataInicio: string;
  dataFim: string;
  motivo?: string;
}
export interface DayHours {
  fechado: boolean;
  abertura: string;
  fechamento: string;
  temAlmoco: boolean;
  almocoInicio: string;
  almocoFim: string;
}
export interface Profile {
  id: string;
  foto: string | null;
  especialidades: string[];
  comissaoPercent: number;
  trabalhandoAgora: boolean;
  telefone: string | null;
  horariosTrabalho: Record<string, DayHours> | null;
  avaliacaoMedia: number;
  usuario: { nome: string; email: string };
  barbearia: { nome: string; slug: string; logo: string | null };
}
export interface Commissions {
  totalAtendimentos: number;
  valorBruto: number;
  percentualComissao: number;
  valorComissao: number;
  lancamentos: Array<{
    id: string;
    data: string;
    valor: number;
    valorComissao: number;
    servico: string;
    cliente: string;
  }>;
}
export const pending = (a: Appointment) =>
  a.status === "AGUARDANDO" || a.status === "CONFIRMADO";
export const duration = (a: Appointment) =>
  a.servicosAdicionais?.length
    ? a.servicosAdicionais.reduce((sum, s) => sum + s.duracaoMinutos, 0)
    : a.servico.duracaoMinutos;
export const endTime = (a: Appointment) =>
  new Date(a.dataHora).getTime() + duration(a) * 60000;
export function notifyBarberChange() {
  window.dispatchEvent(new Event("barber-data-changed"));
}
export function useBarberResource<T>(
  loader: (signal: AbortSignal) => Promise<T>,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loader(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(message(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loader, version]);
  useEffect(() => {
    window.addEventListener("barber-data-changed", reload);
    return () => window.removeEventListener("barber-data-changed", reload);
  }, [reload]);
  return { data, loading, error, reload };
}
