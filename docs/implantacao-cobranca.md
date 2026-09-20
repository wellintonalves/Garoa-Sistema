# Implantação de cobranças SaaS — pacote para aprovação

## Resultado em 15/09/2026

Correções locais concluídas; cobrança real não ativada. Nenhuma credencial foi exibida e nenhum dado de produção foi escrito. `schema.prisma` não foi alterado nesta tarefa (SHA256 B0F1B050540CD9189387DA97B5C351B30C85AD4E3DD62FD685875C0223DFAB74).

Railway: projeto `artistic-happiness`, ambiente `production`, serviços `barbearia-backend`, `barbearia-frontend` e `Postgres`. Backend publicado: commit `f299d3e71818d1a9be0600e86705cf3970237fa4`, deploy de 14/09/2026. As mudanças de assinatura e estas correções ainda são locais, com arquivos anteriores modificados/não rastreados; não foram incluídas em commit ou push.

Consulta ao serviço backend: `NODE_ENV=production`; ausentes chave Asaas, token de webhook, flags de integração/jobs e callbacks. Portanto não foi constatado sandbox ativo em produção. A identidade da conta Asaas ainda não foi verificada.

Consulta ao serviço Postgres, em transação READ ONLY: ausentes as quatro tabelas de assinatura e as colunas de transição legada. A comparação `prisma migrate diff` somente leitura gerou `diagnostico-drift-cobranca.sql`: seis tabelas novas, três tabelas existentes recebem colunas, nove constraints de relacionamento adicionais (12 ALTER TABLE ao todo), dez enums novos, nenhum DROP. O diagnóstico inclui alterações preexistentes de preferências, auditoria e aceite porque o código local atual já depende delas; não representa uma revisão editorial de políticas.

## Comportamento implementado

- A fatura é consultada no Asaas e só retorna ao administrador após conferir cobrança, assinatura, cliente, estado e domínio do ambiente. A aplicação não cria outra cobrança para regularizar a anterior. Confirmar retorno de navegação não libera acesso; o webhook financeiro continua sendo necessário.
- Depois de pagar a fatura com o cartão desejado no Asaas, o administrador pode confirmar seu uso nas próximas renovações. O servidor busca o token dessa cobrança paga, valida a recorrência e usa `PUT /subscriptions/{id}/creditCard`, sem cobrança imediata. Não recebe PAN/CVV, não persiste nem retorna token. A troca preventiva por cartão ainda não usado em uma fatura não faz parte desse caminho; deve ser tratada pelo suporte no provedor. A disponibilidade/tokenização da conta precisa ser homologada.
- Estorno total do pagamento do ciclo vigente passa o contrato para consulta/exportação, preservando histórico. Não afirma cancelamento de recorrência sem confirmação externa; o administrador pode usar o cancelamento existente. Estornos antigos não retiram um novo período pago.
- Contestações, estornos parciais e estornos em processamento ficam visíveis como revisão, sem exigir outro pagamento. Preservam o período já concedido. Reversões de upgrade são vinculadas ao contrato para revisão, preservando o período base. Não há downgrade automático que possa apagar/exceder cadastros.
- Confirmações antigas não desfazem estorno nem reabrem acesso. Uma confirmação posterior a uma contestação só resolve a revisão após consulta vinculada no Asaas confirmar o pagamento. Duplicatas não prolongam prazos. Reversões de upgrade e estornos parciais que precisem de decisão comercial continuam encaminhados ao suporte; o registro financeiro não é apagado.
- Produção exige `ASAAS_ACCOUNT_ID` e jobs habilitados. Antes de mutações financeiras, o adaptador consulta a conta, confere o ID autorizado e aprovação (cache de cinco minutos). Webhooks produtivos também conferem `account.id`.
- Removido localmente `prisma db push` do comando de início da Railway. O comando publicado ainda é o antigo até ocorrer um deploy aprovado; não reiniciar/republicar o código novo antes da preparação do banco.

## Impacto obrigatório do SQL proposto

