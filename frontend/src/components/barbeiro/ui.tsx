import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { Botao, Skeleton } from "../ui";
import "./barbeiro.css";
export function useBarberTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | Valen Barber`;
    return () => { document.title = previous; };
  }, [title]);
}
export function Brand() {
  return (
    <div className="bb-brand">
      <span aria-hidden="true">V</span>
      <div>
        Valen <small>Barber</small>
      </div>
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  useBarberTitle(title);
  return (
    <header className="bb-page-header">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {children && <div className="bb-actions">{children}</div>}
    </header>
  );
}
export function Notice({
  children,
  error = false,
  onRetry,
}: {
  children: ReactNode;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`bb-notice ${error ? "bb-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      <span>{children}</span>
      {onRetry && (
        <Botao variante="secundario" onClick={onRetry}>
          Tentar novamente
        </Botao>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="bb-loading" role="status" aria-label="Carregando">
      <Skeleton height={72} />
      <Skeleton height={72} />
      <Skeleton height={72} />
      <span className="bb-muted">Carregando informações…</span>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="bb-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="bb-dialog"
      aria-labelledby={titleId}
      aria-busy={busy}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="bb-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Botao
          variante="fantasma"
          aria-label="Fechar"
          disabled={busy}
          onClick={onClose}
        >
          <X size={20} />
        </Botao>
      </div>
      {children}
    </dialog>
  );
}
const statuses: Record<string, string> = {
  AGUARDANDO: "Aguardando",
  CONFIRMADO: "Confirmado",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
  NAO_COMPARECEU: "Não compareceu",
};
export function Status({ value }: { value: string }) {
  return (
    <span className={`bb-status bb-status-${value.toLowerCase()}`}>
      {statuses[value] || value}
    </span>
  );
}
