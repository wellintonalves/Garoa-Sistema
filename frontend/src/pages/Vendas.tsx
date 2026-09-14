import { useCallback, useEffect, useRef, useState } from "react";
import {
  Package,
  Plus,
  Minus,
  Trash,
  MagnifyingGlass,
  ShoppingCart,
  PencilSimple,
  ArrowClockwise,
} from "@phosphor-icons/react";
import { Modal } from "../components/Modal";
import { BuscaCliente } from "../components/BuscaCliente";
import { statusPontos, type SaldoPontos } from "../utils/statusPontos";
import { SkeletonPage } from "../components/Skeleton";
import api from "../api/client";
import { hojeBrasilia } from "../utils/datas";
import "./Vendas.css";

interface Produto {
  id: string;
  nome: string;
  categoria: string | null;
  quantidade: number;
  quantidadeMinima: number;
  unidade: string;
  custo: string;
  precoVenda: string | null;
}
interface Item {
  produto: Produto;
  quantidade: number;
}
interface Kpis {
  valorCusto: number;
  valorVenda: number;
  lucroEstimado: number;
  alertas: number;
  semPreco: number;
}
interface Venda {
  id: string;
  vendaId: string | null;
  nomeProduto: string;
  quantidade: number;
  precoVenda: string;
  formaPagamento: string;
  data: string;
  descontoRateado: string | null;
  venda: {
    valorBruto: string | null;
    valorDesconto: string | null;
    tipoDesconto: string | null;
    descontoPercentual: string | null;
    pontosUtilizados: number | null;
    total: string;
    estornadaEm: string | null;
    motivoEstorno: string | null;
    estornadoPorId: string | null;
  } | null;
}
interface PreviaDesconto {
  valorBruto: number;
  valorDesconto: number;
  valorLiquido: number;
  pontosUtilizados: number;
}
interface Resumo {
  vendas: Venda[];
  totalReceita: number;
  totalLucro: number;
  totalUnidades: number;
}
const formas = {
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  CARTAO_DEBITO: "Cartão de débito",
  CARTAO_CREDITO: "Cartão de crédito",
};
const vazio = {
  nome: "",
  categoria: "",
  quantidade: "0",
  quantidadeMinima: "5",
  unidade: "unidade",
  custo: "",
  precoVenda: "",
};
const moeda = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function mensagem(e: unknown) {
  const erro = e as {
    response?: { data?: { erro?: string } };
    message?: string;
  };
  return (
    erro.response?.data?.erro ||
    erro.message ||
    "Não foi possível concluir. Tente novamente."
  );
}

