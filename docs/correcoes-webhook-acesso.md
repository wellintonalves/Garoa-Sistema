# Correções de eventos e acesso de assinatura

Escopo local: webhook, transição de legado, datas e autorização de leitura/escrita. Nenhum banco remoto, envio externo ou publicação nesta etapa.

## Decisões implementadas

- Reserva do evento, alterações financeiras e finalização são uma transação serializável. Conflitos P2034 repetem até quatro tentativas. Um erro não pode confirmar parcialmente o estado nem esconder falha de serialização com outra query na transação abortada.
- Eventos PROCESSANDO antigos podem ser retomados após dez minutos de updatedAt; reservas recentes são respeitadas. Novas reservas não ficam confirmadas parcialmente em caso de queda.
- Erro em um evento da fila não impede os demais. Assinatura ainda não associada fica em FALHA recuperável, não é descartada definitivamente.
- CHECKOUT_CREATED pode resolver uma reserva de criação por referência exata sem liberar acesso. Cancelamento/expiração só libera o checkout correspondente. Upgrade expirado é cancelado e exige nova cotação proporcional.
- CHECKOUT_PAID/SUBSCRIPTION_CREATED não reiniciam teste nem regridem assinatura ativa. Datas reservadas/aceite e primeiro vencimento são preservados.
- Confirmado/recebido do mesmo pagamento não estende ciclo; eventos de ciclo antigo não regridem o atual. Recusa de parcela já paga não vence sobre pagamento confirmado, inclusive em concorrência real.
- Upgrade pago só altera plano após atualização idempotente da recorrência externa confirmada para valor e vencimento fixos. Estado indeterminado mantém evento recuperável.
- O webhook não comprova apresentação de aviso. POST /assinatura/aviso-pagamento valida administrador no banco e registra uma única janela de sete dias após apresentação efetiva. Reabertura da tela não reinicia o prazo. Antes de aviso comprovado, PAGAMENTO_PENDENTE preserva acesso conforme decisão comercial.
- PRE_CADASTRO não dá acesso operacional. Expiração do teste, ciclo pago, tolerância e consulta/exportação é calculada no guard, independentemente de cron atrasado. Rotas de regularização/cancelamento permanecem acessíveis.
- Legado que já teve ciclo pago permanece migrado mesmo em inadimplência futura; não volta para outra janela de cinco dias.
- Cálculo mensal/anual usa calendário America/Sao_Paulo, incluindo datas próximas à virada UTC.

## Evidência

`backend/scripts/testes_webhook_acesso_postgres_local.ts` passou contra banco descartável local exclusivo `valen_webhook_test20260915`, incluindo concorrência real, lease, avisos concorrentes, datas e preservação do estado. O script rejeita host remoto/nome de banco fora do prefixo de testes e exige WEBHOOK_TEST_DATABASE_URL explícita.

`test:assinatura-fluxo-local`, `test:limites-assinatura` e `test:regras-assinatura` passaram. O teste de fluxo agora confirma um pagamento anual antes de esperar avanço de ciclo anual e confirma aviso antes de esperar sete dias.

Build completo backend foi tentado e encontrou EPERM ao substituir DLL Prisma carregada pela prévia local. Coordenador avisado para repetir depois de encerrar temporariamente consumidores locais da DLL. Isso não é erro TypeScript observado, nem evidência de build concluído.

## Limites da evidência

Teste local usa provedor fake e banco PostgreSQL real descartável. Não prova integração financeira Sandbox/produção, entrega de e-mails ou migração de dados legados. A atualização remota idempotente de recorrência pode exigir reconciliação se a transação local falhar após confirmação externa; retry conserva mesmo valor/vencimento para não duplicar ajuste.

## Auditoria de ordenação entre pagamento e job de mudança

O webhook agora resolve mudança AGENDADA vigente pelo vencimento da parcela dentro da mesma transação, exige o valor integral esperado da oferta de destino e usa sua periodicidade para o ciclo. Marca a mudança EFETIVADA junto ao pagamento. Valor divergente/ausente em mudança agendada fica recuperável, sem conceder plano ou ano adicional. Pagamento antes da própria data de efetivação aguarda essa data.

Ambos os lados usam lock de linha em assinaturas_saas e transação serializável. Além de P2034, SELECT FOR UPDATE pode reportar P2010/meta40001 ou40P01; esses conflitos também têm retry. O job operacional foi ajustado pelo agente proprietário para reler assinatura/mudança depois do lock e não sobrescrever um ciclo já avançado pelo webhook. API passou a bloquear mudança simultânea de plano+periodicidade e múltiplas mudanças pendentes.

Regressão PostgreSQL real ampliada e aprovada: mensal→anual e anual→mensal com pagamento antes do job; valor incorreto não efetiva; downgrade com nove barbeiros é rejeitado; após arquivar um, corrida determinística pausa o job dentro do provedor, comprova que webhook espera o lock e termina com o novo ciclo sem retrocesso. Novo teste não usa rede de pagamentos nem dados reais.
