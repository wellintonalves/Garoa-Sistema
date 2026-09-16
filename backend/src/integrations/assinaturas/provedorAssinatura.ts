export type EstadoIntegracaoCancelamento =
  | 'NAO_CONFIGURADO'
  | 'PENDENTE'
  | 'CONFIRMADO'
  | 'FALHA';

export type FormaPagamentoCheckout = 'PIX' | 'CREDIT_CARD';

function validarCartaoRecorrente(entrada: EntradaCheckoutAssinatura): ResultadoCheckoutProvedor | null {
  if (!Array.isArray(entrada.formasPagamento) || entrada.formasPagamento.length !== 1 || entrada.formasPagamento[0] !== 'CREDIT_CARD') {
    return { estado: 'FALHA', mensagem: 'A assinatura recorrente aceita somente cartão de crédito.', criacaoConfirmadamenteRecusada: true };
  }
  return null;
}

export interface EntradaCancelamentoProvedor {
  solicitacaoId: string;
  barbeariaId: string;
  assinaturaExternaId: string;
  chaveIdempotencia: string;
}

export interface ResultadoCancelamentoProvedor {
  estado: EstadoIntegracaoCancelamento;
  mensagem: string;
  confirmadoEm?: Date;
  fimAcessoEm?: Date;
  podeTentarNovamente?: boolean;
}

export interface EntradaCheckoutAssinatura {
  referenciaExterna: string;
  nomeItem: string;
  descricao: string;
  valorCentavos: number;
  periodicidade: 'MENSAL' | 'ANUAL';
  primeiroVencimento: Date;
  formasPagamento: FormaPagamentoCheckout[];
}

export interface EntradaCheckoutAvulso {
  referenciaExterna: string;
  nomeItem: string;
  descricao: string;
  valorCentavos: number;
  formasPagamento: FormaPagamentoCheckout[];
}

export interface ResultadoCheckoutProvedor {
  criacaoConfirmadamenteRecusada?: boolean;
  estado: 'NAO_CONFIGURADO' | 'CRIADO' | 'FALHA';
  mensagem: string;
  checkoutId?: string;
  checkoutUrl?: string;
  expiraEm?: Date;
  podeTentarNovamente?: boolean;
}

export interface ResultadoConsultaAssinaturaProvedor {
  estado: 'NAO_CONFIGURADO' | 'ATIVA' | 'INATIVA' | 'NAO_ENCONTRADA' | 'FALHA';
  mensagem: string;
  assinaturaExternaId?: string;
  proximaCobrancaEm?: Date;
}

export interface ProvedorAssinatura {
  consultarCobranca?(entrada: VinculoCobranca): Promise<ResultadoCobranca>;
  usarCartaoDaCobranca?(entrada: VinculoCobranca & { remoteIp: string }): Promise<ResultadoSincronizacaoRecorrencia>;
  atualizarRecorrencia(entrada: EntradaAtualizarRecorrencia): Promise<ResultadoSincronizacaoRecorrencia>;
  cancelarCobrancaPendente(entrada: { cobrancaExternaId: string; assinaturaExternaId: string }): Promise<ResultadoCancelarCobranca>;
  readonly nome: string;
  readonly configurado: boolean;
  readonly ambiente: 'DESATIVADO' | 'LOCAL_FAKE' | 'SANDBOX' | 'PRODUCTION';
  readonly motivoIndisponibilidade?: string;
  criarCheckoutAssinatura(
    entrada: EntradaCheckoutAssinatura,
  ): Promise<ResultadoCheckoutProvedor>;
  criarCheckoutAvulso(
    entrada: EntradaCheckoutAvulso,
  ): Promise<ResultadoCheckoutProvedor>;
  cancelarRenovacao(
    entrada: EntradaCancelamentoProvedor,
  ): Promise<ResultadoCancelamentoProvedor>;
  consultarAssinatura(
    assinaturaExternaId: string,
  ): Promise<ResultadoConsultaAssinaturaProvedor>;
}

export interface VinculoCobranca {
  cobrancaExternaId: string;
  assinaturaExternaId: string;
  clienteExternoId: string;
}

export interface ResultadoCobranca {
  estado: 'CONFIRMADO' | 'FALHA';
  mensagem: string;
  status?: string;
  invoiceUrl?: string;
}

