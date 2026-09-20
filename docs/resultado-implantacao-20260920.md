# Implantação de assinaturas — 20/09/2026

## Publicação

- Frontend publicado: commit `7926e51bc7e1991239e35db1918bc3657104e221`, deploy `45ea42b6-a121-4734-81b2-f74d3b55046d`.
- Backend publicado e ativado: commit `6a8bf5a98e99130e581594e197298eadaa436af9`, deploy `6455d8a3-3f95-4a70-a3e4-833b19fe2001`.
- Duas tentativas Nixpacks falharam antes da compilação. Railpack compilou e publicou com sucesso. Início efetivo: `node dist/server.js`, sem `prisma db push`.
- Aviso anterior preservado enquanto a contratação estiver indisponível. Contas existentes recebem o aviso de transição ao acessar o painel; a classificação como legada não cria cobrança automática.

## Banco e recuperação

Backup consistente PostgreSQL 18.6, protegido fora do repositório. SHA256: `26187b8280fe35a6ad1e07d91fc3197030074c5d9bee04e398c9f03f052a71b1`.

A restauração foi conferida pelo conteúdo completo das 24 tabelas. O SQL foi ensaiado também nessa cópia real. Nova comparação imediatamente antes da aplicação confirmou o mesmo pacote aprovado. Aplicação única em produção às 19:09 UTC, com transação e bloqueio temporário das tabelas durante a comparação de conteúdo. Todas as colunas originais das 24 tabelas foram preservadas; barbearias existentes classificadas como legadas. Comparação posterior sem drift.

SHA256 do SQL aplicado: `72fde520a860e1fe94bfae30df6fbfe65b8c784d581b4345e12545df22572237`. Não reaplicar o pacote. As bases locais de restauração/testes foram desligadas após as verificações.

## Asaas e verificações

- Chave de produção inserida pelo titular no Railway; alterações pendentes aplicadas pela API oficial com `skipDeploys: true`. Nenhuma credencial versionada ou exibida.
- Conta do titular confirmada por consulta: aprovação geral `APPROVED`, cadastro comercial não vencido.
- Webhook específico de assinaturas habilitado, fila não interrompida, 19 eventos, token próprio e callbacks HTTPS para `/admin/configuracoes?secao=assinatura`.
- Integração de produção e processos periódicos habilitados. Ambiente sandbox e provedor fictício desabilitados em produção.
- Backend: saúde HTTP 200; assinatura sem autenticação HTTP 401; token correto com conta divergente HTTP 401 com validação de conta confirmada. Essa verificação não gravou um evento fictício.
- Sandbox real: contratos mensal/anual com cartão fictício, confirmação de pagamento, consulta da fatura pelo adaptador, atualização de cartão pelo token da fatura, cancelamento e estorno confirmados. Contratos de teste encerrados. Registros anteriores mostram eventos reais de criação, pagamento e exclusão da assinatura.
- Ambos builds completos passaram, inclusive no pre-push. Frontend: 26 testes. Backend: suíte completa, regularização, conta produtiva, sincronização e regressões PostgreSQL de reversões, concorrência, duplicatas e isolamento aprovadas.

## Limites e pendências

Não houve cobrança real de teste. A primeira contratação efetiva, a entrega de seus eventos e a primeira renovação real ainda precisam ser observadas. A jornada visual completa do checkout hospedado não foi repetida nesta retomada: o controle do navegador foi bloqueado pela ferramenta. Os cenários de recusa e eventos fora de ordem foram verificados em testes automatizados; isso não equivale a todos os cenários financeiros reais homologados.

A réplica Supabase exige atenção: a consulta com validação TLS retornou `SELF_SIGNED_CERT_IN_CHAIN`. O backup diário está configurado, mas seu funcionamento não foi confirmado e não deve ser considerado saudável. Não foi desabilitada a validação TLS nem alterado o schema da réplica; a autorização específica de SQL foi executada no PostgreSQL principal. O backup local restaurado é a evidência de recuperação desta implantação, não substitui a correção do backup recorrente.

Atualização de cartão preventiva sem fatura paga e resolução comercial de estornos parciais/contestações seguem pelo suporte. A atualização por fatura paga foi confirmada no sandbox; não foi ensaiada com cartão real na conta produtiva.
