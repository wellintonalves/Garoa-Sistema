# Lançamento da Valéria em produção

Concluído em 29/09/2026. Código publicado: `7c6fd7c0003e9532bd34392375a94f7d7e0740b9`, incluindo toda a branch `codex/base-agente-ia` desde a base `3b57fd9`. A main remota era ancestral; o push foi normal, sem force. O checkout principal e seu arquivo de trabalho não relacionado foram preservados.

## Autorização e limites

O usuário aprovou os tetos por barbearia/ciclo de US$ 2 no Básico e US$ 6 no Pro, crédito equivalente a um microdólar, retenção cifrada de 24 horas, atualização dos dois bancos, configuração segura, publicação conjunta e teste real de até US$ 0,10 no total. A aprovação foi uma exceção específica à regra de não escrever em produção, limitada a esta operação.

Como não havia assinatura elegível para voz, o usuário autorizou uma conta isolada Pro de teste, sem cobrança. Depois pediu que ela permanecesse acessível para revisão, permitindo bloquear o consumo após a validação. Nenhuma assinatura comercial existente foi alterada.

## Bancos e recuperação

Snapshots de `public`, com estrutura, dados e ACLs, foram exportados sob snapshot consistente e armazenados em diretório local com ACL restrita ao usuário do Windows:

`%USERPROFILE%/.codex/backups/valen-barber/valeria-lancamento-2026-09-29/`

- Principal: 30 tabelas, 2.974 registros, 965.578 bytes; SHA-256 `9a4304d850d60324a554f67a2ed784acb9f61766efd58f9dd21117df5e7f2ed1`.
- Réplica: 31 tabelas, 2.892 registros, 980.438 bytes; SHA-256 `f3eda0403f12a34a2efb3b009b03ea920da79dcb85bc5acc6dc66dbbd13cf3ed`.

Os dois dumps foram restaurados em PostgreSQL 18 local isolado. Quantidades e hashes de conteúdo coincidiram em todas as tabelas. O SQL da migration foi ensaiado nas duas restaurações antes de qualquer DDL remoto.

Foi aplicado somente `backend/prisma/migrations/20260927_base_ia/migration.sql`, SHA-256 `004aecf7e4ad1ee6d258da1cfba8ee898e4948091684a2b50de08c4188502228`, em transações separadas na réplica (18:01 UTC) e no principal (18:02 UTC). Incluiu as quatro tabelas, três enums, índices, vínculos, CHECKs e dois triggers. Não se executou `migrate deploy` sobre o banco sem histórico Prisma.

Na réplica, as quatro tabelas novas têm RLS habilitado e nenhum privilégio efetivo de tabela/coluna para `anon` ou `authenticated`. Os privilégios dos objetos existentes foram preservados. O diff Prisma do principal ficou vazio após a aplicação; os catálogos de colunas dos dois bancos coincidem. O ensaio local da função real de backup copiou 34 tabelas e 2.974 registros e verificou seus hashes. Não houve substituição dos dados da réplica remota nesta operação; o job existente permanece habilitado para 04h15 em America/Sao_Paulo.

O servidor local de restauração foi encerrado. Dumps, manifests, comprovações de restauração e aplicação continuam no diretório protegido. Rollback funcional deve desligar flags, preservando schema, reservas e ledger; não apagar consumo para reabrir acesso.

## Configuração e deployments

A chave OpenAI existente no arquivo local ignorado foi transmitida por stdin à CLI Railway, sem impressão de valor. Foram gerados segredos próprios para tickets e cifra. Nenhuma credencial foi versionada. Configuração efetiva verificada por lista permitida e presença booleana dos segredos:

- Texto `gpt-4.1-mini`; voz `gpt-realtime-mini-2025-12-15`, Marin.
- 100 mensagens Básico; 200 mensagens e 1.800 segundos de voz Pro; compartilhados por barbearia.
- 2.000.000 / 6.000.000 créditos; custo por crédito 1 microUSD; `TODOS_CUSTOS`; uma mensagem por resposta concluída.
- Tarifas de texto conservadoras já utilizadas: entrada 400.000 e saída 1.600.000 microUSD por milhão de tokens. Versões `valeria-2026-09-v1` e `openai-2026-09-v1`.
- Retenção de 24 horas. `IA_ENABLED`, `IA_PERSISTENCIA_ENABLED` e `IA_VOZ_ENABLED` ativos.
- WSS `wss://barbearia-backend-production-f72d.up.railway.app/ia/voz/conexao`, limitado às origens HTTPS principal e alternativa do frontend.

Backend: deployment `5be6ef56-87cc-45d3-b933-6ab6635781e7`, SUCCESS. Frontend inicial: `039190e4-3285-43dd-86db-8a7a55ab860b`, SUCCESS, ainda sem anúncio. Depois da validação real, `VITE_VALERIA_LANCAMENTO_ENABLED=true` gerou o deployment final do frontend `a44d0948-111d-410a-96e9-79fe3f95b767`, SUCCESS. Todos usam o mesmo commit de código acima. O anúncio foi visto no domínio público autenticado.

## Validação efetiva

Os builds completos dos dois workspaces passaram antes do push. A entrega já tinha passado nas oito suítes de IA e nos 53 testes de frontend. Não houve mudança no código funcional depois dessas verificações.

Em produção: health 200; login real da conta isolada; status autenticado 200 com texto/voz disponíveis; status sem autenticação 401; identidade com tenant incompatível 403. WSS recusou origem não autorizada e encerrou ticket inválido sem conectar ao provedor.

Foi enviada uma frase curta produzida pelo sintetizador local do Windows, em PCM mono de 24 kHz. A sessão pública WSS recebeu áudio real e transcrição da Marin; foi encerrada e seguida de uma segunda sessão, aberta e encerrada sem geração. A voz somou 15 segundos no ledger e 4.216 microUSD. Um pedido de texto pelo site público respondeu “teste de texto concluído”, somando 862 microUSD e uma mensagem. Total calculado e confirmado no ledger: **5.078 microUSD (US$ 0,005078)**, abaixo dos US$ 0,10 autorizados. As três reservas ficaram CONCLUIDA, sem consumo pendente. Este é o custo calculado pela regra configurada, não uma conciliação da fatura OpenAI.

O modal publicado foi conferido em 375×812, 768×1024 e 1920×1080, com larguras de 351, 744 e 960 pixels, sem overflow horizontal e com foco no X. O chat autenticado foi conferido visualmente. X, Escape, retorno de foco, dica, abertura do chat, dispensa e persistência já haviam sido exercitados na prévia isolada. A sessão do navegador foi deixada com o anúncio aberto para revisão; não foi acionado o microfone do usuário. Não se afirma teste em aparelho móvel físico nem ensaio de queda de processo em produção.

## Conta de revisão

Identificação: **Valéria · validação de lançamento (teste)**. Acesso público: `https://valenbarber.com.br/admin/login`. Sem cobrança, sem renovação e sem identificadores de cobrança externos. O teto de US$ 0,10 foi aplicado somente ao período dessa conta de teste; os planos comerciais permanecem com US$ 2 / US$ 6.

Após validar o anúncio, o período de IA da conta isolada foi bloqueado às 18:19 UTC, mantendo barbearia e login ativos para revisão. Nenhum registro de consumo foi apagado. A sessão do navegador permanece aberta no modal; uma nova navegação não terá consumo de IA liberado e, por depender de disponibilidade, não repetirá o anúncio nessa conta bloqueada.

Email e senha estão em `acesso-revisao.txt` dentro do diretório local protegido informado acima. Não foram publicados em mensagens, logs ou URLs. Não usar recuperação por email: o endereço de teste usa `example.invalid` e não recebe mensagens.

A assinatura comercial que já existia continua fora da elegibilidade de IA: Básico sem ciclo ativo. O lançamento preservou a regra aprovada de ciclo mensal confirmado. Novos ciclos elegíveis recebem as cotas configuradas; liberar a conta comercial existente exigiria uma decisão separada de assinatura, que não foi tomada neste lançamento.