export interface EntradaAtualizarRecorrencia {
  assinaturaExternaId: string;
  valorCentavos: number;
  periodicidade: 'MENSAL' | 'ANUAL';
  proximoVencimento: Date;
}
export interface ResultadoSincronizacaoRecorrencia {
  estado: 'CONFIRMADO' | 'PENDENTE' | 'FALHA' | 'NAO_CONFIGURADO';
  mensagem: string;
}
export interface ResultadoCancelarCobranca {
  estado: 'CONFIRMADO' | 'PAGA' | 'PENDENTE' | 'FALHA' | 'NAO_CONFIGURADO';
  mensagem: string;
}

const MENSAGEM_DESATIVADO =
  'A integração financeira está desativada. Nenhuma operação externa foi executada.';

export class ProvedorAssinaturaNaoConfigurado implements ProvedorAssinatura {
  async atualizarRecorrencia(): Promise<ResultadoSincronizacaoRecorrencia> { return { estado: 'NAO_CONFIGURADO', mensagem: MENSAGEM_DESATIVADO }; }
  async cancelarCobrancaPendente(): Promise<ResultadoCancelarCobranca> { return { estado: 'NAO_CONFIGURADO', mensagem: MENSAGEM_DESATIVADO }; }
  readonly nome = 'ASAAS';
  readonly configurado = false;
  readonly ambiente = 'DESATIVADO' as const;
  readonly motivoIndisponibilidade: string;

  constructor(motivo = MENSAGEM_DESATIVADO) {
    this.motivoIndisponibilidade = motivo;
  }

  async criarCheckoutAssinatura(): Promise<ResultadoCheckoutProvedor> {
    return { estado: 'NAO_CONFIGURADO', mensagem: this.motivoIndisponibilidade };
  }

  async criarCheckoutAvulso(): Promise<ResultadoCheckoutProvedor> {
    return { estado: 'NAO_CONFIGURADO', mensagem: this.motivoIndisponibilidade };
  }

  async cancelarRenovacao(): Promise<ResultadoCancelamentoProvedor> {
    return {
      estado: 'NAO_CONFIGURADO',
      mensagem:
        'A solicitação foi registrada, mas a renovação ainda depende de processamento manual.',
      podeTentarNovamente: false,
    };
  }

  async consultarAssinatura(): Promise<ResultadoConsultaAssinaturaProvedor> {
    return { estado: 'NAO_CONFIGURADO', mensagem: this.motivoIndisponibilidade };
  }
}

export class ProvedorAssinaturaFakeLocal implements ProvedorAssinatura {
  async atualizarRecorrencia(): Promise<ResultadoSincronizacaoRecorrencia> { return { estado: 'CONFIRMADO', mensagem: 'Recorrência atualizada somente na simulação.' }; }
  async cancelarCobrancaPendente(): Promise<ResultadoCancelarCobranca> { return { estado: 'CONFIRMADO', mensagem: 'Cobrança removida somente na simulação.' }; }
  readonly nome = 'ASAAS_FAKE_LOCAL';
  readonly configurado = true;
  readonly ambiente = 'LOCAL_FAKE' as const;
  private sequencia = 0;
  private readonly assinaturas = new Map<string, 'ATIVA' | 'REMOVIDA'>();

  constructor(nodeEnv = process.env.NODE_ENV, private readonly origemLocal = 'http://127.0.0.1:5174') {
    if (nodeEnv === 'production') {
      throw new Error('O provedor fake local é proibido em produção.');
    }
    const origem = new URL(origemLocal);
    if (origem.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(origem.hostname)
      || origem.username || origem.password || origem.search || origem.hash || origem.pathname !== '/') throw new Error('O checkout simulado exige endereço local.');
    this.origemLocal = origem.origin;
  }

  private proximoId(prefixo: string, referencia: string): string {
    this.sequencia += 1;
    const segura = referencia.replace(/[^A-Za-z0-9]/g, '').slice(-12) || 'local';
    return `${prefixo}_fake_${segura}_${this.sequencia}`;
  }

  async criarCheckoutAssinatura(
    entrada: EntradaCheckoutAssinatura,
  ): Promise<ResultadoCheckoutProvedor> {
    const invalida = validarCartaoRecorrente(entrada);
    if (invalida) return invalida;
    const checkoutId = this.proximoId('chk', entrada.referenciaExterna);
    return {
      estado: 'CRIADO',
      mensagem: 'Checkout simulado localmente; nenhuma cobrança externa foi criada.',
      checkoutId,
      checkoutUrl: `${this.origemLocal}/dev/checkout?checkout=${encodeURIComponent(checkoutId)}`,
      expiraEm: new Date(Date.now() + 30 * 60_000),
    };
  }

