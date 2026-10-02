import { useCallback, useRef, useState } from "react";
import barbeiroApi from "../api/barbeiroApi";
import { Botao } from "./ui";
import { Dialog, Notice } from "./barbeiro/ui";
import {
  message,
  money,
  notifyBarberChange,
  useBarberResource,
} from "./barbeiro/data";
interface Approval {
  id: string;
  acao: string;
  dadosNovos?: {
    valor?: number;
    valorComissao?: number;
    formaPagamento?: string;
  };
  lancamento?: {
    servico?: { nome: string };
    descricao?: string;
    valor?: number;
    categoria?: string;
  };
}
const titles: Record<string, string> = {
  EDITAR: "Alteração de lançamento",
  EXCLUIR: "Exclusão de lançamento",
  ADICIONAR: "Serviço extra",
};
const payments: Record<string, string> = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Débito",
  CARTAO_CREDITO: "Crédito",
};
export function AprovacoesPopup() {
  const loader = useCallback(
    async (signal: AbortSignal) =>
      (await barbeiroApi.get<Approval[]>("/aprovacoes/pendentes", { signal }))
        .data ?? [],
    [],
  );
  const { data, error, reload } = useBarberResource(loader);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const lock = useRef(false);
  const current = data?.[0];
  async function decide(action: "aprovar" | "rejeitar") {
    if (!current || lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await barbeiroApi.post(`/aprovacoes/${current.id}/${action}`);
      setOpen(false);
      notifyBarberChange();
    } catch (e) {
      setActionError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (error)
    return (
      <Notice error onRetry={reload}>
        Não foi possível consultar as aprovações pendentes. {error}
      </Notice>
    );
  if (!current) return null;
  const name =
    current.lancamento?.servico?.nome ||
    current.lancamento?.descricao ||
    current.lancamento?.categoria ||
    "Lançamento";
  return (
    <>
      <div className="bb-notice">
        <span>
          {data?.length}{" "}
          {data?.length === 1 ? "lançamento aguarda" : "lançamentos aguardam"}{" "}
          sua aprovação.
        </span>
        <Botao
          variante="secundario"
          onClick={() => {
            setOpen(true);
            setActionError("");
            setConfirmation("");
          }}
        >
          Revisar solicitação
        </Botao>
      </div>
      {open && (
        <Dialog
          title={titles[current.acao] || "Revisar lançamento"}
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <div className="bb-detail">
            <h3>{name}</h3>
            {current.lancamento?.valor !== undefined && (
              <p>Valor atual: {money(current.lancamento.valor)}</p>
            )}
            {current.dadosNovos?.valor !== undefined && (
              <p>Novo valor: {money(current.dadosNovos.valor)}</p>
            )}
            {current.dadosNovos?.valorComissao !== undefined && (
              <p>Nova comissão: {money(current.dadosNovos.valorComissao)}</p>
            )}
            {current.dadosNovos?.formaPagamento && (
              <p>
                Pagamento:{" "}
                {payments[current.dadosNovos.formaPagamento] ||
                  current.dadosNovos.formaPagamento}
              </p>
            )}
          </div>
          {current.acao === "EXCLUIR" && (
            <label className="bb-field">
              Digite “{name}” para aprovar a exclusão
              <input
                className="bb-input"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          {actionError && <Notice error>{actionError}</Notice>}
          <div className="bb-dialog-footer">
            <Botao
              variante="secundario"
              disabled={busy}
              onClick={() => decide("rejeitar")}
            >
              Rejeitar
            </Botao>
            <Botao
              disabled={
                busy || (current.acao === "EXCLUIR" && confirmation !== name)
              }
              onClick={() => decide("aprovar")}
            >
              {busy ? "Registrando…" : "Aprovar"}
            </Botao>
          </div>
        </Dialog>
      )}
    </>
  );
}
