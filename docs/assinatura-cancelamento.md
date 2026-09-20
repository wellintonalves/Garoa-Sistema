# Cancelamento da assinatura SaaS

## Escopo implementado

- Nova opção em **Configurações → Assinatura**, exclusiva para administradores.
- A confirmação exige digitar o nome da própria barbearia.
- O servidor revalida o usuário, o papel `ADMIN` e o vínculo com a barbearia.
- O pedido registra canal, administrador, e-mail normalizado, data/hora, motivo opcional e chave de idempotência.
- Uma restrição do banco impede mais de uma solicitação aberta por barbearia. Repetições retornam o pedido existente.
- O status inicial é `PROCESSAMENTO_PENDENTE`. Ele confirma apenas o recebimento; não afirma que a renovação foi cancelada.
- `cancelamentoConfirmadoEm` e `fimAcessoEm` permanecem nulos até existir confirmação verificável do provedor.
- O pedido não desativa a barbearia, não encerra o período já pago e não apaga dados.
- O e-mail de suporte fica disponível como `mailto:`. Nenhuma mensagem é enviada automaticamente neste incremento.

## Separação do provedor

O contrato `ProvedorAssinatura` separa o registro local da operação financeira. A implementação ativa é deliberadamente `NaoConfigurado`: ela não realiza chamadas externas e nunca devolve sucesso de cancelamento.

A solicitação já possui campos reservados para:

- provedor e identificador externo da assinatura;
- número e data das tentativas;
- último erro do provedor;
- confirmação efetiva do cancelamento;
- fim de acesso respaldado pela assinatura real.

## Base para a futura integração Asaas

Segundo a documentação oficial do Asaas:

- a assinatura deve ser vinculada pelo identificador retornado na criação; `externalReference` pode apoiar a conciliação;
- a remoção usa `DELETE /v3/subscriptions/{id}`, encerra novas cobranças e remove cobranças pendentes ou vencidas, mas preserva as já pagas;
- `SUBSCRIPTION_DELETED` confirma a remoção da assinatura;
- webhooks usam entrega pelo menos uma vez, portanto o `id` do evento deve ser idempotente;
- o token do webhook chega no cabeçalho `asaas-access-token` e não deve ser a chave da API.

Referências oficiais consultadas em 15 de setembro de 2026:

- [Remover assinatura](https://docs.asaas.com/reference/remover-assinatura)
- [Listar assinaturas](https://docs.asaas.com/reference/listar-assinaturas)
- [Eventos para assinaturas](https://docs.asaas.com/docs/eventos-para-assinaturas)
- [Criar nova assinatura](https://docs.asaas.com/reference/create-new-subscription)
- [Criar Webhook pela API](https://docs.asaas.com/docs/create-new-webhook-via-api)

## Pendências antes de ativar o Asaas

1. Validar a conta e habilitar o sandbox do Asaas.
2. Criar e guardar, em segredo, a chave de API e um token próprio para o webhook.
3. Persistir a correspondência entre barbearia, cliente Asaas e assinatura Asaas; preencher `assinaturaExternaId`.
4. Implementar o adaptador HTTP do contrato `ProvedorAssinatura` e testar no sandbox.
5. Persistir tentativas antes de chamadas externas e reconciliar resultados incertos com consulta ao Asaas.
6. Criar um endpoint de webhook autenticado, idempotente e tolerante a novos campos; não há endpoint público neste incremento.
7. Processar `SUBSCRIPTION_DELETED` e eventos de cobranças para distinguir recorrência removida de pagamento recebido.
8. Criar uma fila operacional ou painel interno para que pedidos do sistema e por e-mail não fiquem sem acompanhamento.
9. Só preencher fim de acesso a partir do período contratado e dos pagamentos confirmados.

## Aplicação da estrutura

O início do backend não altera mais o schema automaticamente. As migrações versionadas foram aplicadas e verificadas somente em PostgreSQL local descartável; nenhuma alteração foi executada em produção. O arquivo `assinatura-cancelamento.sql` permanece apenas como referência histórica da proposta inicial.