  async criarCheckoutAvulso(
    entrada: EntradaCheckoutAvulso,
  ): Promise<ResultadoCheckoutProvedor> {
    const checkoutId = this.proximoId('chk', entrada.referenciaExterna);
    return {
      estado: 'CRIADO',
      mensagem: 'Cobrança avulsa simulada localmente; nenhuma operação externa foi criada.',
      checkoutId,
      checkoutUrl: `${this.origemLocal}/dev/checkout?checkout=${encodeURIComponent(checkoutId)}`,
      expiraEm: new Date(Date.now() + 30 * 60_000),
    };
  }

  registrarAssinaturaFake(assinaturaExternaId: string): void {
    this.assinaturas.set(assinaturaExternaId, 'ATIVA');
  }

  async cancelarRenovacao(
    entrada: EntradaCancelamentoProvedor,
  ): Promise<ResultadoCancelamentoProvedor> {
    this.assinaturas.set(entrada.assinaturaExternaId, 'REMOVIDA');
    return {
      estado: 'CONFIRMADO',
      mensagem: 'Recorrência cancelada somente no simulador local.',
      confirmadoEm: new Date(),
    };
  }

  async consultarAssinatura(
    assinaturaExternaId: string,
  ): Promise<ResultadoConsultaAssinaturaProvedor> {
    const estado = this.assinaturas.get(assinaturaExternaId);
    if (estado === 'REMOVIDA' || !estado) {
      return { estado: 'NAO_ENCONTRADA', mensagem: 'Assinatura ausente no simulador local.' };
    }
    return {
      estado: 'ATIVA',
      mensagem: 'Assinatura ativa somente no simulador local.',
      assinaturaExternaId,
    };
  }
}

type FetchLike = typeof fetch;

interface ConfiguracaoAsaasSandbox {
  accountId?: string;
  apiKey: string;
  webhookToken: string;
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
  userAgent: string;
  checkoutExpiracaoMinutos: number;
}

interface ErroAsaas {
  errors?: Array<{ code?: string; description?: string }>;
}

function dataIsoLocal(data: Date): string {
  if (!(data instanceof Date) || Number.isNaN(data.getTime())) {
    throw new Error('Data inválida para o checkout.');
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

function validarUrlRetorno(valor: string, nome: string): string {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`${nome} inválida.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${nome} deve usar HTTP ou HTTPS.`);
  }
  return url.toString();
}

function validarCheckoutUrl(valor: unknown, ambiente: 'SANDBOX' | 'PRODUCTION'): string {
  if (typeof valor !== 'string') throw new Error('O Asaas não retornou o link do checkout.');
  const url = new URL(valor);
  const hosts = ambiente === 'PRODUCTION' ? ['www.asaas.com', 'asaas.com'] : ['sandbox.asaas.com'];
  if (url.protocol !== 'https:' || url.username || url.password || !hosts.includes(url.hostname)) {
    throw new Error('O Asaas retornou um link fora do ambiente esperado.');
  }
  return url.toString();
}

function mensagemErroAsaas(status: number, corpo: unknown): string {
  const erros = (corpo as ErroAsaas | null)?.errors;
  const detalhe = Array.isArray(erros)
    ? erros.map((erro) => erro.description).filter(Boolean).join(' ')
    : '';
  return detalhe || `O Sandbox Asaas respondeu com HTTP ${status}.`;
}

class ProvedorAsaas implements ProvedorAssinatura {
  private contaVerificadaEm = 0;
  private async lerCobrancaVinculada(entrada: VinculoCobranca) {
    if (!entrada.cobrancaExternaId || !entrada.assinaturaExternaId || !entrada.clienteExternoId) return null;
    const resposta = await this.requisitar<Record<string, unknown>>(`/payments/${encodeURIComponent(entrada.cobrancaExternaId)}`, { method: 'GET' });
    const dados = resposta.corpo;
    if (resposta.status !== 200 || !dados || dados.deleted || dados.id !== entrada.cobrancaExternaId ||
      dados.subscription !== entrada.assinaturaExternaId || dados.customer !== entrada.clienteExternoId) return null;
    return dados;
  }

