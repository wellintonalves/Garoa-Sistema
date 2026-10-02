import { useCallback, useState } from "react";
import barbeiroApi from "../../api/barbeiroApi";
import { Botao } from "../../components/ui";
import {
  PageHeader,
  Notice,
  Loading,
  Empty,
} from "../../components/barbeiro/ui";
import {
  type Commissions,
  dayKey,
  money,
  zone,
  useBarberResource,
} from "../../components/barbeiro/data";
function monthRange() {
  const today = dayKey();
  const [year, month] = today.split("-").map(Number);
  return {
    inicio: `${today.slice(0, 7)}-01`,
    fim: dayKey(new Date(Date.UTC(year, month, 0, 15))),
  };
}
export function BarbeiroComissoes() {
  const [range, setRange] = useState(monthRange);
  const [form, setForm] = useState(range);
  const [invalid, setInvalid] = useState("");
  const loader = useCallback(
    async (signal: AbortSignal) =>
      (
        await barbeiroApi.get<Commissions>("/barbeiro/comissoes", {
          signal,
          params: range,
        })
      ).data,
    [range],
  );
  const { data, loading, error, reload } = useBarberResource(loader);
  const weekLoader = useCallback(
    async (signal: AbortSignal) =>
      (
        await barbeiroApi.get<Array<{ data: string; atendimentos: number }>>(
          "/barbeiro/resumo-semana",
          { signal },
        )
      ).data,
    [],
  );
  const week = useBarberResource(weekLoader);
  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!form.inicio || !form.fim || form.inicio > form.fim) {
      setInvalid("A data final deve ser igual ou posterior à inicial.");
      return;
    }
    setInvalid("");
    setRange({ ...form });
  }
  return (
    <>
      <PageHeader
        title="Comissões"
        subtitle="Seus lançamentos e desempenho, por período."
      />
      <form className="bb-toolbar" onSubmit={apply}>
        <label className="bb-field">
          Início
          <input
            className="bb-input"
            type="date"
            required
            value={form.inicio}
            onChange={(e) => setForm({ ...form, inicio: e.target.value })}
          />
        </label>
        <label className="bb-field">
          Fim
          <input
            className="bb-input"
            type="date"
            required
            value={form.fim}
            onChange={(e) => setForm({ ...form, fim: e.target.value })}
          />
        </label>
        <Botao type="submit" variante="secundario">
          Aplicar período
        </Botao>
        <Botao
          type="button"
          variante="fantasma"
          onClick={() => {
            const r = monthRange();
            setForm(r);
            setRange(r);
            setInvalid("");
          }}
        >
          Este mês
        </Botao>
      </form>
      {invalid && <Notice error>{invalid}</Notice>}
      {loading ? (
        <Loading />
      ) : error ? (
        <Notice error onRetry={reload}>
          {error}
        </Notice>
      ) : (
        data && (
          <>
            <dl className="bb-summary">
              <div>
                <dt>Comissão registrada</dt>
                <dd>{money(data.valorComissao)}</dd>
              </div>
              <div>
                <dt>Valor dos lançamentos</dt>
                <dd>{money(data.valorBruto)}</dd>
              </div>
              <div>
                <dt>Atendimentos registrados</dt>
                <dd>
                  {data.totalAtendimentos}
                  <small>Comissão padrão: {data.percentualComissao}%</small>
                </dd>
              </div>
            </dl>
            <div className="bb-section-heading">
              <h2>Histórico do período</h2>
              <span className="bb-muted">
                {new Date(`${range.inicio}T12:00:00-03:00`).toLocaleDateString(
                  "pt-BR",
                  { timeZone: zone },
                )}{" "}
                a{" "}
                {new Date(`${range.fim}T12:00:00-03:00`).toLocaleDateString(
                  "pt-BR",
                  { timeZone: zone },
                )}
              </span>
            </div>
            {(data.lancamentos ?? []).length ? (
              <div className="bb-table-wrap">
                <table className="bb-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Cliente e serviço</th>
                      <th>Valor</th>
                      <th>Comissão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.lancamentos ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>
                          {new Date(l.data).toLocaleDateString("pt-BR", {
                            timeZone: zone,
                          })}
                        </td>
                        <td>
                          {l.cliente}
                          <small>{l.servico}</small>
                        </td>
                        <td>{money(l.valor)}</td>
                        <td>{money(l.valorComissao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="Sem lançamentos neste período">
                Selecione outro período para consultar seu histórico de
                comissões.
              </Empty>
            )}
          </>
        )
      )}
      <details className="bb-subsection">
        <summary>Atendimentos nos últimos 7 dias</summary>
        {week.loading ? (
          <Loading />
        ) : week.error ? (
          <Notice error onRetry={week.reload}>
            {week.error}
          </Notice>
        ) : (
          <div className="bb-week">
            {(week.data ?? []).map((d) => (
              <div key={d.data}>
                <span>
                  {new Date(`${d.data}T12:00:00-03:00`).toLocaleDateString(
                    "pt-BR",
                    { timeZone: zone, weekday: "short", day: "2-digit" },
                  )}
                </span>
                <strong>{d.atendimentos}</strong>
              </div>
            ))}
          </div>
        )}
      </details>
    </>
  );
}
