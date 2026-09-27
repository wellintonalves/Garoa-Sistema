# Persistência de IA aprovada e implementada localmente

O usuário aprovou as estruturas de IA em 27/09/2026. Este documento descreve o código final desta etapa; não solicita a mesma aprovação novamente. A migration foi preparada e testada em PostgreSQL local, sem aplicação em produção, push ou deploy. As políticas comerciais ainda indefinidas não foram convertidas em valores padrão.

## Drift e ciclos de assinatura

Antes de editar schema, a Railway CLI já instalada no cache e o vínculo legítimo do projeto permitiram consultar produção. A URL interna do backend retornou P1001; um hash de host/banco confirmou que o serviço Postgres era o mesmo usado pelo backend. O diff usou a URL pública fornecida pelo serviço, somente no subprocesso via `railway run --service Postgres --environment production --no-local`.

`prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel backend/prisma/schema.prisma --script` retornou código 0 e `This is an empty migration`. Nenhuma credencial foi exibida ou gravada e nenhum SQL de alteração foi executado. Essa evidência vale para o schema anterior à adição de IA. Prisma não cobre integralmente políticas RLS/triggers; revisar essas estruturas e repetir drift antes de aplicar a migration futura.

O financeiro usa `calcularFimCiclo` em America/Sao_Paulo e persiste o vencimento confirmado pelo pagamento, não a chegada do webhook. Upgrade mantém datas; downgrade e periodicidade são agendados para o fim do ciclo. O job pode alterar a periodicidade antes do próximo pagamento, portanto a regra de IA também compara a duração com o ciclo mensal calculado. Cancelamento de renovação não elimina o período já pago, mas `fimAcessoEm` limita novas reservas. Teste de sete dias e tolerância de pagamento existem no sistema; não foram tratados como franquia grátis de IA.

## Schema final

Foram adicionados quatro models e enums. A lista exata de campos está em `backend/prisma/schema.prisma`; a migration contém DDL e constraints adicionais. Datas novas usam timestamptz(3), contadores usam Int, custo calculado usa BigInt em microunidades de USD.

`IaPeriodo` (`ia_periodos`) guarda id, tenant, assinatura, início/fim, plano, versões de política/tarifa, limite/reservado/consumido para mensagens, segundos e créditos, flag de bloqueio e criação. Como só o ciclo mensal confirmado é suportado, início/fim já são o snapshot do ciclo; não foi duplicado um segundo par de datas. Não existe saldo acumulado. Só se cria período com configuração completa, por isso limites são obrigatórios. Unique tenant/início impede reabertura; FK composta tenant/assinatura impede associação cruzada; unique tenant/id dá suporte às FKs filhas. Um trigger serializa e rejeita intervalos sobrepostos, sem instalar extensão PostgreSQL.

`IaReserva` (`ia_reservas`) guarda id, tenant, período, usuário/papel, canal, chave idempotente de até 128 caracteres, hash SHA-256 do envelope, estado, máximos de mensagens/segundos/créditos, custo por crédito, modelo/tarifas de entrada/saída congelados, criação/atualização/prazo de envio e resposta cifrada/expiração. Estados: RESERVADA, ENVIANDO, INCERTA, CONCLUIDA, FALHA_CONFIRMADA. Unique tenant/chave; FK composta tenant/período e FK de usuário, Restrict. O cliente é global: vínculo com o tenant é conferido em ClienteBarbearia, não por Usuario.barbeariaId.

`IaUso` (`ia_usos`) guarda id, tenant, reserva, chave única do evento, id de resposta do provedor, tokens de entrada/saída, mensagens, segundos, créditos, custo calculado e instante de registro. Um resultado final por reserva, suficiente para esta versão de texto sem ferramentas. Chamadas adicionais internas deverão ser agregadas e comprovadas antes da liquidação se ferramentas forem introduzidas; não estão implementadas. Unique tenant/reserva e evento impedem duplicação. FK composta e trigger proíbem alteração/exclusão de eventos. Não há ajuste negativo automático ou cobrança financeira da barbearia.

`IaSessaoVoz` (`ia_sessoes_voz`) guarda id, tenant, reserva única, id de sessão do provedor único, estado, início, última atividade, ocupação até, encerramento até, solicitação/confirmação de fechamento, motivo, segundos finais, lease/prazo/versão e auditoria. Estados: PREPARANDO, ATIVA, ENCERRANDO, ENCERRADA, INCERTA. FK composta tenant/reserva, Restrict; índices por estado/prazo e lease. Ator/período vêm da reserva, evitando cópias divergentes. Criada junto da reserva; nenhuma sessão OpenAI é aberta por essa inserção.