  async consultarCobranca(entrada: VinculoCobranca): Promise<ResultadoCobranca> {
    try {
      const dados = await this.lerCobrancaVinculada(entrada);
      if (!dados) return { estado: 'FALHA', mensagem: 'Não foi possível confirmar a cobrança desta assinatura.' };
      const status = String(dados.status || '');
      const invoiceUrl = ['PENDING', 'OVERDUE', 'CONFIRMED', 'RECEIVED'].includes(status)
        ? validarCheckoutUrl(dados.invoiceUrl, this.ambiente) : undefined;
      return { estado: 'CONFIRMADO', mensagem: 'Cobrança conferida no Asaas.', status, invoiceUrl };
    } catch {
      return { estado: 'FALHA', mensagem: 'Não foi possível consultar a cobrança no Asaas. Tente novamente.' };
    }
  }

  async usarCartaoDaCobranca(entrada: VinculoCobranca & { remoteIp: string }): Promise<ResultadoSincronizacaoRecorrencia> {
    try {
      const pagamento = await this.lerCobrancaVinculada(entrada);
      const cartao = pagamento?.creditCard as { creditCardToken?: unknown } | undefined;
      if (!pagamento || !['CONFIRMED', 'RECEIVED'].includes(String(pagamento.status)) || typeof cartao?.creditCardToken !== 'string' || !cartao.creditCardToken) {
        return { estado: 'FALHA', mensagem: 'Pague a fatura com o cartão desejado antes de utilizá-lo nas próximas renovações.' };
      }
      const path = `/subscriptions/${encodeURIComponent(entrada.assinaturaExternaId)}`;
      const assinatura = await this.requisitar<Record<string, unknown>>(path, { method: 'GET' });
      if (assinatura.status !== 200 || assinatura.corpo?.id !== entrada.assinaturaExternaId || assinatura.corpo?.customer !== entrada.clienteExternoId || assinatura.corpo?.status !== 'ACTIVE' || assinatura.corpo?.deleted) {
        return { estado: 'FALHA', mensagem: 'A recorrência não está ativa para atualizar o cartão.' };
      }
      // O token nunca é persistido nem devolvido à aplicação cliente. Esta rota não cobra.
      const atualizacao = await this.requisitar<Record<string, unknown>>(`${path}/creditCard`, {
        method: 'PUT', body: JSON.stringify({ creditCardToken: cartao.creditCardToken, remoteIp: entrada.remoteIp }),
      });
      return atualizacao.status === 200
        ? { estado: 'CONFIRMADO', mensagem: 'Cartão atualizado para as próximas renovações. Nenhuma cobrança foi realizada nesta atualização.' }
        : { estado: 'PENDENTE', mensagem: 'O Asaas não confirmou a atualização do cartão. Consulte o suporte antes de tentar novamente.' };
    } catch {
      return { estado: 'PENDENTE', mensagem: 'Não foi possível confirmar a atualização do cartão. Consulte o suporte antes de tentar novamente.' };
    }
  }
  async atualizarRecorrencia(entrada: EntradaAtualizarRecorrencia): Promise<ResultadoSincronizacaoRecorrencia> {
    if (!entrada.assinaturaExternaId || !Number.isSafeInteger(entrada.valorCentavos) || entrada.valorCentavos <= 0 || !['MENSAL', 'ANUAL'].includes(entrada.periodicidade) || !Number.isFinite(entrada.proximoVencimento?.getTime())) return { estado: 'FALHA', mensagem: 'Dados de recorrência inválidos.' };
    const path = `/subscriptions/${encodeURIComponent(entrada.assinaturaExternaId)}`;
    const esperado = { value: entrada.valorCentavos / 100, cycle: entrada.periodicidade === 'ANUAL' ? 'YEARLY' : 'MONTHLY', nextDueDate: dataIsoLocal(entrada.proximoVencimento) };
    const confere = (corpo: Record<string, unknown> | null) => corpo?.id === entrada.assinaturaExternaId && !corpo.deleted && corpo.status !== 'INACTIVE' && Math.round(Number(corpo.value) * 100) === entrada.valorCentavos && corpo.cycle === esperado.cycle && corpo.nextDueDate === esperado.nextDueDate;
    try {
      const atual = await this.requisitar<Record<string, unknown>>(path, { method: 'GET' });
      if (atual.status !== 200 || !atual.corpo || atual.corpo.id !== entrada.assinaturaExternaId || atual.corpo.deleted || atual.corpo.status === 'INACTIVE') return { estado: 'PENDENTE', mensagem: 'Não foi possível confirmar uma recorrência ativa para alteração.' };
      if (confere(atual.corpo)) return { estado: 'CONFIRMADO', mensagem: 'Recorrência já corresponde à alteração solicitada.' };
      const alteracao = await this.requisitar<Record<string, unknown>>(path, { method: 'PUT', body: JSON.stringify({ ...esperado, updatePendingPayments: true }) });
      if (alteracao.status < 200 || alteracao.status >= 300) return { estado: alteracao.status >= 500 ? 'PENDENTE' : 'FALHA', mensagem: 'O provedor não confirmou a alteração da recorrência.' };
      const verificada = await this.requisitar<Record<string, unknown>>(path, { method: 'GET' });
      return verificada.status === 200 && confere(verificada.corpo)
        ? { estado: 'CONFIRMADO', mensagem: 'Valor, ciclo e próximo vencimento confirmados no provedor.' }
        : { estado: 'PENDENTE', mensagem: 'A alteração da recorrência aguarda reconciliação.' };
    } catch { return { estado: 'PENDENTE', mensagem: 'Não foi possível confirmar a alteração da recorrência. A próxima tentativa consultará o estado antes de alterar.' }; }
  }

