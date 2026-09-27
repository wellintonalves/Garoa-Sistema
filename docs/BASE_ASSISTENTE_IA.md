# Base da assistente de IA

Atualizada em 27/09/2026. O usuário aprovou a modelagem de IA e sua implementação local. Schema e migration foram preparados; a migration foi aplicada somente em PostgreSQL descartável local. Produção recebeu apenas uma consulta de drift, sem diferenças antes das alterações. Não houve push, deploy ou chamada paga à OpenAI.

## Implementado

Painel lateral nas áreas atuais de administrador, barbeiro e cliente, com avatar substituível, foco contido, Escape, skeleton, erro/retry e histórico temporário da sessão de interface. O balão fica à direita em uma faixa própria. O portal legado `/b/:slug/app` ainda não recebe a assistente. A troca de usuário/tenant desmonta o painel e limpa o histórico local.

As rotas `/ia/admin`, `/ia/barbeiro` e `/ia/cliente/:barbeariaId` conferem autenticação e vínculo atual no backend. O contexto de tenant é reconstruído após validar o vínculo. Clientes não recebem dados de outros clientes. O saldo é da barbearia inteira; o resultado de uma operação só é recuperável pelo ator original no mesmo tenant.

Básico: 100 mensagens/mês. Pro: 200 mensagens/mês e 1.800 segundos de voz/mês. Renovação pelo ciclo mensal confirmado da assinatura, sem acúmulo. A regra usa as datas persistidas pelo financeiro e a função existente em America/Sao_Paulo, sem avançar um ciclo vencido por conta própria. Anual, teste, pagamento pendente e mudança de plano sem política de IA recebem bloqueios específicos.

A persistência usa quatro tabelas, transações PostgreSQL, lock por tenant, lock da assinatura e constraints de banco. Reserva antes de qualquer chamada ao fornecedor, idempotência por barbearia/pedido e liquidação única. Dois usuários não conseguem gastar o mesmo saldo. Timeout depois do envio mantém reserva incerta; repetir o pedido não chama o fornecedor novamente. Resultado tardio liquida no período original. Sobras não passam ao mês seguinte.

O envio de texto usa Responses API com modelo no servidor, chave central, store:false e timeout total de 30 segundos. Administradores podem executar uma consulta agregada de leitura e uma segunda geração para explicar o resultado. Cada geração tem até 512 tokens de saída. Não há SQL livre nem escrita operacional. O histórico visual não é enviado ao modelo. Consulte VALERIA_ANALISES.md para os critérios e o resultado dos testes reais e simulados.

Resultados recuperáveis são cifrados com AES-256-GCM e associados ao UUID da reserva. A retenção é configurável, sem prazo comercial presumido. Um job retira conteúdo expirado a cada minuto; ledger e reservas ficam intactos. Se o processo estiver desligado, a limpeza retoma ao iniciar. Retry idempotente funciona enquanto o identificador é preservado no painel; recarregar a página apaga o histórico e o identificador local. Não há lista de conversas persistentes exposta.

Voz tem reserva persistente de segundos/créditos, registro de sessão, atividade, prazo e lease, decisão de aviso/encerramento e executor com transporte injetável. O teste local comprova um único fechamento simultâneo e preservação da reserva quando o fechamento falha. A rota pública de voz permanece bloqueada: WebRTC, adaptador de voz e worker contínuo conectado à OpenAI ainda não foram implementados. A chave sozinha não habilita voz. O provedor escolhido precisa garantir limite de duração inclusive silêncio/inicialização/fechamento antes de liberar sessões pagas.

## Configuração e ativação

Por padrão `IA_ENABLED=false` e `IA_PERSISTENCIA_ENABLED=false`. Sem a segunda flag, nenhuma rota toca as tabelas novas. Não habilitar antes da aplicação revisada da migration no ambiente alvo. Com persistência habilitada e política completa, o status mostra o saldo mesmo com a OpenAI desligada.