Nos models existentes: coleções inversas em Barbearia, Usuario e AssinaturaSaas; unique `(barbeariaId, id)` em AssinaturaSaas. Não foram remodeladas relações de agenda, caixa, comissões ou fidelidade. Constraints SQL verificam não negativos, soma consumido+reservado dentro do limite, teto de voz 1800 apenas no Pro e formato da reserva por canal. Elas complementam os locks; o ledger mantém custo real reportado mesmo quando excede envelope, bloqueando o período para reconciliação.

## Reserva, liquidação e falhas

`RepositorioCotasPrisma` obtém lock transacional por tenant no PostgreSQL e depois lock da assinatura, relê ator/vínculo/status/ciclo e localiza o período. Novo período nasce uma vez; existente nunca sofre reset. A reserva debita capacidade antes de sair da transação. Plano ou versão divergente bloqueia novas concessões, sem inferir bônus de upgrade. Todas as queries incluem tenant; FKs compostas impedem referências cruzadas. A extensão Prisma usada nas rotas foi exercitada com AsyncLocalStorage no teste local.

Chave repetida com o mesmo ator/corpo reutiliza a reserva, inclusive após renovação. Chave reutilizada por outro ator/corpo retorna conflito sem revelar resposta alheia. CAS de RESERVADA para ENVIANDO permite apenas um envio. Nenhuma chamada OpenAI ocorre dentro da transação ou dentro do webhook financeiro.

Reserva expirada que nunca saiu de RESERVADA é liberada na manutenção transacional. ENVIANDO expirado vira INCERTA e continua ocupando saldo. Falha de transporte depois do envio não autoriza retry pago. `liquidar` aceita resultado verificado do orquestrador ou conciliador de confiança, verifica tenant/ator original e deduplica o resultado; não é uma rota que aceita uso declarado pelo navegador. A liquidação continua possível após revogação do ator, para não perder custo já contratado. Um evento tardio pertence ao período original; novo mês recebe franquia nova sem sobras.

Com store:false, uma falha sem id/usage recuperável pode não permitir conciliação automática. Esta versão preserva a reserva e exige evidência operacional para chamar o método de liquidação; não inventa uso zero nem reenvia. Não há endpoint administrativo de estorno ou rotina que consulte fatura da OpenAI. Se o uso final exceder a reserva, o evento é guardado, o período bloqueado e o saldo não é silenciosamente ajustado para aparentar conformidade. Resolver esse caso exige revisão operacional; não há recuperação automática de sobrecusto.

A resposta cifrada permite repetir o pedido sem gerar novamente. AAD inclui o UUID da reserva. Uma chave central própria e retenção explícita são obrigatórias antes de enviar. O job limpa conteúdo expirado em até um minuto enquanto o backend está ativo, sem apagar ledger. Rotação da chave precisa preservar capacidade de decifrar resultados não expirados; keyring não foi implementado. Não gravamos prompts ou conversas completas.

## Mensagens e custo

A opção implementada `IA_CONTAGEM_TEXTO=RESPOSTA_CONCLUIDA` significa um envio do usuário que gerou resposta completa, independentemente de raciocínio interno. Reserva uma mensagem antes e debita uma vez no final. Resposta incompleta com usage conhecido libera a mensagem, mas registra o custo de processamento. Timeout ambíguo mantém a reserva. A configuração fica vazia até aprovação da política; isso não é uma nova decisão comercial atribuída ao usuário.

Recomendação para a ativação: chamadas internas e fala não descontarem mensagens de texto; voz usar segundos e o orçamento de custo. O código de reserva de voz usa zero mensagens. Definir se os créditos abrangem voz e backend (`TODOS_CUSTOS`) ou só backend. Essa decisão ainda impede habilitar o transporte de voz.

Crédito não é mensagem nem minuto. Quantidade por plano e conversão continuam vazias. O cálculo de texto implementado usa tarifa conservadora de entrada sem desconto de cache e de saída por milhão, com arredondamento para cima. Isso precisa ser aprovado como regra de créditos; não é uma conciliação do valor exato faturado pela OpenAI. Reservas usam envelope técnico de 20.000 tokens de entrada/512 de saída por pedido de até 4.000 caracteres, sem histórico ou ferramentas. Recomendo dimensionar os créditos para garantir as 100/200 mensagens dentro desse envelope; se houver duas franquias independentes, informar ambas na oferta e no painel, sem bloqueio comercial oculto.