O arquivo `implantacao-cobranca.sql` encapsula o diff em uma transação, com lock_timeout de 5s e statement_timeout de 120s. Classifica as barbearias já existentes como legadas; novas barbearias continuam com default false. Não é idempotente: se o ambiente já mudou, deve abortar e exigir nova comparação, em vez de ocultar divergências.

| Área | Impacto e proteção |
| --- | --- |
| Agendamentos | Nenhuma coluna/linha alterada. Os gates de assinatura do código passam a controlar novas alterações após a transição; registros existentes permanecem. |
| Financeiro | Lançamentos de serviços/produtos não são alterados nem usados como confirmação de cobrança SaaS. Dados SaaS ficam em tabelas próprias. |
| Comissões | Valores, percentuais e vínculos históricos preservados; nenhuma recomputação. |
| Fidelidade | Pontos, saldos e relações preservados; sem recomputação ou exclusão. |
| Relatórios | Fontes históricas permanecem. Consulta/exportação segue o estado do contrato; tabelas SaaS não são somadas às receitas da barbearia. |
| Histórico do cliente | Clientes e vínculos preservados. `clientes_barbearias.ativo` nasce true e `arquivadoEm` null; não desativa nem exclui ninguém. |

Ensaio local do arquivo SQL completo: baseline de produção versionado → dados sintéticos com cliente, barbeiro, serviço, agendamento, lançamento/comissão e pontos → SQL proposto → comparação sem drift. As seis tabelas de histórico testadas mantiveram os mesmos registros/valores. Reaplicação abortou e rollback preservou os dados. Esse ensaio não substitui backup real anterior à execução.

## Ordem de implantação, ainda não executada

1. Obter autorização específica de exceção à proibição de escrita no banco de produção do AGENTS.md, limitada à execução única do arquivo SQL revisado. Não precisa alterar novamente `schema.prisma`.
2. Em janela de manutenção, registrar os IDs dos deploys backend/frontend atuais e impedir novas gravações enquanto captura/valida o backup e aplica SQL. Confirmar `RUN_FIX_ORPHANS` e `RUN_DB_COPY` desabilitados. Não habilitar produção Asaas nem jobs durante essa preparação.
3. Criar backup completo PostgreSQL pelo mecanismo do provedor ou `pg_dump` compatível com a versão do servidor, executado com variáveis obtidas por Railway CLI. Guardar fora do repositório, com acesso restrito. Registrar timestamp/checksum; restaurar uma cópia em banco isolado e verificar contagens, somas do financeiro/comissões, pontos e vínculos. Só prosseguir com restauração ensaiada e backup recente confirmado. Não enviar dump ou credenciais pelo chat.
4. Repetir a comparação somente leitura; se diferir de `diagnostico-drift-cobranca.sql`, parar e revisar o pacote. Aplicar o SQL aprovado uma única vez com falha imediata em erro, conferir ausência de drift e invariantes. Não usar `db push`, `--accept-data-loss` nem aplicar simultaneamente as migrations preexistentes e este SQL equivalente.
5. Separar/registrar o conjunto completo de alterações de assinatura e dependências já existentes no workspace, preservando alterações de outros assuntos. Rodar ambos builds e testes, publicar frontend/backend juntos. Verificar no painel que o startCommand efetivo é somente `node dist/server.js`.
6. Provisionar e homologar a conta por canal seguro conforme abaixo. Só então habilitar cobrança e jobs com a conta conferida. Fazer consultas de saúde e fatura autenticadas; não realizar cobrança real de teste sem autorização específica.
7. Monitorar entrega e processamento dos webhooks, erros e cancelamentos pendentes. Conferir efetivamente primeiro pagamento, renovação, recusa/regularização e cancelamento antes de considerar operação homologada.

## Provisionamento seguro e homologação Asaas

O titular deve inserir `ASAAS_API_KEY` diretamente em Railway → projeto → production → barbearia-backend → Variables. A chave deve ser da conta de produção correta e nunca ser enviada no chat. Provisionar também token aleatório de webhook com pelo menos 32 caracteres; manter `ASSINATURA_ASAAS_PRODUCTION_ENABLED=false` até todas as dependências estarem prontas.