export function Vendas() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [aba, setAba] = useState<"catalogo" | "historico">("catalogo");
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [carrinho, setCarrinho] = useState<Item[]>([]);
  const [pagamento, setPagamento] = useState<keyof typeof formas>("PIX");
  const [ocupado, setOcupado] = useState(false);
  const trava = useRef(false);
  const chave = useRef(crypto.randomUUID());
  const [incerta, setIncerta] = useState(false);
  const [vendaEstorno, setVendaEstorno] = useState<Venda[] | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [confirmouEstorno, setConfirmouEstorno] = useState(false);
  const [estornando, setEstornando] = useState(false);
  const [erroEstorno, setErroEstorno] = useState('');
  const travaEstorno = useRef(false);
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [tipoDesconto, setTipoDesconto] = useState("NENHUM");
  const [valorDesconto, setValorDesconto] = useState("");
  const [tentativaDesconto, setTentativaDesconto] = useState(0);
  const [previa, setPrevia] = useState<{
    chave: string;
    dados: PreviaDesconto | null;
    erro: string | null;
  }>({ chave: "", dados: null, erro: null });
  const [saldo, setSaldo] = useState<{
    chave: string;
    dados: SaldoPontos | null;
    erro: string | null;
  }>({ chave: "", dados: null, erro: null });
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);
  const [erroForm, setErroForm] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [inicio, setInicio] = useState(hojeBrasilia().slice(0, 8) + "01");
  const [fim, setFim] = useState(hojeBrasilia());
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const carregar = useCallback(async (signal?: AbortSignal) => {
    try {
      const [p, k] = await Promise.all([
        api.request<Produto[]>({ url: "/estoque", signal }),
        api.request<Kpis>({ url: "/estoque/kpis", signal }),
      ]);
      if (signal?.aborted) return;
      setProdutos(p.data);
      setKpis(k.data);
      setCarrinho((c) =>
        c.map((i) => ({
          ...i,
          produto: p.data.find((p) => p.id === i.produto.id) || {
            ...i.produto,
            quantidade: 0,
          },
        })),
      );
    } catch (e) {
      if (!signal?.aborted) setErro(mensagem(e));
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);
  useEffect(() => {
    const c = new AbortController();
    void carregar(c.signal);
    return () => c.abort();
  }, [carregar]);
  const historico = useCallback(
    async (signal?: AbortSignal) => {
      if (!inicio || !fim || inicio > fim) {
        setErro("Selecione um período válido.");
        setResumo(null);
        setCarregandoHistorico(false);
        return;
      }
      setErro("");
      setCarregandoHistorico(true);
      try {
        const r = await api.request<Resumo>({
          url: "/estoque/vendas",
          params: { inicio, fim },
          signal,
        });
        if (!signal?.aborted) setResumo(r.data);
      } catch (e) {
        if (!signal?.aborted) setErro(mensagem(e));
      } finally {
        if (!signal?.aborted) setCarregandoHistorico(false);
      }
    },
    [inicio, fim],
  );
  useEffect(() => {
    if (aba !== "historico") return;
    const c = new AbortController();
    void historico(c.signal);
    return () => c.abort();
  }, [aba, historico]);
  const categorias = [
    ...new Set(produtos.map((p) => p.categoria || "Sem categoria")),
  ].sort();
  const visiveis = produtos.filter(
    (p) =>
      (!categoria || (p.categoria || "Sem categoria") === categoria) &&
      normalizar(p.nome).includes(normalizar(busca)),
  );
  const total =
    carrinho.reduce(
      (s, i) =>
        s + Math.round(Number(i.produto.precoVenda) * 100) * i.quantidade,
      0,
    ) / 100;
  const unidades = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const invalido = carrinho.some(
    (i) =>
      i.quantidade > i.produto.quantidade || Number(i.produto.precoVenda) <= 0,
  );
  const chaveSaldo = JSON.stringify({ clienteId, total, tentativaDesconto });
  useEffect(() => {
    const c = new AbortController();
    const dados = JSON.parse(chaveSaldo) as {
      clienteId: string | null;
      total: number;
    };
    if (!dados.clienteId) return () => c.abort();
    void api
      .request<SaldoPontos>({
        url: `/fidelidade/clientes/${dados.clienteId}/saldo`,
        params: { valorServico: dados.total },
        signal: c.signal,
      })
      .then((r) => {
        if (!c.signal.aborted)
          setSaldo({ chave: chaveSaldo, dados: r.data, erro: null });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setSaldo({ chave: chaveSaldo, dados: null, erro: mensagem(e) });
      });
    return () => c.abort();
  }, [chaveSaldo]);
  const pontosDisponiveis = statusPontos(
    clienteId,
    !!clienteId && saldo.chave !== chaveSaldo,
    saldo.chave === chaveSaldo ? saldo.erro : null,
    saldo.chave === chaveSaldo ? saldo.dados : null,
  );
  const payloadDesconto = {
    clienteId,
    tipoDesconto,
    descontoReais: tipoDesconto === "REAIS" ? Number(valorDesconto) : 0,
    descontoPercentual:
      tipoDesconto === "PERCENTUAL" ? Number(valorDesconto) : 0,
    pontosUsados: tipoDesconto === "PONTOS" ? Number(valorDesconto) : 0,
  };
  const chavePrevia = JSON.stringify({
    itens: carrinho.map((i) => ({
      estoqueId: i.produto.id,
      quantidade: i.quantidade,
    })),
    ...payloadDesconto,
    total,
    tentativaDesconto,
  });
  useEffect(() => {
    const c = new AbortController();
    const dados = JSON.parse(chavePrevia) as { itens: unknown[] };
    if (!dados.itens.length) return () => c.abort();
    const t = setTimeout(() => {
      void api
        .post<PreviaDesconto>("/estoque/simular-desconto", dados, {
          signal: c.signal,
        })
        .then((r) => {
          if (!c.signal.aborted)
            setPrevia({ chave: chavePrevia, dados: r.data, erro: null });
        })
        .catch((e) => {
          if (!c.signal.aborted)
            setPrevia({ chave: chavePrevia, dados: null, erro: mensagem(e) });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [chavePrevia]);
  const simulando = carrinho.length > 0 && previa.chave !== chavePrevia;
  const erroDesconto = previa.chave === chavePrevia ? previa.erro : null;
  const calculo = previa.chave === chavePrevia ? previa.dados : null;
  const bloqueioDesconto =
    simulando ||
    !!erroDesconto ||
    !calculo ||
    (tipoDesconto === "PONTOS" && !pontosDisponiveis.habilitado);
  function limparDesconto() {
    setClienteId(null);
    setTipoDesconto("NENHUM");
    setValorDesconto("");
  }
  function adicionar(p: Produto) {
    if (ocupado || incerta || p.quantidade <= 0 || Number(p.precoVenda) <= 0)
      return;
    setCarrinho((c) => {
      const atual = c.find((i) => i.produto.id === p.id);
      return atual
        ? c.map((i) =>
            i.produto.id === p.id
              ? { ...i, quantidade: Math.min(p.quantidade, i.quantidade + 1) }
              : i,
          )
        : [...c, { produto: p, quantidade: 1 }];
    });
    setAviso("");
  }
  function quantidade(id: string, delta: number) {
    setCarrinho((c) =>
      c.map((i) =>
        i.produto.id === id
          ? {
              ...i,
              quantidade: Math.max(
                1,
                Math.min(i.produto.quantidade, i.quantidade + delta),
              ),
            }
          : i,
      ),
    );
  }
  function editar(p?: Produto) {
    setErroForm("");
    setEditando(p?.id || null);
    setForm(
      p
        ? {
            nome: p.nome,
            categoria: p.categoria || "",
            quantidade: String(p.quantidade),
            quantidadeMinima: String(p.quantidadeMinima),
            unidade: p.unidade,
            custo: p.custo,
            precoVenda: p.precoVenda || "",
          }
        : vazio,
    );
    setModal(true);
  }
  async function salvar() {
    if (salvando) return;
    if (
      !form.nome.trim() ||
      !form.unidade.trim() ||
      !form.custo ||
      !Number.isInteger(Number(form.quantidade)) ||
      Number(form.quantidade) < 0 ||
      Number(form.custo) < 0 ||
      Number(form.precoVenda) < 0
    ) {
      setErroForm(
        "Informe nome, unidade, quantidade inteira e valores não negativos.",
      );
      return;
    }
    setSalvando(true);
    setErroForm("");
    try {
      const data = {
        ...form,
        quantidade: Number(form.quantidade),
        quantidadeMinima: Number(form.quantidadeMinima),
        custo: Number(form.custo),
        precoVenda: form.precoVenda ? Number(form.precoVenda) : null,
      };
      await api.request({
        method: editando ? "PUT" : "POST",
        url: editando ? `/estoque/${editando}` : "/estoque",
        data,
      });
      setModal(false);
      setAviso("Produto salvo.");
      await carregar();
    } catch (e) {
      setErroForm(mensagem(e));
    } finally {
      setSalvando(false);
    }
  }
  async function finalizar() {
    if (trava.current || !carrinho.length || invalido || bloqueioDesconto)
      return;
    trava.current = true;
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      const r = await api.post<{ totalVenda: number }>(
        "/estoque/vender-carrinho",
        {
          itens: carrinho.map((i) => ({
            estoqueId: i.produto.id,
            quantidade: i.quantidade,
          })),
          formaPagamento: pagamento,
          chaveRequisicao: chave.current,
          ...payloadDesconto,
        },
      );
      setCarrinho([]);
      limparDesconto();
      chave.current = crypto.randomUUID();
      setIncerta(false);
      setAviso(
        `Venda registrada: ${moeda(r.data.totalVenda)}. Estoque atualizado.`,
      );
      await carregar();
    } catch (e) {
      const status = (e as { response?: { status: number } }).response?.status;
      setIncerta(!status || status >= 500 || status === 409);
      setErro(mensagem(e));
      await carregar();
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function estornarVenda() {
    const id = vendaEstorno?.[0].vendaId;
    if (!id || travaEstorno.current || !confirmouEstorno || motivoEstorno.trim().length < 5) return;
    travaEstorno.current = true;
    setEstornando(true);
    setErroEstorno('');
    try {
      const { data } = await api.post<{ jaEstornada: boolean }>(`/estoque/vendas/${id}/estornar`, { motivo: motivoEstorno });
      setVendaEstorno(null);
      setAviso(data.jaEstornada ? 'Esta venda já estava estornada. Nenhuma devolução foi repetida.' : 'Venda estornada. Estoque e pontos devolvidos; saída financeira registrada.');
      await Promise.all([carregar(), historico()]);
    } catch (error) {
      setErroEstorno(mensagem(error));
      // A mesma venda pode ser consultada/repetida sem duplicar o estorno após timeout.
    } finally {
      travaEstorno.current = false;
      setEstornando(false);
    }
  }
  const grupos = Object.values(
    (resumo?.vendas || []).reduce<Record<string, Venda[]>>((r, v) => {
      (r[v.vendaId || v.id] ||= []).push(v);
      return r;
    }, {}),
  );
  if (carregando) return <SkeletonPage />;
  return (
    <div className="estoque-page">
      <header className="estoque-header">
        <div>
          <p className="estoque-eyebrow">Produtos e operação</p>
          <h1>Estoque</h1>
          <p>Seu catálogo, suas vendas. Tudo em um só lugar.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => editar()}
          disabled={ocupado}
        >
          <Plus size={20} /> Novo produto
        </button>
      </header>
      {erro && (
        <div role="alert" className="estoque-erro">
          {erro}{" "}
          <button
            onClick={() => {
              setErro("");
              if (aba === "historico") void historico();
              else void carregar();
            }}
          >
            {aba === "historico"
              ? "Buscar vendas novamente"
              : "Atualizar catálogo"}
          </button>
        </div>
      )}
      {aviso && (
        <div role="status" className="estoque-aviso">
          {aviso}
        </div>
      )}
      {kpis && (
        <section className="estoque-kpis" aria-label="Resumo do estoque">
          {[
            [
              "Valor em estoque",
              moeda(kpis.valorCusto),
              "Custo de todos os produtos",
            ],
            [
              "Receita potencial",
              moeda(kpis.valorVenda),
              "Produtos com preço de venda",
            ],
            [
              "Lucro estimado",
              moeda(kpis.lucroEstimado),
              "Receita menos custo dos produtos precificados",
            ],
            [
              "Alertas",
              String(kpis.alertas),
              "Produtos no mínimo ou abaixo dele",
            ],
          ].map(([nome, valor, sub]) => (
            <article key={nome} className="card">
              <span>{nome}</span>
              <strong
                className={
                  nome === "Lucro estimado" && kpis.lucroEstimado < 0
                    ? "negativo"
                    : ""
                }
              >
                {valor}
              </strong>
              <small>{sub}</small>
            </article>
          ))}
        </section>
      )}
      {!!kpis?.semPreco && (
        <p className="estoque-muted">
          {kpis.semPreco} produto(s) sem preço de venda. Defina o preço para
          vender; receita e lucro estimados consideram apenas produtos
          precificados.
        </p>
      )}
      <nav className="estoque-tabs" aria-label="Área de estoque">
        <button
          aria-pressed={aba === "catalogo"}
          onClick={() => setAba("catalogo")}
        >
          Nova venda de produtos
        </button>
        <button
          aria-pressed={aba === "historico"}
          onClick={() => setAba("historico")}
        >
          Histórico de vendas
        </button>
      </nav>
      {aba === "catalogo" ? (
        <div className="estoque-layout">
          <section className="estoque-catalogo">
            <div className="estoque-busca">
              <MagnifyingGlass size={22} />
              <input
                aria-label="Buscar produtos"
                placeholder="Buscar um produto…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <button
                aria-label="Atualizar estoque"
                onClick={() => void carregar()}
                disabled={ocupado}
              >
                <ArrowClockwise size={20} />
              </button>
            </div>
            <div className="estoque-categorias" aria-label="Categorias">
              <button
                aria-pressed={!categoria}
                onClick={() => setCategoria("")}
              >
                Todos
              </button>
              {categorias.map((c) => (
                <button
                  key={c}
                  aria-pressed={categoria === c}
                  onClick={() => setCategoria(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <p className="estoque-muted">
              {visiveis.length} produto(s) no catálogo
            </p>
            {!visiveis.length && (
              <div className="card estoque-vazio">
                <Package size={36} />
                <h2>
                  {produtos.length
                    ? "Nenhum produto encontrado"
                    : "Seu catálogo começa aqui"}
                </h2>
                <p>
                  {produtos.length
                    ? "Experimente outra busca ou categoria."
                    : "Cadastre seu primeiro produto para começar a vender."}
                </p>
                <button
                  className="btn-secondary"
                  onClick={() =>
                    produtos.length
                      ? (setBusca(""), setCategoria(""))
                      : editar()
                  }
                >
                  {produtos.length ? "Limpar filtros" : "Cadastrar produto"}
                </button>
              </div>
            )}
            <div className="estoque-produtos">
              {visiveis.map((p) => {
                const noCarrinho =
                  carrinho.find((i) => i.produto.id === p.id)?.quantidade || 0;
                const preco = Number(p.precoVenda) > 0;
                return (
                  <article className="card estoque-produto" key={p.id}>
                    <div className="estoque-produto-top">
                      <span className="estoque-produto-icone">
                        <Package size={32} />
                      </span>
                      <button
                        aria-label={`Editar ${p.nome}`}
                        onClick={() => editar(p)}
                        disabled={ocupado || incerta}
                      >
                        <PencilSimple size={20} />
                      </button>
                    </div>
                    <small>{p.categoria || "Sem categoria"}</small>
                    <h2>{p.nome}</h2>
                    <strong>
                      {preco
                        ? moeda(Number(p.precoVenda))
                        : "Preço não definido"}
                    </strong>
                    <p>
                      {p.quantidade} {p.unidade} disponíveis
                    </p>
                    {p.quantidade <= p.quantidadeMinima && (
                      <span className="estoque-alerta">
                        {p.quantidade ? "Estoque baixo" : "Sem estoque"}
                      </span>
                    )}
                    <button
                      className="btn-primary"
                      disabled={
                        ocupado ||
                        incerta ||
                        (preco &&
                          (p.quantidade === 0 || noCarrinho >= p.quantidade))
                      }
                      onClick={() => (preco ? adicionar(p) : editar(p))}
                    >
                      <Plus size={18} />
                      {!preco
                        ? "Definir preço"
                        : noCarrinho
                          ? `Adicionar · ${noCarrinho} no carrinho`
                          : "Adicionar"}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
          <aside
            className="card estoque-carrinho"
            aria-label="Carrinho de produtos"
          >
            <div className="estoque-carrinho-titulo">
              <ShoppingCart size={24} />
              <h2>Sua venda</h2>
              <span>{unidades}</span>
            </div>
            <p className="estoque-muted">
              Somente produtos. Serviços são registrados separadamente.
            </p>
            {carrinho.length ? (
              <>
                <button
                  className="estoque-limpar"
                  disabled={ocupado || incerta}
                  onClick={() => {
                    setCarrinho([]);
                    limparDesconto();
                  }}
                >
                  Limpar carrinho
                </button>
                <div className="estoque-itens">
                  {carrinho.map((i) => (
                    <article key={i.produto.id} className="estoque-item">
                      <div>
                        <h3>{i.produto.nome}</h3>
                        <small>
                          {moeda(Number(i.produto.precoVenda))} por{" "}
                          {i.produto.unidade}
                        </small>
                      </div>
                      <button
                        aria-label={`Remover ${i.produto.nome}`}
                        disabled={ocupado || incerta}
                        onClick={() =>
                          setCarrinho((c) =>
                            c.filter((x) => x.produto.id !== i.produto.id),
                          )
                        }
                      >
                        <Trash size={18} />
                      </button>
                      <div className="estoque-quantidade">
                        <button
                          aria-label={`Diminuir ${i.produto.nome}`}
                          disabled={ocupado || incerta || i.quantidade <= 1}
                          onClick={() => quantidade(i.produto.id, -1)}
                        >
                          <Minus size={16} />
                        </button>
                        <span>{i.quantidade}</span>
                        <button
                          aria-label={`Aumentar ${i.produto.nome}`}
                          disabled={
                            ocupado ||
                            incerta ||
                            i.quantidade >= i.produto.quantidade
                          }
                          onClick={() => quantidade(i.produto.id, 1)}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <strong>
                        {moeda(Number(i.produto.precoVenda) * i.quantidade)}
                      </strong>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="estoque-vazio">
                <ShoppingCart size={38} />
                <h3>Seu carrinho está vazio</h3>
                <p>Adicione produtos do catálogo para montar uma venda.</p>
              </div>
            )}
            {invalido && (
              <p role="alert" className="estoque-erro">
                A quantidade ou o preço mudou. Ajuste os itens antes de
                finalizar.
              </p>
            )}
            <fieldset
              disabled={ocupado || incerta}
              className="estoque-desconto"
            >
              <legend>Cliente e desconto</legend>
              <BuscaCliente
                selectedClienteId={clienteId}
                onSelect={(id) => {
                  setClienteId(id);
                  if (id !== clienteId && tipoDesconto === "PONTOS") {
                    setTipoDesconto("NENHUM");
                    setValorDesconto("");
                  }
                }}
              />
              <div className="estoque-tipos-desconto">
                {[
                  ["NENHUM", "Sem desconto"],
                  ["REAIS", "Reais"],
                  ["PERCENTUAL", "Porcentagem"],
                  ["PONTOS", "Pontos"],
                ].map(([tipo, label]) => (
                  <button
                    type="button"
                    key={tipo}
                    aria-pressed={tipoDesconto === tipo}
                    disabled={
                      tipo === "PONTOS" && !pontosDisponiveis.habilitado
                    }
                    onClick={() => {
                      setTipoDesconto(tipo);
                      setValorDesconto("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tipoDesconto !== "NENHUM" && (
                <label htmlFor="valor-desconto-produtos">
                  {tipoDesconto === "PONTOS"
                    ? "Pontos a utilizar"
                    : tipoDesconto === "REAIS"
                      ? "Desconto em reais"
                      : "Desconto em porcentagem"}
                  <input
                    id="valor-desconto-produtos"
                    className="ds-input"
                    type="number"
                    min="0"
                    step={tipoDesconto === "REAIS" ? "0.01" : "1"}
                    value={valorDesconto}
                    onChange={(e) => setValorDesconto(e.target.value)}
                  />
                </label>
              )}
              {pontosDisponiveis.motivo && (
                <small>{pontosDisponiveis.motivo}</small>
              )}
              {clienteId && saldo.chave === chaveSaldo && saldo.dados && (
                <small>
                  Saldo: {saldo.dados.saldoPontos} pontos · Máximo nesta venda:{" "}
                  {saldo.dados.maxPontosUtilizaveis}
                </small>
              )}
              {simulando && <p role="status">Calculando desconto…</p>}
              {erroDesconto && (
                <p role="alert" className="estoque-erro">
                  {erroDesconto}
                </p>
              )}
              {(erroDesconto || saldo.erro) && (
                <button
                  type="button"
                  onClick={() => setTentativaDesconto((t) => t + 1)}
                >
                  Tentar novamente
                </button>
              )}
            </fieldset>
            <div className="estoque-total">
              <span>Subtotal</span>
              <span>{moeda(total)}</span>
              <span>Desconto</span>
              <span>
                {carrinho.length
                  ? calculo
                    ? moeda(calculo.valorDesconto)
                    : "—"
                  : moeda(0)}
              </span>
              <strong>Total da venda</strong>
              <strong>
                {carrinho.length
                  ? calculo
                    ? moeda(calculo.valorLiquido)
                    : "—"
                  : moeda(0)}
              </strong>
            </div>
            <label htmlFor="pagamento-produtos">Forma de pagamento</label>
            <select
              id="pagamento-produtos"
              className="ds-select"
              value={pagamento}
              disabled={ocupado || incerta}
              onChange={(e) =>
                setPagamento(e.target.value as keyof typeof formas)
              }
            >
              {Object.entries(formas).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {incerta && (
              <div role="alert" className="estoque-erro">
                Confira o histórico antes de iniciar outra venda.{" "}
                <button onClick={() => setAba("historico")}>
                  Ver histórico
                </button>
                <button
                  disabled={ocupado}
                  onClick={() => {
                    setIncerta(false);
                    setCarrinho([]);
                    limparDesconto();
                    chave.current = crypto.randomUUID();
                    setErro("");
                  }}
                >
                  Já conferi: iniciar nova venda
                </button>
              </div>
            )}
            <button
              className="btn-primary estoque-finalizar"
              disabled={
                ocupado ||
                incerta ||
                !carrinho.length ||
                invalido ||
                bloqueioDesconto
              }
              onClick={() => void finalizar()}
            >
              {ocupado ? "Registrando venda…" : "Finalizar venda"}
            </button>
            <small className="estoque-muted">
              O estoque e os preços são conferidos ao confirmar.
            </small>
          </aside>
        </div>
      ) : (
        <section className="estoque-historico">
          <div className="estoque-filtros">
            <label>
              De
              <input
                aria-label="Data inicial"
                type="date"
                className="ds-input"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </label>
            <label>
              Até
              <input
                aria-label="Data final"
                type="date"
                className="ds-input"
                value={fim}
                onChange={(e) => setFim(e.target.value)}
              />
            </label>
            <button className="btn-secondary" onClick={() => void historico()}>
              Buscar vendas
            </button>
          </div>
          {carregandoHistorico ? (
            <p role="status">Carregando vendas…</p>
          ) : (
            <>
              <p>
                {resumo?.totalUnidades || 0} unidades · Receita{" "}
                {moeda(resumo?.totalReceita || 0)} · Lucro{" "}
                {moeda(resumo?.totalLucro || 0)}
                {' '}· Totais das vendas não estornadas
              </p>
              {!grupos.length && (
                <div className="card estoque-vazio">
                  Nenhuma venda neste período.
                </div>
              )}
              {grupos.map((g) => (
                <article
                  key={g[0].vendaId || g[0].id}
                  className="card estoque-venda"
                >
                  <h3>
                    {g[0].vendaId ? "Venda de produtos" : "Registro anterior"} ·{" "}
                    {new Date(g[0].data).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })}
                  </h3>
                  {g[0].venda?.estornadaEm && (
                    <p>Estornada em {new Date(g[0].venda.estornadaEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} · {g[0].venda.motivoEstorno}</p>
                  )}
                  {g.map((v) => (
                    <p key={v.id}>
                      {v.quantidade} × {v.nomeProduto}
                      <strong>
                        {moeda(
                          Number(v.precoVenda) * v.quantidade -
                            Number(v.descontoRateado ?? 0),
                        )}
                      </strong>
                    </p>
                  ))}
                  {Number(g[0].venda?.valorDesconto) > 0 && (
                    <p>
                      Desconto (
                      {g[0].venda?.tipoDesconto === "PONTOS"
                        ? `${g[0].venda?.pontosUtilizados} pontos`
                        : g[0].venda?.tipoDesconto === "PERCENTUAL"
                          ? `${g[0].venda?.descontoPercentual}%`
                          : "reais"}
                      )
                      <strong>
                        {moeda(Number(g[0].venda?.valorDesconto))}
                      </strong>
                    </p>
                  )}
                  <p>
                    {formas[g[0].formaPagamento as keyof typeof formas]}
                    <strong>
                      Total{" "}
                      {moeda(
                        g.reduce(
                          (s, v) =>
                            s +
                            Number(v.precoVenda) * v.quantidade -
                            Number(v.descontoRateado ?? 0),
                          0,
                        ),
                      )}
                    </strong>
                  </p>
                  {g[0].vendaId && !g[0].venda?.estornadaEm && (
                    <button className="btn-secondary" onClick={() => {
                      setVendaEstorno(g); setMotivoEstorno(''); setConfirmouEstorno(false); setErroEstorno('');
                    }}>Estornar venda</button>
                  )}
                  {!g[0].vendaId && <p>Registro anterior sem vínculo auditável: estorno automático indisponível.</p>}
                </article>
              ))}
            </>
          )}
        </section>
      )}
      <Modal aberto={!!vendaEstorno} onFechar={() => !estornando && setVendaEstorno(null)} titulo="Estornar venda de produtos">
        <form className="estoque-form" onSubmit={e => { e.preventDefault(); void estornarVenda(); }}>
          <p>Estorno integral de {moeda(Number(vendaEstorno?.[0].venda?.total ?? 0))}. Os produtos voltam ao estoque e os pontos utilizados são devolvidos. O histórico será preservado.</p>
          <p>O sistema registra a devolução financeira, mas não envia Pix nem cancela cobranças na operadora. Confirme o reembolso por {formas[vendaEstorno?.[0].formaPagamento as keyof typeof formas]} antes de prosseguir.</p>
          <label>Motivo do estorno<textarea className="ds-input" required minLength={5} maxLength={500} value={motivoEstorno} disabled={estornando} onChange={e => setMotivoEstorno(e.target.value)} /></label>
          <label className="estoque-confirmacao"><input type="checkbox" checked={confirmouEstorno} disabled={estornando} onChange={e => setConfirmouEstorno(e.target.checked)} />Confirmo a devolução dos produtos e o reembolso integral.</label>
          {erroEstorno && <p role="alert">{erroEstorno} Você pode repetir a confirmação desta mesma venda sem duplicar o estorno.</p>}
          <button className="btn-primary" disabled={estornando || !confirmouEstorno || motivoEstorno.trim().length < 5}>{estornando ? 'Estornando…' : 'Confirmar estorno'}</button>
        </form>
      </Modal>
      <Modal
        aberto={modal}
        onFechar={() => !salvando && setModal(false)}
        titulo={editando ? "Editar produto" : "Novo produto"}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          className="estoque-form"
        >
          {erroForm && (
            <p role="alert" className="estoque-erro">
              {erroForm}
            </p>
          )}
          {(
            [
              ["nome", "Nome", "text"],
              ["categoria", "Categoria", "text"],
              ["quantidade", "Quantidade", "number"],
              ["unidade", "Unidade", "text"],
              ["quantidadeMinima", "Mínimo para alerta", "number"],
              ["custo", "Custo unitário (R$)", "number"],
              ["precoVenda", "Preço de venda (R$)", "number"],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} htmlFor={`produto-${key}`}>
              {label}
              <input
                id={`produto-${key}`}
                className="ds-input"
                type={type}
                min={type === "number" ? 0 : undefined}
                step={
                  key === "custo" || key === "precoVenda" ? "0.01" : undefined
                }
                maxLength={key === "categoria" ? 60 : undefined}
                list={key === "categoria" ? "categorias-produtos" : undefined}
                required={!["categoria", "precoVenda"].includes(key)}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <datalist id="categorias-produtos">
            {categorias
              .filter((c) => c !== "Sem categoria")
              .map((c) => (
                <option key={c} value={c} />
              ))}
          </datalist>
          <button disabled={salvando} className="btn-primary" type="submit">
            {salvando ? "Salvando…" : "Salvar produto"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