  async cancelarCobrancaPendente(entrada: { cobrancaExternaId: string; assinaturaExternaId: string }): Promise<ResultadoCancelarCobranca> {
    if (!entrada.cobrancaExternaId || !entrada.assinaturaExternaId) return { estado: 'FALHA', mensagem: 'Identificadores de cobrança e assinatura obrigatórios.' };
    const path = `/payments/${encodeURIComponent(entrada.cobrancaExternaId)}`;
    try {
      const atual = await this.requisitar<Record<string, unknown>>(path, { method: 'GET' });
      if (atual.status === 404) return { estado: 'CONFIRMADO', mensagem: 'Cobrança não está mais disponível no provedor.' };
      if (atual.status !== 200 || !atual.corpo || atual.corpo.id !== entrada.cobrancaExternaId || atual.corpo.subscription !== entrada.assinaturaExternaId) return { estado: 'PENDENTE', mensagem: 'Não foi possível confirmar o vínculo da cobrança.' };
      if (atual.corpo.deleted === true) return { estado: 'CONFIRMADO', mensagem: 'Cobrança já removida.' };
      if (['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(atual.corpo.status))) return { estado: 'PAGA', mensagem: 'A cobrança está paga; nenhuma exclusão foi realizada.' };
      if (!['PENDING', 'OVERDUE'].includes(String(atual.corpo.status))) return { estado: 'PENDENTE', mensagem: 'A cobrança não está em um estado seguro para remoção.' };
      const removida = await this.requisitar<Record<string, unknown>>(path, { method: 'DELETE' });
      if (removida.status < 200 || removida.status >= 300) return { estado: 'PENDENTE', mensagem: 'A remoção da cobrança aguarda confirmação.' };
      const final = await this.requisitar<Record<string, unknown>>(path, { method: 'GET' });
      if (final.status === 404 || (final.status === 200 && final.corpo?.id === entrada.cobrancaExternaId && final.corpo?.subscription === entrada.assinaturaExternaId && final.corpo?.deleted === true)) return { estado: 'CONFIRMADO', mensagem: 'Remoção da cobrança confirmada.' };
      if (final.status === 200 && ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(final.corpo?.status))) return { estado: 'PAGA', mensagem: 'Pagamento identificado durante a conferência; revisar a assinatura.' };
      return { estado: 'PENDENTE', mensagem: 'Não foi possível confirmar a remoção da cobrança.' };
    } catch { return { estado: 'PENDENTE', mensagem: 'Estado da cobrança indeterminado. Nenhuma confirmação de cancelamento foi registrada.' }; }
  }
  readonly nome = 'ASAAS';
  readonly configurado = true;
  private readonly baseUrl: string;

  constructor(
    private readonly configuracao: ConfiguracaoAsaasSandbox,
    private readonly fetchImpl: FetchLike = fetch,
    readonly ambiente: 'SANDBOX' | 'PRODUCTION' = 'SANDBOX',
  ) {
    const prefixo = ambiente === 'PRODUCTION' ? '$aact_prod_' : '$aact_hmlg_';
    if (!configuracao.apiKey.startsWith(prefixo)) throw new Error('Chave incompatível com o ambiente de cobrança.');
    this.baseUrl = ambiente === 'PRODUCTION' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
  }

  private async requisitar<T>(
    caminho: string,
    opcoes: RequestInit,
    timeoutMs = 20_000,
  ): Promise<{ status: number; corpo: T | null }> {
    if (this.ambiente === 'PRODUCTION' && opcoes.method !== 'GET' && Date.now() - this.contaVerificadaEm > 5 * 60_000) {
      const conta = await this.requisitar<{ id?: string; general?: string }>('/myAccount/status', { method: 'GET' });
      if (!this.configuracao.accountId || conta.status !== 200 || conta.corpo?.id !== this.configuracao.accountId || conta.corpo?.general !== 'APPROVED') {
        throw new Error('A conta Asaas de produção não corresponde à conta autorizada ou ainda não está aprovada.');
      }
      this.contaVerificadaEm = Date.now();
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const resposta = await this.fetchImpl(`${this.baseUrl}${caminho}`, {
        ...opcoes,
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          access_token: this.configuracao.apiKey,
          'user-agent': this.configuracao.userAgent,
          ...(opcoes.headers || {}),
        },
      });
      const texto = await resposta.text();
      const corpo = texto ? JSON.parse(texto) as T : null;
      return { status: resposta.status, corpo };
    } finally {
      clearTimeout(timer);
    }
  }

