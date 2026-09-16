# Matriz operacional dos Termos do Valen Barber

Esta matriz liga as regras aprovadas ao comportamento verificável do sistema. O código está preparado localmente; nenhuma alteração desta rodada foi aplicada em produção.

| Regra | Estado | Evidência/limite |
|---|---|---|
| Básico R$ 39,99/mês ou R$ 399,90/ano; Pró R$ 69,99/mês ou R$ 699,90/ano | Implementada no domínio | Valores inteiros em centavos e testes automatizados. |
| Teste por 7 dias | Preparada, integração desativada | Datas e estados modelados/testados. Cobrança e meio de pagamento dependem do Asaas. |
| Básico: 8 barbeiros e 200 clientes ativos; aviso em 180 | Implementada no backend | Inativos/arquivados não contam; criação e reativação validam vaga em transação serializável. Unidades legadas sem assinatura gerenciada mantêm o comportamento atual. |
| Sem upgrade automático | Implementada no domínio | Excesso gera erro claro; não troca plano. |
| Upgrade Básico → Pró proporcional no ciclo pago | Preparada, integração desativada | Cálculo usa tempo real restante e libera somente após futura confirmação de pagamento. |
| Downgrade apenas na renovação | Preparada, integração desativada | Se exceder limites na renovação, encerra renovação e inicia consulta/exportação; não cria nova cobrança Pró. |
| Mudança mensal/anual apenas na renovação | Preparada, integração desativada | Prévia contém preço atual/destino e ação agendada. |
| Recusa: 7 dias gratuitos, sem dívida, depois consulta/exportação | Preparada, integração desativada | Estados e datas testados; eventos financeiros dependem do Asaas. |
| Reajuste com aviso mínimo de 30 dias e só na renovação | Preparada | Regra temporal, versão de oferta/termos e aceite modelados; falta canal de aviso operacional. |
| Cancelamento por sistema ou e-mail | Preparado e testado localmente | Pedido, recibo, processamento e confirmação do provedor são estados distintos. Recebimento por e-mail exige atendimento e registro operacional; `mailto:` não comprova entrega. Homologação externa pendente. |
| Pedido recebido ≠ renovação cancelada | Implementada | Status inicial `PROCESSAMENTO_PENDENTE`; datas de confirmação/fim não aparecem antes da confirmação verificável. |
| Manter acesso já pago; depois 30 dias de consulta/exportação | Implementada no controle de acesso | Leitura e exportação permanecem; escritas são bloqueadas. A transição automática depende dos eventos de cobrança. |
| Exportação utilizável | Implementada | ZIP com CSVs UTF-8 (BOM, `;`), manifesto e README; protegido contra fórmula; somente unidade do admin; sem hashes, senhas, tokens ou códigos de autenticação. |
| Clientes compartilhados entre unidades | Implementada na remoção/desconexão | Arquiva somente o vínculo da unidade, preservando conta, outros vínculos e histórico. |
| Data de nascimento do cliente | Implementada | Obrigatória para novos cadastros do cliente final; editável no perfil; data real/não futura. Legados permanecem com idade desconhecida. Não comprova identidade nem ativa regra etária de agendamento. |
| Promoções por remetente e canal | Implementada como preferência | Opt-in separado para Valen/cada barbearia e e-mail/in-app, padrão desligado e revogável. Menor de 18 ou idade desconhecida não pode ativar. Não existe motor de campanha/push nesta rodada. |
| Após 30 dias de consulta, triagem; backups até 30 dias após exclusão principal | Triagem implementada; exclusão física desativada | São prazos distintos. Marcador e proteção de restauração testados localmente; retenção por categoria, autorização de exclusão e limpeza de snapshots externos permanecem pendentes. |
| Asaas | Implementação local, sem homologação externa | Adaptador, webhook, reconciliação e sincronização testados com provedor fake/rede simulada. Não comprovam Sandbox real, entrega de e-mails ou cobrança em produção. |
| Plano Pró disponível para venda | Não disponível | Não deve ser divulgado como ativo antes da integração financeira e operacional. |
| Loja virtual | Fora do escopo atual | Funcionalidade futura. |
| Regra etária de autoagendamento | Em revisão | Nenhum corte de 15 anos ou consentimento responsável foi ativado. |

## Categorias da exportação

O pacote inclui dados da barbearia, usuários da unidade sem credenciais, barbeiros, clientes vinculados (inclusive vínculo arquivado pertinente), serviços, agenda, lançamentos e itens, estoque/vendas, configurações operacionais, fidelidade, recompensas/resgates, chat, indicações, avaliações, bloqueios e histórico/aprovações. IDs são preservados para relacionar os CSVs; listas e objetos aparecem como JSON dentro da célula.

## Infraestrutura e retenção confirmadas

- Railway `artistic-happiness/production`: backend e PostgreSQL principal em **US East**; banco `postgres-dev` em **US West**.
- No painel consultado, PITR estava desligado e não havia agenda gerida de backup para os dois PostgreSQL.
- Há snapshots manuais no banco principal, inclusive cópias com mais de 30 dias. Eles não são o mesmo mecanismo do espelhamento diário implementado no código.
- A cópia usa snapshot consistente, transação no destino, chaves estrangeiras e conferência do conteúdo. Restauração exige um ledger atual de exclusões, independente do backup e do destino; incompatibilidade de relações ou schema bloqueia a operação. O código não comprova que o operador forneceu o ledger mais recente. Ver `prontidao-dados-backup.md`.
- A função exata de `postgres-dev` como destino de backup deve ser confirmada pela variável protegida no painel; o nome não é prova suficiente.
- Região do Supabase Storage e retenção de snapshots geridos pelo Railway/Supabase não foram confirmadas. Essas políticas externas precisam ser ajustadas para que o prazo de 30 dias possa ser garantido em todas as cópias.

## Pendências indispensáveis antes de produção

1. Preparar a janela operacional de migração, drift, backup e rollback. Baseline, migrações e restauração já foram testados em PostgreSQL local descartável; consultar `prontidao-dados-backup.md`. Não repetir esses testes como se estivessem pendentes nem executar migrações remotas nesta tarefa.
2. Definir retenção legal por categoria e fluxo de autorização antes de habilitar exclusão física.
3. Confirmar região/retenção do Supabase e política de snapshots Railway; remover snapshots incompatíveis somente com autorização explícita.
4. Validar sandbox, webhooks e reconciliação Asaas antes de ligar cobrança, trial, upgrade, downgrade ou cancelamento automático.
5. Antes de disponibilizar campanhas/push, criar o mecanismo que consulte as preferências no momento do envio; até lá, as escolhas são armazenadas, mas nenhuma campanha é entregue. Esse recurso não é condição para a oferta atual de assinaturas.

## Complemento da consolidação local

- O prazo de sete dias por pagamento recusado começa na apresentação efetiva do aviso ao administrador, registrada uma única vez. Reabrir a tela não reinicia a janela; webhook não comprova apresentação. Ver `correcoes-webhook-acesso.md`.
- Após trinta dias de consulta/exportação, inicia-se triagem, sem exclusão automática. O histórico financeiro tem prazo operacional de doze meses de calendário após o fim do acesso, sujeito à revisão jurídica. Snapshots e retenção externa não são limpos pela fila local.
- Os preços e limites permanecem os aprovados. Na comparação, Básico fica à esquerda e Pró à direita a partir de 768px; no mobile, ficam empilhados nessa ordem. A periodicidade é escolhida acima dos cartões. A apresentação do Pró para revisão não habilita sua contratação.
