import { useCallback, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react";
import { useBarbeiroAuth } from "../../hooks/useBarbeiroAuth";
import { SeletorTema } from "../../components/SeletorTema";
import { Botao } from "../../components/ui";
import barbeiroApi from "../../api/barbeiroApi";
import { BarbeiroHorariosCard } from "./BarbeiroHorariosCard";
import {
  PageHeader,
  Notice,
  Loading,
  Dialog,
} from "../../components/barbeiro/ui";
import {
  type Profile,
  message,
  useBarberResource,
} from "../../components/barbeiro/data";
export function BarbeiroPerfil() {
  const { logout, atualizarNome } = useBarbeiroAuth();
  const loader = useCallback(
    async (signal: AbortSignal) =>
      (await barbeiroApi.get<Profile>("/barbeiro/perfil", { signal })).data,
    [],
  );
  const { data: profile, loading, error, reload } = useBarberResource(loader);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    telefone: "",
    especialidades: "",
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [feedback, setFeedback] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current) return;
    if (!form.nome.trim()) {
      setActionError("Informe seu nome.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setActionError("");
    try {
      await barbeiroApi.put("/barbeiro/perfil", {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        especialidades: form.especialidades
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      atualizarNome(form.nome.trim());
      setEdit(false);
      setFeedback("Perfil atualizado.");
      reload();
    } catch (e) {
      setActionError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || lock.current) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setActionError("Escolha uma foto JPG, PNG ou WebP de até 2 MB.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setActionError("");
    const body = new FormData();
    body.append("file", file);
    try {
      await barbeiroApi.post("/barbeiro/foto", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFeedback("Foto atualizada.");
      reload();
    } catch (e) {
      setActionError(message(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="bb-profile">
      <PageHeader
        title="Meu perfil"
        subtitle="Seus dados, disponibilidade e preferências."
      >
        {profile && (
          <Botao
            variante="secundario"
            disabled={busy}
            onClick={() => {
              setForm({
                nome: profile.usuario.nome,
                telefone: profile.telefone ?? "",
                especialidades: (profile.especialidades ?? []).join(", "),
              });
              setActionError("");
              setEdit(true);
            }}
          >
            Editar perfil
          </Botao>
        )}
      </PageHeader>
      {feedback && <Notice>{feedback}</Notice>}
      {actionError && !edit && <Notice error>{actionError}</Notice>}
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice error onRetry={reload}>
          {error}
        </Notice>
      ) : (
        profile && (
          <>
            <div className="bb-profile-person">
              {profile.foto ? (
                <img
                  className="bb-avatar"
                  src={profile.foto}
                  alt={profile.usuario.nome}
                />
              ) : (
                <div className="bb-avatar" aria-hidden>
                  {profile.usuario.nome.slice(0, 1)}
                </div>
              )}
              <div>
                <h2>{profile.usuario.nome}</h2>
                <p className="bb-muted">{profile.usuario.email}</p>
                <p className="bb-muted">
                  {profile.barbearia.nome} · Avaliação{" "}
                  {Number(profile.avaliacaoMedia || 0).toFixed(1)}
                </p>
              </div>
              <Botao
                variante="fantasma"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <Camera size={20} />
                {busy ? "Enviando…" : "Alterar foto"}
              </Botao>
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Escolher foto"
                onChange={upload}
                hidden
              />
            </div>
            <div className="bb-settings-row">
              <div>
                <h3>Contato</h3>
                <p>Telefone do profissional</p>
              </div>
              <span>{profile.telefone || "Telefone não informado"}</span>
            </div>
            <div className="bb-settings-row">
              <h3>Especialidades</h3>
              <div className="bb-tags">
                {(profile.especialidades ?? []).length ? (
                  (profile.especialidades ?? []).map((s) => (
                    <span key={s}>{s}</span>
                  ))
                ) : (
                  <span>Especialidades não informadas</span>
                )}
              </div>
            </div>
            <div className="bb-settings-row">
              <div>
                <h3>Comissão padrão</h3>
                <p>Definida pela administração da barbearia.</p>
              </div>
              <strong>{profile.comissaoPercent}%</strong>
            </div>
            <details className="bb-subsection">
              <summary>Horários de trabalho</summary>
              <BarbeiroHorariosCard
                horariosIniciais={profile.horariosTrabalho}
                onSuccess={reload}
                mostrarErro={setActionError}
                mostrarSucesso={setFeedback}
              />
            </details>
            <div className="bb-settings-row">
              <div>
                <h3>Aparência</h3>
                <p>Escolha como prefere visualizar o Valen.</p>
              </div>
              <SeletorTema />
            </div>
            <div className="bb-subsection">
              <Botao variante="fantasma" onClick={logout}>
                Sair da conta
              </Botao>
            </div>
          </>
        )
      )}
      {edit && (
        <Dialog
          title="Editar perfil"
          busy={busy}
          onClose={() => setEdit(false)}
        >
          <form className="bb-form" onSubmit={save}>
            {actionError && <Notice error>{actionError}</Notice>}
            <label className="bb-field">
              Nome de exibição
              <input
                className="bb-input"
                required
                maxLength={120}
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </label>
            <label className="bb-field">
              Telefone
              <input
                className="bb-input"
                type="tel"
                autoComplete="tel"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </label>
            <label className="bb-field">
              Especialidades
              <input
                className="bb-input"
                value={form.especialidades}
                onChange={(e) =>
                  setForm({ ...form, especialidades: e.target.value })
                }
              />
              <span className="bb-muted">
                Separe as especialidades por vírgulas.
              </span>
            </label>
            <p className="bb-muted">O email é administrado pela barbearia.</p>
            <div className="bb-dialog-footer">
              <Botao
                type="button"
                variante="secundario"
                disabled={busy}
                onClick={() => setEdit(false)}
              >
                Cancelar
              </Botao>
              <Botao type="submit" disabled={busy}>
                {busy ? "Salvando…" : "Salvar perfil"}
              </Botao>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