  private callback() {
    return {
      successUrl: this.configuracao.successUrl,
      cancelUrl: this.configuracao.cancelUrl,
      expiredUrl: this.configuracao.expiredUrl,
    };
  }

  async criarCheckoutAssinatura(
    entrada: EntradaCheckoutAssinatura,
  ): Promise<ResultadoCheckoutProvedor> {
    const invalida = validarCartaoRecorrente(entrada);
    if (invalida) return invalida;
    try {
      const { status, corpo } = await this.requisitar<Record<string, unknown> | ErroAsaas>(
        '/checkouts',
        {
          method: 'POST',
          body: JSON.stringify({
            billingTypes: entrada.formasPagamento,
            chargeTypes: ['RECURRENT'],
            minutesToExpire: this.configuracao.checkoutExpiracaoMinutos,
            externalReference: entrada.referenciaExterna,
            callback: this.callback(),
            items: [{
              name: entrada.nomeItem.slice(0, 30),
              description: entrada.descricao,
              quantity: 1,
              value: entrada.valorCentavos / 100,
            }],
            subscription: {
              cycle: entrada.periodicidade === 'ANUAL' ? 'YEARLY' : 'MONTHLY',
              nextDueDate: dataIsoLocal(entrada.primeiroVencimento),
            },
          }),
        },
      );
      if (status < 200 || status >= 300 || !corpo) {
        return {
          estado: 'FALHA',
          mensagem: mensagemErroAsaas(status, corpo),
          podeTentarNovamente: status >= 400 && status < 500,
          criacaoConfirmadamenteRecusada: status >= 400 && status < 500,
        };
      }
      const checkoutId = String((corpo as Record<string, unknown>).id || '');
      if (!checkoutId) throw new Error('O Asaas não retornou o identificador do checkout.');
      const checkoutUrl = validarCheckoutUrl((corpo as Record<string, unknown>).link, this.ambiente);
      return {
        estado: 'CRIADO',
        mensagem: 'Checkout criado. A assinatura só será ativada após confirmação por webhook.',
        checkoutId,
        checkoutUrl,
        expiraEm: new Date(Date.now() + this.configuracao.checkoutExpiracaoMinutos * 60_000),
      };
    } catch (error) {
      return {
        estado: 'FALHA',
        mensagem: error instanceof Error ? error.message : 'Falha ao criar checkout no Sandbox Asaas.',
        podeTentarNovamente: false,
      };
    }
  }

  async criarCheckoutAvulso(
    entrada: EntradaCheckoutAvulso,
  ): Promise<ResultadoCheckoutProvedor> {
    try {
      const { status, corpo } = await this.requisitar<Record<string, unknown> | ErroAsaas>(
        '/checkouts',
        {
          method: 'POST',
          body: JSON.stringify({
            billingTypes: entrada.formasPagamento,
            chargeTypes: ['DETACHED'],
            minutesToExpire: this.configuracao.checkoutExpiracaoMinutos,
            externalReference: entrada.referenciaExterna,
            callback: this.callback(),
            items: [{
              name: entrada.nomeItem.slice(0, 30),
              description: entrada.descricao,
              quantity: 1,
              value: entrada.valorCentavos / 100,
            }],
          }),
        },
      );
      if (status < 200 || status >= 300 || !corpo) {
        return {
          estado: 'FALHA',
          mensagem: mensagemErroAsaas(status, corpo),
          podeTentarNovamente: status >= 400 && status < 500,
          criacaoConfirmadamenteRecusada: status >= 400 && status < 500,
        };
      }
      const checkoutId = String((corpo as Record<string, unknown>).id || '');
      if (!checkoutId) throw new Error('O Asaas não retornou o identificador do checkout.');
      const checkoutUrl = validarCheckoutUrl((corpo as Record<string, unknown>).link, this.ambiente);
      return {
        estado: 'CRIADO',
        mensagem: 'Checkout avulso criado. A mudança só será aplicada após o webhook de pagamento.',
        checkoutId,
        checkoutUrl,
        expiraEm: new Date(Date.now() + this.configuracao.checkoutExpiracaoMinutos * 60_000),
      };
    } catch (error) {
      return {
        estado: 'FALHA',
        mensagem: error instanceof Error ? error.message : 'Falha ao criar checkout no Sandbox Asaas.',
        podeTentarNovamente: false,
      };
    }
  }