## Voz preparada e fronteira da integração

Reserva concorrente de segundos/créditos e sessão são atômicas. O orçamento somado de todas as sessões deve caber em 1800 segundos. `registrarInicioVoz`/`registrarAtividadeVoz` recebem eventos somente de adaptador confiável; relógio do browser não é autoridade. A sessão termina no máximo até o fim do período/acesso reservado.

O supervisor decide aviso aos 45 segundos ociosos e encerramento aos 60. Ocupação da agente impede falso abandono, com prazo técnico renovável por eventos confiáveis, mas nunca prolonga o teto reservado. Desconexão e limite encerram mesmo durante resposta. Lease persistente evita dois trabalhadores fecharem simultaneamente. Falha no fechamento marca INCERTA e mantém a reserva; só uso final verificado liquida e marca ENCERRADA.

`supervisionarVoz` é executável com transporte injetado e foi testado com simulação. Não há adaptador WebRTC/OpenAI, token efêmero ou worker contínuo conectado. A rota de voz retorna indisponível. Antes da ativação, validar um limite duro do fornecedor que inclua silêncio/inicialização/fechamento, além do supervisor contínuo e margem de encerramento. Cron de cinco minutos da assinatura não serve. Uma chave configurada sozinha não torna essa parte operacional.

## Políticas que ainda precisam de decisão

Anual: recomendar doze janelas mensais ancoradas no início do ciclo anual pago, com ajuste de fim de mês, sem conceder a franquia anual inteira. Código atual retorna pendência; a interpretação para assinatura anual precisa ser confirmada. Teste/tolerância: recomendar não abrir nova franquia de IA sem período pago confirmado, preservando o acesso já existente ao resto do sistema. Upgrade: recomendar elevar o teto do período, preservando o já consumido, em vez de dar outras 200 mensagens; decidir voz integral versus pró-rata. Downgrade acompanharia a próxima renovação financeira. Compra extra não foi implementada.

## Impactos e revisão antes de publicar

Agendamentos: nenhuma ferramenta da IA consulta/cria/altera reservas. Financeiro: nenhum lançamento, cobrança ou regra de receita mudou; custo OpenAI fica separado. Comissões: bases e cálculos intactos. Fidelidade: pontos/resgates intactos. Relatórios: tabelas de IA permitem relatório futuro por tenant/período; não foi acrescentado custo à receita/lucro da barbearia. Histórico do cliente: histórico operacional intacto; resultado cifrado é temporário e restrito ao ator.

As FKs Restrict passam a impedir exclusão física de usuário/barbearia/assinatura com uso. Revisar a compatibilidade com retenção/exportação antes de produção, sem contornar com SetNull ou cascata. O backup descobre tabelas por catálogo e FKs, mas cópia/restauração das novas tabelas e preservação dos triggers não foram testadas nesta etapa. RLS/grants ainda precisam de revisão específica no ambiente alvo; Prisma diff não comprova essas políticas. Esses pontos devem preceder deploy, sem ampliar deleções nesta tarefa.

## Evidência local e ativação

PostgreSQL nativo descartável, escutando apenas 127.0.0.1:55439. Primeiro aplicado o schema anterior; depois a migration de IA. Dois pools independentes disputaram 110 pedidos: exatamente 100 reservas no Básico. Foram testados saldo do Pro, concorrência de voz, limite de créditos, FK entre tenants, rejeição de outro ator, ledger imutável, duplicação de liquidação, falha de rede, renovação, resultado tardio, bloqueio por upgrade, limpeza de resultado e fechamento de voz com lease e falha de confirmação. OpenAI e transporte de voz foram simulados, sem consumo pago.

Scripts: `test:ia`, `test:ia-postgres` no backend, testes existentes do frontend e script de UI nas três larguras. Builds completos incluem lint de cores, TypeScript, Vite e geração Prisma. O script PostgreSQL valida host local e nome valen_ia_test antes de qualquer escrita. O schema/migration estão disponíveis para revisão; não há comando de migração automática no startup.

Para ativar texto: revisão/aplicação autorizada da migration em ambiente apropriado; aprovação e configuração dos campos comerciais/privacidade; chave e modelo central no Railway; teste real explicitamente autorizado; publicação autorizada. Para voz, completar primeiro a integração e o supervisor contínuo descritos acima. Não há outra solicitação de aprovação de schema pendente nesta entrega.