Para texto funcionar, configurar no backend: chave/modelo OpenAI; mensagens e créditos por plano; microunidades de USD por crédito; tarifas de entrada/saída por milhão de tokens; versões de tarifa e política; política de contagem `RESPOSTA_CONCLUIDA`; chave de cifra de 32 bytes em base64 e retenção de 1 a 720 horas. Campos comerciais não decididos permanecem vazios no `.env.example`. Nenhuma chave é exposta em VITE ou aceita do cliente.

O algoritmo de custo usa a tarifa configurada de entrada sem desconto de cache e a saída total, arredondando microunidades/créditos para cima. É uma métrica conservadora de consumo, não o valor conciliado da fatura OpenAI. Reservam-se até 40.000 tokens de entrada e 1.024 de saída no total da operação, com até duas gerações. O adaptador limita cada corpo a 18.000 bytes UTF-8 mais 2.000 de folga e confere o orçamento restante antes do próximo envio. Mensagens permanecem limitadas a 4.000 caracteres. O uso das chamadas internas é somado e liquida uma única mensagem concluída. O saldo apresentado já desconta reservas. Se o fornecedor reportar uso acima do envelope, o evento real é preservado, o período bloqueado e a reserva fica incerta. Não há truncamento silencioso de custo.

Faltam aprovar quantidade/conversão de créditos, a métrica de custo e a contagem de mensagem, retenção do resultado, política anual/teste/tolerância/upgrade e custos de voz nos créditos. Recomendações estão no documento de persistência. O orçamento de créditos deve sustentar a franquia anunciada, ou a oferta deve informar claramente as duas condições; não inserir limite oculto que interrompa as 100/200 mensagens.

Sequência restante: revisar migration e efeitos de retenção/backup; aplicar em ambiente de validação por fluxo autorizado; definir/configurar as decisões pendentes; configurar chave central com segurança no Railway; realizar teste real de texto explicitamente autorizado; implementar e validar transporte de voz com limite duro e supervisor contínuo; só depois publicar mediante autorização. Este código não executa migrations no startup/build.

## Validação

- `npm run test:ia --workspace=barbearia-backend`: domínio de ciclo, inatividade, adaptador simulado e autenticação HTTP.
- `npm run test:ia-postgres --workspace=barbearia-backend`: PostgreSQL nativo local, dois clientes/pools independentes, 110 pedidos disputando 100 mensagens, segundos/creditos compartilhados, deduplicação, constraints, tenant FK, ledger imutável, resultado tardio, expiração, conversa simulada e supervisão de voz simulada.
- Teste PostgreSQL recusa qualquer URL fora de localhost/127.0.0.1 ou banco sem prefixo `valen_ia_test`. A execução desta tarefa usou porta 55439, schema anterior seguido da nova migration, sem dados copiados de produção. Runtime de teste ficou em node_modules, sem dependência nova no aplicativo.
- UI isolada em Edge headless: 375/768/1920 px, skeleton, erro/retry, foco, toque, overflow e envio com falha/pendência/retry usando a mesma chave. Script `frontend/scripts/teste-ia-ui.cjs` requer Vite local e Playwright em NODE_PATH.
- Builds completos do frontend e backend, além dos testes existentes do frontend. Avisos de Prisma package.json legado, eval no lottie-web e vulnerabilidades npm preexistentes não foram tratados nesta alteração.

Veja [persistência e impactos](PROPOSTA_PERSISTENCIA_IA.md) e a migration `backend/prisma/migrations/20260927_base_ia/migration.sql` para revisão.

## Documentação oficial consultada

[Responses API](https://developers.openai.com/api/docs/quickstart), [contagem/limites de tokens](https://developers.openai.com/api/docs/guides/token-counting), [GPT-Live](https://developers.openai.com/api/docs/guides/live) e [duração faturável de voz](https://developers.openai.com/api/docs/guides/voice-latency-cost). Nenhum modelo foi escolhido como decisão comercial definitiva nem validado na conta real.