  async cancelarRenovacao(
    entrada: EntradaCancelamentoProvedor,
  ): Promise<ResultadoCancelamentoProvedor> {
    try {
      const { status, corpo } = await this.requisitar<ErroAsaas>(
        `/subscriptions/${encodeURIComponent(entrada.assinaturaExternaId)}`,
        { method: 'DELETE' },
      );
      if (status >= 200 && status < 300) {
        return {
          estado: 'CONFIRMADO',
          mensagem: 'A recorrência foi removida no Asaas.',
          confirmadoEm: new Date(),
        };
      }
      return {
        estado: status >= 500 ? 'PENDENTE' : 'FALHA',
        mensagem: mensagemErroAsaas(status, corpo),
        podeTentarNovamente: false,
      };
    } catch (error) {
      return {
        estado: 'PENDENTE',
        mensagem:
          error instanceof Error
            ? error.message
            : 'Não foi possível confirmar a remoção da recorrência no Sandbox Asaas.',
        podeTentarNovamente: false,
      };
    }
  }

  async consultarAssinatura(
    assinaturaExternaId: string,
  ): Promise<ResultadoConsultaAssinaturaProvedor> {
    try {
      const { status, corpo } = await this.requisitar<Record<string, unknown> | ErroAsaas>(
        `/subscriptions/${encodeURIComponent(assinaturaExternaId)}`,
        { method: 'GET' },
      );
      if (status === 404) {
        return { estado: 'NAO_ENCONTRADA', mensagem: 'Assinatura não encontrada no Sandbox Asaas.' };
      }
      if (status < 200 || status >= 300 || !corpo) {
        return { estado: 'FALHA', mensagem: mensagemErroAsaas(status, corpo) };
      }
      const dados = corpo as Record<string, unknown>;
      return {
        estado: dados.deleted === true || ['INACTIVE', 'EXPIRED'].includes(String(dados.status)) ? 'INATIVA' : dados.status === 'ACTIVE' ? 'ATIVA' : 'FALHA',
        mensagem: 'Assinatura consultada no Sandbox Asaas.',
        assinaturaExternaId: String(dados.id || assinaturaExternaId),
        proximaCobrancaEm:
          typeof dados.nextDueDate === 'string' ? new Date(`${dados.nextDueDate}T12:00:00-03:00`) : undefined,
      };
    } catch (error) {
      return {
        estado: 'FALHA',
        mensagem: error instanceof Error ? error.message : 'Falha ao consultar assinatura no Sandbox Asaas.',
      };
    }
  }
}

export class ProvedorAsaasSandbox extends ProvedorAsaas {
  constructor(configuracao: ConfiguracaoAsaasSandbox, fetchImpl: FetchLike = fetch) { super(configuracao, fetchImpl, 'SANDBOX'); }
}

export class ProvedorAsaasProducao extends ProvedorAsaas {
  constructor(configuracao: ConfiguracaoAsaasSandbox, fetchImpl: FetchLike = fetch) { super(configuracao, fetchImpl, 'PRODUCTION'); }
}

