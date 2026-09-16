# Consolidação local de termos privacidade e assinatura

## Alterações de 15 de setembro de 2026

Foram preservadas as alterações existentes. Foram lidos AGENTS.md, resultado-segunda-etapa.md, correcoes-webhook-acesso.md e prontidao-dados-backup.md. A consulta à tarefa “Revisão dos Termos do Valen” retornou metadados e turnos sem conteúdo; os documentos originais e as minutas consolidadas da pasta dessa tarefa forneceram o contexto adicional.

- A tela real passa a mostrar o seletor mensal/anual acima dos cartões. A prévia agora reutiliza PlanosAssinatura, com Básico à esquerda e Pró à direita a partir de 768px; em 375px, empilha nessa ordem.
- Preços preservados: Básico R$ 39,99/mês ou R$ 399,90/ano; Pró R$ 69,99/mês ou R$ 699,90/ano. Básico com oito barbeiros e duzentos clientes ativos; Pró sem esses limites. Loja virtual continua futura. Nenhuma contratação foi habilitada.
- Termos alinhados à apresentação efetiva do aviso de pagamento e à triagem de retenção sem exclusão automática. Política explicita que trinta dias para remover cópias após uma exclusão principal ainda dependem da operação dos fornecedores.
- Word atualizado em docs/documentos, preservando os originais da tarefa anterior. Inclui aceite, transição legada, doze meses de retenção operacional financeira e notas jurídicas/operacionais revisadas. Foram preservados a tabela de preços, os estilos e as referências, com comentários nos pontos relevantes.
- Matriz operacional corrigida para não listar como ausentes o webhook, a migração local e outros testes já concluídos.

## Verificações desta consolidação

- Prévia visual em 375, 768 e 1920px; seletor no topo e valores mensais/anuais confirmados. Em mobile e desktop, largura do documento igual à área disponível, sem overflow horizontal da página.
- Três testes existentes de PlanosAssinatura aprovados. O Vitest registrou aviso de timeout ao encerrar seu worker após a aprovação dos testes. Lint de cores aprovado.
- Conteúdo dos Word conferido por leitura estrutural, incluindo preços, limites e retenção. O renderizador oficial falhou por ausência de soffice.exe; o runtime disponibilizado não contém LibreOffice para Windows. A paginação dos dois Word permanece sem validação visual e os arquivos não devem ser tratados como diagramados e aprovados.
- Antes da orientação de não repetir builds, um build frontend foi iniciado e aprovado. A tentativa de build backend encontrou EPERM na DLL Prisma com a prévia local em execução. Nenhum consumidor foi encerrado; não houve nova tentativa nem alteração de backend nesta consolidação. Isso não invalida a aprovação histórica registrada na segunda etapa, nem comprova um novo build backend.

## Pendências verificadas

1. Renderizar e inspecionar os dois Word com o renderizador adequado antes de considerá-los finalizados visualmente.
2. Revisão jurídica das regras de menores, bases legais, retenção por categoria e cláusulas comerciais indicadas nas minutas.
3. Homologação real Asaas, configuração segura dos canais de aviso e procedimento de cancelamento por e-mail.
4. Confirmar regiões, contratos e retenção dos fornecedores; preparar migração, backup, rollback, monitoramento e resposta a incidentes conforme os registros existentes.

Campanhas e loja virtual continuam recursos futuros, sujeitos a revisão antes de ativação. Não houve push, publicação, alteração de schema ou banco de produção, envio externo ou cobrança real.

## Organização aprovada durante a inspeção

Configurações mostra o resumo da assinatura e o botão Ver planos. O botão abre um diálogo sobre a página atual, também acessível pelo aviso de assinatura no topo. A comparação preserva Básico à esquerda, Pró à direita e periodicidade acima dos cartões. A assinatura carregada determina a seleção inicial e as ações de contratar ou mudar plano/ciclo. Trocas simultâneas de plano e ciclo continuam separadas, conforme o backend existente. Fechar o diálogo retorna à tela e ao foco anteriores; uma contratação ou mudança confirmada pela API atualiza o resumo de Configurações.

A implementação usa o endpoint de assinatura existente, sem alteração de backend ou schema. O build completo do frontend passou durante essa alteração. A inspeção usa somente o ambiente local e não envia solicitações financeiras reais.

O diálogo foi inspecionado em 375, 768 e 1920px. Em 375px e 768px, sua largura interna coincidiu com a largura do conteúdo, sem overflow horizontal. O botão de fechar mede 48×48px. Abertura pelo banner e pelo resumo, seleção de Pró/anual, atualização dos preços e fechamento por Escape foram conferidos. Fechar restaura a rolagem da página e o foco no botão de origem. Nenhuma confirmação de contratação ou mudança foi enviada durante essa inspeção.

## Ajuste visual a partir das referências do usuário

A comparação inicial foi simplificada: título central, controle mensal/anual segmentado e cartões com nome, descrição curta, preço, botão de escolha e benefícios. Foram removidos os textos repetidos, os seletores circulares dos cartões e as explicações contratuais dessa primeira etapa. Escolher um plano abre a confirmação dentro do mesmo diálogo, com retorno à comparação e preservação do período escolhido. A informação de loja virtual futura permanece em nota única.

Os três testes existentes dos planos foram adaptados aos botões e passaram; o build frontend também passou durante o ajuste. A nova comparação foi inspecionada em 375, 768 e 1920px, sem overflow horizontal em mobile/tablet. A seleção de Pró/anual abriu a confirmação correta sem enviar contratação. Após o relato de página sem resposta, frontend e backend retornaram HTTP 200; o navegador registrava aviso de atualização a quente sobre dependências de hooks. Uma recarga completa foi feita, e os cliques na periodicidade e no plano responderam normalmente. Não foi constatada indisponibilidade persistente dos servidores.
