# Base da assistente de IA

Implementada em 27/09/2026, sem alteração de schema, migration, escrita em produção ou deploy.

## O que está implementado

O painel abre nas áreas autenticadas de administrador, barbeiro e cliente atual. O acesso em forma de balão fica à direita, em uma faixa própria para não cobrir os botões de agendamento nem o chat humano. O painel usa diálogo nativo com foco contido, Escape e retorno do foco. O componente aceita `avatarUrl`; a foto pode ser incorporada depois. O portal legado `/b/:slug/app` ainda não recebe a assistente.

`GET /ia/admin/status`, `/ia/barbeiro/status` e `/ia/cliente/:barbeariaId/status` usam as autenticações existentes e conferem identidade/vínculo no banco. Tenant enviado por cliente só seleciona o vínculo a validar, nunca concede acesso. Não retornam dados de outros clientes, prompts, chave ou configuração interna. O administrador precisa continuar sendo administrador daquele tenant; barbeiro precisa estar ativo; cliente precisa ter vínculo ativo.

`POST .../mensagens` e `POST .../voz/sessoes` retornam 503 após autorização. Nenhuma configuração libera consumo nesta entrega. Os saldos desconhecidos aparecem como indisponíveis, nunca como zero ou franquia intacta. Interface tem skeleton, erro com nova tentativa e estado vazio. Não há conversa simulada apresentada como real.

O adaptador de texto usa `POST https://api.openai.com/v1/responses`, modelo explícito, chave apenas no backend, `store: false`, limite técnico de saída de 512 tokens e timeout de 30 segundos. Está isolado das rotas. Testes usam transporte simulado. Não houve chamada real à OpenAI, validação de chave ou de acesso a modelos. Não há ferramenta de criação de chave disponível nesta sessão.

O adaptador não tem acesso a dados do sistema, ferramentas de escrita ou SQL. Não preserva histórico. Integração de contexto, agendamentos e lançamentos exigirá ferramentas permitidas por papel, autorização por operação, serializers e confirmação de ações sensíveis. A lógica fica em serviços independentes da interface HTTP para permitir outros canais futuramente.

## Franquias e decisões pendentes

Básico: 100 mensagens de texto por mês. Pro: 200 mensagens de texto e 1.800 segundos de voz por mês. Tudo compartilhado por barbearia, somando usuários e sessões. As mensagens são configuráveis no servidor. Crédito é outra unidade: quantidade por plano e conversão continuam sem valor padrão. Não prometer que uma franquia de créditos garantirá 100/200 mensagens antes de fechar essa relação. Na ativação, definir o que conta como mensagem faturável, incluindo falhas, tentativas e chamadas internas da agente, sem cobrar novamente uma repetição idempotente.

Também falta decidir renovação por mês de calendário ou aniversário da assinatura, tratamento de upgrade/downgrade e compra extra. Qualquer fronteira de período deve ser calculada em `America/Sao_Paulo`, com instantes persistidos em UTC; assinatura anual não transforma franquia mensal em anual.

`IA_VOZ_CREDITOS` precisa escolher explicitamente `TODOS_CUSTOS` (sessão de voz e backend consomem créditos) ou `APENAS_BACKEND` (sessão fica só no teto de voz; backend consome créditos). São opções de implementação, não decisão comercial do usuário. Nenhuma é escolhida por padrão. Precificação por modelo e versão de tarifa ainda precisa entrar no cálculo de reserva. Configuração ausente ou inválida deve bloquear, nunca significar ilimitado. Esgotar voz não elimina mensagens ou créditos de texto.

Os limites de 4.000 caracteres/512 tokens do adaptador são proteções técnicas desta base, ainda sem efeito em consumo real; revisar e comunicar na ativação. Não são equivalência comercial entre mensagem e crédito.

## Voz preparada, ainda sem transporte

Não há WebRTC, captura de microfone, emissão de token nem sessão paga nesta entrega. O modelo de voz continua sem seleção. GPT-Live 1 foi referência de discussão; GPT-6 Sol é candidato a teste para texto, não modelo fixado. A chave central deve ser configurada no serviço backend Railway, nunca em variável VITE ou fornecida por tenant.

A política pura de inatividade retorna aviso aos 45 segundos e encerramento aos 60. Esses 45 segundos são escolha técnica para o aviso. Enquanto usuário fala, agente responde ou ferramenta executa, o supervisor deve manter atividade e reiniciar o relógio ao terminar. A política sozinha não encerra sessões: o supervisor persistente e a ligação aos eventos do provedor ainda serão implementados. Relógio do browser não será autoridade.

A sessão precisa ser encerrada pelo servidor ao atingir a reserva/teto, inclusive em desconexão do browser. Silêncio e execução de backend podem ser cobrados pelo provedor: duração faturável e inatividade são medidas diferentes. O teto de 30 minutos deve reservar segundos de todas as sessões simultâneas. Uma sessão sem resposta de fechamento permanece reservada até reconciliação, para não liberar saldo já consumido.