Com acesso à chave pelo ambiente, consultar apenas GET `/myAccount/status` e `/myAccount/commercialInfo`, conferir com o titular a identidade da conta e salvar `ASAAS_ACCOUNT_ID`. A aprovação geral deve estar APPROVED. Confirmar com Asaas habilitação da tokenização necessária à atualização do cartão/recorrência. Não adivinhar uma conta nem reutilizar uma chave sandbox em produção.

Configuração final planejada: `NODE_ENV=production`, `ASAAS_ENV=production`, `ASSINATURA_ASAAS_SANDBOX_ENABLED=false`, `ASSINATURA_FAKE_LOCAL_ENABLED=false`, callbacks HTTPS para a rota real `/configuracoes`, `ASSINATURA_JOBS_ENABLED=true` e `ASSINATURA_ASAAS_PRODUCTION_ENABLED=true` somente no momento aprovado de ativação. O endpoint público é `/assinatura/webhooks/asaas` no domínio real do backend. Asaas deve usar o mesmo token no cabeçalho `asaas-access-token`.

Eventos mínimos: CHECKOUT_CREATED/PAID/CANCELED/EXPIRED, SUBSCRIPTION_CREATED/DELETED, PAYMENT_CONFIRMED/RECEIVED/OVERDUE/CREDIT_CARD_CAPTURE_REFUSED/REPROVED_BY_RISK_ANALYSIS, PAYMENT_REFUNDED/PARTIALLY_REFUNDED/REFUND_IN_PROGRESS/CHARGEBACK_REQUESTED/CHARGEBACK_DISPUTE/AWAITING_CHARGEBACK_REVERSAL. Conferir fila habilitada, não interrompida e notificações de falha. Não substituir configurações de outros produtos da conta.

Homologação externa pendente por falta de credencial: em sandbox isolado, validar checkout recorrente e trial, eventos reais do provedor e suas referências, renovação mensal/anual, recusa, pagamento via invoiceUrl, atualização do cartão/tokenização, timeout, reentrega, estorno e cancelamento. Os testes atuais simulam o Asaas; nenhum resultado deve ser descrito como homologação real. A conta real pode ser verificada por GET sem cobrar, mas isso não substitui o ensaio de fluxo.

## Retorno em caso de falha

- Antes do COMMIT, erro/timeout aborta a transação; executar ROLLBACK e manter versão anterior.
- Após o COMMIT, preferir rollback dos dois serviços para os deploys anteriores, mantendo as novas tabelas/colunas aditivas. Não executar DROP nem apagar eventos, assinaturas ou recibos criados.
- Desabilitar novas contratações em incidente, preservar recepção/reconciliação dos webhooks e consultar Asaas antes de repetir criação/cancelamento. Desativar a integração local não cancela assinaturas no Asaas.
- Restaurar backup de produção somente como recuperação de desastre, com manutenção e decisão explícita, pois sobrescreveria gravações posteriores. Preservar eventos financeiros posteriores e reconciliar antes de reabrir.

## Evidências de validação local

- Teste de fluxo completo corrigido com relógio fixo: aprovado.
- Regras, limites, cancelamento, adaptador Asaas, conta produtiva/ambientes, sincronização e regularização: aprovados com rede simulada.
- PostgreSQL descartável em 127.0.0.1:55434: suites de webhook/acesso e reversões/regularização/isolamento aprovadas.
- Pacote SQL proposto: aplicado somente em banco descartável; invariantes e ausência de drift aprovadas.
- Frontend: oito testes aprovados (regularização, planos e cliente HTTP); prévia do componente real em 375, 768 e 1920px sem overflow, alvos de 48px. Erro de transporte visível e botão de tentar novamente; aceite habilita atualização de cartão.
- Builds completos frontend/backend aprovados; repetir após qualquer mudança posterior antes do push. Aviso preexistente de eval no lottie-web e de depreciação de configuração Prisma não impediram os builds.

Referências oficiais: https://docs.asaas.com/docs/webhook-para-cobrancas, https://docs.asaas.com/reference/atualizar-cartao-de-credito-assinatura, https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta.
