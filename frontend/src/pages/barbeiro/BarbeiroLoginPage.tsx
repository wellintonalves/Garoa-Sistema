import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useBarbeiroAuth } from "../../hooks/useBarbeiroAuth";
import { LinksDocumentos } from "../../components/AceiteDocumentos";
import { Botao } from "../../components/ui";
import { Brand, Notice, useBarberTitle } from "../../components/barbeiro/ui";
import { message } from "../../components/barbeiro/data";
import { isAxiosError } from "axios";
export function BarbeiroLoginPage() {
  useBarberTitle("Área do barbeiro");
  const { login } = useBarbeiroAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(
    params.get("exp") === "1"
      ? "Sua sessão expirou. Entre novamente para continuar."
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [shops, setShops] = useState<
    Array<{ id: string; nome: string; slug: string }>
  >([]);
  const [shop, setShop] = useState("");
  const [reference, setReference] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setReference("");
    try {
      await login(email.trim().toLowerCase(), password, shop || undefined);
      navigate("/barbeiro/hoje");
    } catch (e) {
      if (
        isAxiosError(e) &&
        e.response?.status === 409 &&
        e.response.data.codigo === "ESCOLHER_BARBEARIA"
      ) {
        const choices = e.response.data.barbearias ?? [];
        setShops(choices);
        setShop(choices[0]?.id ?? "");
      } else {
        setError(message(e));
        if (isAxiosError(e)) setReference(e.response?.data?.referencia ?? "");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="bb-login">
      <div className="bb-login-inner">
        <Brand />
        <h1>Área do barbeiro</h1>
        <p className="bb-login-intro">
          Sua agenda, seus atendimentos e suas comissões.
        </p>
        {error && (
          <Notice error>
            {error}
            {reference && <small> Referência: {reference}</small>}
          </Notice>
        )}
        <form className="bb-form" onSubmit={submit}>
          <label className="bb-field">
            Email
            <input
              className="bb-input"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setShops([]);
                setShop("");
              }}
            />
          </label>
          <label className="bb-field">
            Senha
            <div className="bb-password">
              <input
                className="bb-input"
                type={visible ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setShops([]);
                  setShop("");
                }}
              />
              <button
                type="button"
                aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </label>
          {shops.length > 0 && (
            <label className="bb-field">
              Barbearia
              <select
                className="bb-input"
                required
                value={shop}
                onChange={(e) => setShop(e.target.value)}
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} ({s.slug})
                  </option>
                ))}
              </select>
              <span className="bb-muted">Escolha onde deseja trabalhar.</span>
            </label>
          )}
          <Botao type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar como barbeiro"}
          </Botao>
        </form>
        <div className="bb-login-links">
          <Link to="/">Área do cliente</Link>
          <Link to="/admin/login">Painel administrativo</Link>
        </div>
        <LinksDocumentos />
      </div>
    </div>
  );
}
