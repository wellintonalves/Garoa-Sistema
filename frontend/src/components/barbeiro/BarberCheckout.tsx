import { useEffect, useRef, useState } from "react";
import barbeiroApi from "../../api/barbeiroApi";
import { Botao } from "../ui";
import { Dialog, Notice, Loading } from "./ui";
import { type Appointment, message, money, time, zone } from "./data";
import { formatarNomeServico } from "../../utils/formato";
interface Loyalty {
  saldoPontos: number;
  maxPontosUtilizaveis: number;
  resgatePontosAtivo: boolean;
  permitirCombinarDescontos: boolean;
}
interface Preview {
  valorBruto: number;
  descontoManual: number;
  descontoPontos: number;
  valorLiquido: number;
  maxPontosUtilizaveis?: number;
}
const methods = [
  ["PIX", "Pix"],
  ["DINHEIRO", "Dinheiro"],
  ["CARTAO_DEBITO", "Débito"],
  ["CARTAO_CREDITO", "Crédito"],
];
export function BarberCheckout({
  appointment: a,
  onClose,
  onSuccess,
}: {
  appointment: Appointment;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [payment, setPayment] = useState("PIX");
  const [discount, setDiscount] = useState("NENHUM");
  const [amount, setAmount] = useState("");
  const [points, setPoints] = useState("");
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null);
  const [loyaltyError, setLoyaltyError] = useState("");
  const [loyaltyVersion, setLoyaltyVersion] = useState(0);
  const [preview, setPreview] = useState<{ key: string; data: Preview } | null>(
    null,
  );
  const [previewError, setPreviewError] = useState("");
  const [version, setVersion] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [futureConfirmed, setFutureConfirmed] = useState(false);
  const lock = useRef(false);
  const manual = discount === "REAIS" || discount === "PERCENTUAL";
  const hasPoints = Number(points) > 0;
  const type =
    manual && Number(amount) > 0
      ? hasPoints
        ? "COMBINADO"
        : discount
      : hasPoints
        ? "PONTOS"
        : "NENHUM";
  const payload = {
    tipoDesconto: type,
    descontoReais: discount === "REAIS" ? Number(amount) || 0 : 0,
    descontoPercentual: discount === "PERCENTUAL" ? Number(amount) || 0 : 0,
    pontosUsados: Number(points) || 0,
  };
  const key = JSON.stringify(payload);
  const valid =
    (!manual || (amount !== "" && Number(amount) >= 0)) &&
    (discount !== "PERCENTUAL" || Number(amount) <= 100) &&
    Number(points) >= 0 &&
    Number.isInteger(Number(points));
  const current = preview?.key === key ? preview.data : null;
  useEffect(() => {
    const controller = new AbortController();
    setLoyaltyError("");
    barbeiroApi
      .get<Loyalty>(`/fidelidade/clientes/${a.cliente.id}/saldo`, {
        signal: controller.signal,
        params: { valorServico: a.valorCobrado },
      })
      .then((r) => setLoyalty(r.data))
      .catch((e) => {
        if (!controller.signal.aborted) setLoyaltyError(message(e));
      });
    return () => controller.abort();
  }, [a.cliente.id, a.valorCobrado, loyaltyVersion]);
  useEffect(() => {
    const controller = new AbortController();
    setPreviewError("");
    setPreview(null);
    const timer = setTimeout(() => {
      if (!valid) return;
      barbeiroApi
        .post<Preview>(
          `/agendamentos/${a.id}/simular-desconto`,
          JSON.parse(key),
          { signal: controller.signal },
        )
        .then((r) => {
          if (!controller.signal.aborted) setPreview({ key, data: r.data });
        })
        .catch((e) => {
          if (!controller.signal.aborted) setPreviewError(message(e));
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [a.id, key, valid, version]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || !current || !valid || previewError) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await barbeiroApi.post(`/barbeiro/concluir-agendamento/${a.id}`, {
        ...payload,
        status: "CONCLUIDO",
        formaPagamento: payment,
      });
      onSuccess();
    } catch (e) {
      setError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const future = Date.parse(a.dataHora) > Date.now();
  return (
    <Dialog title="Concluir atendimento" busy={busy} onClose={onClose}>
      <div className="bb-detail">
        <strong>{a.cliente.usuario.nome}</strong>
        <p>{formatarNomeServico(a)}</p>
        <p className="bb-muted">
          {new Date(a.dataHora).toLocaleDateString("pt-BR", { timeZone: zone })}{" "}
          às {time(a.dataHora)}
        </p>
      </div>
      <form className="bb-form" onSubmit={submit}>
        <fieldset disabled={busy} className="bb-form">
          <legend className="bb-field">Forma de pagamento</legend>
          <div className="bb-segment">
            {methods.map(([value, label]) => (
              <Botao
                key={value}
                type="button"
                variante="secundario"
                aria-pressed={payment === value}
                onClick={() => setPayment(value)}
              >
                {label}
              </Botao>
            ))}
          </div>
          <label className="bb-field">
            Desconto
            <select
              aria-label="Desconto"
              className="bb-input"
              value={discount}
              onChange={(e) => {
                setDiscount(e.target.value);
                setAmount("");
                setPoints("");
                setError("");
              }}
            >
              <option value="NENHUM">Sem desconto</option>
              <option value="REAIS">Valor em reais</option>
              <option value="PERCENTUAL">Percentual</option>
              <option
                value="PONTOS"
                disabled={!loyalty?.resgatePontosAtivo || !loyalty?.saldoPontos}
              >
                Pontos de fidelidade
              </option>
            </select>
          </label>
          {manual && (
            <label className="bb-field">
              {discount === "REAIS"
                ? "Desconto em reais"
                : "Desconto em percentual"}
              <input
                className="bb-input"
                type="number"
                min="0"
                max={discount === "PERCENTUAL" ? 100 : undefined}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          {(discount === "PONTOS" ||
            (manual && loyalty?.permitirCombinarDescontos)) && (
            <label className="bb-field">
              Pontos a utilizar
              <input
                aria-label="Pontos a utilizar"
                className="bb-input"
                type="number"
                min="0"
                max={
                  current?.maxPontosUtilizaveis ??
                  loyalty?.maxPontosUtilizaveis ??
                  0
                }
                step="1"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
              <span className="bb-muted">
                Saldo: {loyalty?.saldoPontos ?? 0} pontos · máximo{" "}
                {current?.maxPontosUtilizaveis ??
                  loyalty?.maxPontosUtilizaveis ??
                  0}
              </span>
              <Botao
                type="button"
                variante="fantasma"
                onClick={() =>
                  setPoints(
                    String(
                      current?.maxPontosUtilizaveis ??
                        loyalty?.maxPontosUtilizaveis ??
                        0,
                    ),
                  )
                }
              >
                Usar máximo de pontos
              </Botao>
            </label>
          )}
        </fieldset>
        {loyaltyError && (
          <Notice error onRetry={() => setLoyaltyVersion((v) => v + 1)}>
            Não foi possível consultar os pontos. {loyaltyError}
          </Notice>
        )}
        {previewError ? (
          <Notice error onRetry={() => setVersion((v) => v + 1)}>
            {previewError}
          </Notice>
        ) : !valid ? (
          <Notice error>
            Informe um desconto válido para calcular o total.
          </Notice>
        ) : !current ? (
          <Loading />
        ) : (
          <dl className="bb-checkout-total">
            <div>
              <dt>Subtotal</dt>
              <dd>{money(current.valorBruto)}</dd>
            </div>
            {current.descontoManual > 0 && (
              <div>
                <dt>Desconto manual</dt>
                <dd>− {money(current.descontoManual)}</dd>
              </div>
            )}
            {current.descontoPontos > 0 && (
              <div>
                <dt>Desconto em pontos</dt>
                <dd>− {money(current.descontoPontos)}</dd>
              </div>
            )}
            <div>
              <dt>Total a registrar</dt>
              <dd>{money(current.valorLiquido)}</dd>
            </div>
          </dl>
        )}
        {future && (
          <label className="bb-switch">
            <input
              type="checkbox"
              checked={futureConfirmed}
              onChange={(e) => setFutureConfirmed(e.target.checked)}
            />
            Confirmo a conclusão antecipada. O valor será registrado no caixa de
            hoje.
          </label>
        )}
        {error && <Notice error>{error}</Notice>}
        <div className="bb-dialog-footer">
          <Botao
            type="button"
            variante="secundario"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Botao>
          <Botao
            type="submit"
            disabled={
              busy ||
              !current ||
              !!previewError ||
              !valid ||
              (future && !futureConfirmed)
            }
          >
            {busy ? "Concluindo…" : "Confirmar conclusão"}
          </Botao>
        </div>
      </form>
    </Dialog>
  );
}