## Persistência proposta, não aplicada

Não existe contador de consumo em memória. `RepositorioCotasIa` é contrato; sua única implementação rejeita reservas e liquidações. Portanto a preparação impede consumo concorrente bloqueando todas as requisições, mas não demonstra ainda uma quota transacional operacional.

Proposta sujeita a aprovação específica de schema, seguida de revisão de drift:

- `IaPeriodo`: tenant obrigatório, início/fim UTC, plano e versão de política, franquias de mensagens/créditos/voz em inteiros e respectivos valores consumidos/reservados; unicidade por tenant/início. Constraints impedem negativos e consumido + reservado acima da franquia.
- `IaReserva`: período/tenant, ator/papel, chave idempotente única por tenant, hash do pedido, máximos reservados, canal, estado, prazo e identificador do provedor. A mesma chave com outro corpo deve falhar.
- `IaUso`: ledger imutável por reserva/evento do provedor, consumo de mensagens, tokens, créditos e segundos. Duplicatas não debitam novamente. Guardar versão de tarifa, sem prompts ou dados privados por padrão.
- `IaSessaoVoz`: tenant, ator, reserva, id da sessão do provedor, início/fim, última atividade confiável, estado e motivo do encerramento. Relações compostas devem impedir referências entre tenants, com `onDelete: Restrict` para registros de consumo.

Reserva exige transação PostgreSQL com bloqueio da linha do período e débito condicional atômico, antes de chamar o provedor. Todos os trabalhadores usam o mesmo banco. Reservar o custo máximo de entrada/saída/ferramentas autorizado e os segundos antes de permitir uso. Liquidar idempotentemente pelo uso confirmado; falhas ambíguas não liberam reserva automaticamente. Reconciliação recupera quedas após aceitação pelo provedor. Não iniciar nova sessão sem capacidade reservada. Testes futuros devem usar duas conexões/processos reais, renovação, repetição de webhook, falha de rede e queda entre chamada/liquidação.

Impactos: agendamentos, financeiro, comissões e fidelidade permanecem sem escrita pela agente; nenhuma relação existente precisa ser alterada nesta proposta. Relatórios ganham consumo de IA separado de receitas/comissões, sem misturar custo da plataforma com venda da barbearia. Histórico do cliente permanece intacto; eventual histórico de conversa precisa de política própria de retenção e acesso por tenant/cliente. Backup diário e exportação/exclusão precisam contemplar as novas tabelas preservando o ledger e sem relações SetNull. Confirmar também políticas RLS e a extensão Prisma para novos modelos.

Railway CLI não está disponível neste ambiente e não há configuração de produção autorizada acessível para executar o diff. Drift não verificado. Antes de aplicar a proposta, executar pelo contexto legítimo do Railway o comando de leitura prescrito no AGENTS.md (`prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`), sem imprimir credenciais. Não executar migration/db push nesta tarefa.

Próxima autorização necessária: aprovação específica para modelar essas quatro estruturas em `schema.prisma`, após verificar drift e revisar os impactos acima. A decisão atual do usuário é continuar sem banco; esta entrega respeita essa decisão.

## Fontes consultadas

- [Responses API e configuração no servidor](https://developers.openai.com/api/docs/quickstart)
- [GPT-Live: integração de voz](https://developers.openai.com/api/docs/guides/live)
- [Voz: duração faturável, silêncio e cobrança de backend](https://developers.openai.com/api/docs/guides/voice-latency-cost)
- [Preços oficiais](https://developers.openai.com/api/docs/pricing)

Não se usa estimativa de preço como orçamento ou franquia aprovada. Acesso real aos modelos depende da conta OpenAI e ainda não foi testado.

## Validação

`npm run test:ia --workspace=barbearia-backend` cobre políticas, bloqueio concorrente, adaptador com HTTP simulado e isolamento HTTP com banco simulado. Não testa OpenAI ou PostgreSQL reais. Builds completos obrigatórios: frontend (incluindo lint de cores) e backend (incluindo geração do cliente Prisma, sem alterar banco).

Validação local concluída: ambos os builds passaram, assim como os 53 testes existentes do frontend e os testes da base de IA. O script `frontend/scripts/teste-ia-ui.cjs`, com Vite local e Playwright disponível em `NODE_PATH`, verifica o componente em Edge headless nas larguras 375, 768 e 1920 px, usando respostas simuladas. Cobriu skeleton, erro/retry, estado de preparação, tamanho de toque, ausência de overflow horizontal, Escape e retorno de foco. Capturas ficam em `node_modules/ia-*.png`, fora do versionamento. Essa verificação é do componente isolado, não do fluxo completo autenticado com banco real.

Avisos das dependências já existentes: Prisma alerta sobre a configuração legada em package.json; Vite alerta sobre `eval` em lottie-web; npm ci informou três vulnerabilidades de severidade alta. Não foram alteradas dependências nesta tarefa.