export function criarProvedorAssinatura(
  ambiente: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): ProvedorAssinatura {
  if (ambiente.ASSINATURA_PROVEDOR === 'fake') {
    if (
      ambiente.NODE_ENV === 'production' ||
      ambiente.ASSINATURA_FAKE_LOCAL_ENABLED !== 'true'
    ) {
      return new ProvedorAssinaturaNaoConfigurado(
        'O provedor fake só pode ser habilitado explicitamente fora de produção.',
      );
    }
    return new ProvedorAssinaturaFakeLocal(ambiente.NODE_ENV, ambiente.ASSINATURA_FAKE_ORIGIN || 'http://127.0.0.1:5174');
  }
  const producao = ambiente.ASSINATURA_ASAAS_PRODUCTION_ENABLED === 'true';
  if (producao && (!ambiente.ASAAS_ACCOUNT_ID?.trim() || ambiente.ASSINATURA_JOBS_ENABLED !== 'true')) {
    return new ProvedorAssinaturaNaoConfigurado('Produção exige a identificação da conta Asaas autorizada e os processos de assinatura habilitados.');
  }
  if (!producao && ambiente.ASSINATURA_ASAAS_SANDBOX_ENABLED !== 'true') {
    return new ProvedorAssinaturaNaoConfigurado();
  }
  if ((!producao && ambiente.NODE_ENV === 'production') || (producao && (ambiente.NODE_ENV !== 'production' || ambiente.ASSINATURA_ASAAS_SANDBOX_ENABLED === 'true'))) {
    return new ProvedorAssinaturaNaoConfigurado(
      'A integração recusou uma combinação incompatível de ambientes.',
    );
  }
  if (ambiente.ASAAS_ENV !== (producao ? 'production' : 'sandbox')) {
    return new ProvedorAssinaturaNaoConfigurado(
      'A integração recusou iniciar porque ASAAS_ENV não está definido como sandbox.',
    );
  }
  const apiKey = ambiente.ASAAS_API_KEY || '';
  if (!apiKey.startsWith(producao ? '$aact_prod_' : '$aact_hmlg_')) {
    return new ProvedorAssinaturaNaoConfigurado(
      'A integração recusou iniciar porque a chave não possui o prefixo de Sandbox.',
    );
  }
  const webhookToken = ambiente.ASAAS_WEBHOOK_TOKEN || '';
  if (webhookToken.length < 32 || /\s/.test(webhookToken)) {
    return new ProvedorAssinaturaNaoConfigurado(
      'A integração recusou iniciar porque o token do webhook não atende aos requisitos mínimos.',
    );
  }
  try {
    const minutos = Number(ambiente.ASAAS_CHECKOUT_EXPIRACAO_MINUTOS || 30);
    if (!Number.isInteger(minutos) || minutos < 10 || minutos > 1440) {
      throw new Error('ASAAS_CHECKOUT_EXPIRACAO_MINUTOS deve ficar entre 10 e 1440.');
    }
    const urls = [ambiente.ASAAS_CHECKOUT_SUCCESS_URL, ambiente.ASAAS_CHECKOUT_CANCEL_URL, ambiente.ASAAS_CHECKOUT_EXPIRED_URL];
    if (producao && urls.some(valor => { const url = new URL(valor || ''); return url.protocol !== 'https:' || !!url.username || !!url.password || ['localhost','127.0.0.1','[::1]'].includes(url.hostname); })) throw new Error('Produção exige URLs de retorno HTTPS públicas.');
    const Classe = producao ? ProvedorAsaasProducao : ProvedorAsaasSandbox;
    return new Classe({
      accountId: ambiente.ASAAS_ACCOUNT_ID?.trim(),
      apiKey,
      webhookToken,
      successUrl: validarUrlRetorno(ambiente.ASAAS_CHECKOUT_SUCCESS_URL || '', 'URL de sucesso'),
      cancelUrl: validarUrlRetorno(ambiente.ASAAS_CHECKOUT_CANCEL_URL || '', 'URL de cancelamento'),
      expiredUrl: validarUrlRetorno(ambiente.ASAAS_CHECKOUT_EXPIRED_URL || '', 'URL de expiração'),
      userAgent: ambiente.ASAAS_USER_AGENT || `ValenBarber/1.0 (Node.js; ${producao ? 'production' : 'sandbox'})`,
      checkoutExpiracaoMinutos: minutos,
    }, fetchImpl);
  } catch (error) {
    return new ProvedorAssinaturaNaoConfigurado(
      error instanceof Error ? error.message : 'Configuração do Sandbox Asaas inválida.',
    );
  }
}

export function validarTokenWebhookAsaas(
  recebido: string | undefined,
  ambiente: NodeJS.ProcessEnv = process.env,
): boolean {
  const esperado = ambiente.ASAAS_WEBHOOK_TOKEN || '';
  if (esperado.length < 32 || !recebido || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let indice = 0; indice < esperado.length; indice += 1) {
    diferenca |= esperado.charCodeAt(indice) ^ recebido.charCodeAt(indice);
  }
  return diferenca === 0;
}

export const provedorAssinatura: ProvedorAssinatura = criarProvedorAssinatura();
