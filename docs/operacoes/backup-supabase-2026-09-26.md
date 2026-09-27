# Backup Railway → Supabase restabelecido

Reparo concluído em 26/09/2026. Horários deste relatório em America/Sao_Paulo.

Às 22h08min46s, a rotina corrigida concluiu uma cópia real de 30 tabelas e 2.851 registros em 11,6 segundos. Às 22h09min39s, uma conferência independente comparou hashes do conteúdo de todas as tabelas e não encontrou divergências. O diff estrutural ficou vazio e todas as FKs do destino estão validadas.

O backend está publicado no commit `03d77d9a06be3712ac30efbca6d937f3706ca816`, deployment Railway `7cf2595e-7852-4aa3-84f6-6b58d67391ad`, com status SUCCESS. O health check respondeu HTTP 200. O log de inicialização confirmou o agendamento de 04h15 em America/Sao_Paulo; `BACKUP_ENABLED=true` foi verificado. A execução validada foi manual, pela mesma função do job diário. A próxima execução automática ainda não ocorreu durante este reparo.

## Autorização e limite

O usuário autorizou explicitamente atualizar a estrutura e substituir os dados da réplica no Supabase, preservando uma cópia anterior e corrigindo o acesso, sem alterar o banco principal do Railway. Essa autorização foi a exceção específica à restrição de escrita no destino.

Nenhum dado ou schema do banco principal foi alterado pelo reparo. O diagnóstico usou consultas somente leitura; a cópia lê a origem em transação REPEATABLE READ READ ONLY. `schema.prisma` não foi alterado. Storage e Auth do Supabase não foram modificados.

## Causas e correção

A origem usa a rede interna do Railway. O destino é o Supabase. A conexão ao destino falhava com `SELF_SIGNED_CERT_IN_CHAIN`; passou a funcionar com a CA oficial do Supabase, mantendo validação da cadeia e do hostname.

Nos logs consultados houve falha diária de 28/08 a 26/09. Até 08/09 faltava `boas_vindas_concedidas`; de 09/09 a 20/09 faltava `itens_atendimento`; desde 21/09 a conexão falhava pelo certificado. O Resend entregou os alertas. Não foi possível determinar o último backup concluído antes do reparo.

O destino tinha 19 tabelas de aplicação e 165 colunas; a origem tinha 30 tabelas e 371 colunas. Foram criadas 11 tabelas e 15 enums e acrescentadas 43 colunas nas tabelas existentes, além dos índices/vínculos correspondentes. Antes de aplicar, o diff do Railway contra o schema da versão publicada estava vazio. O diff destino → origem foi repetido e permaneceu idêntico ao SQL ensaiado localmente.

O código carrega a CA apenas para hosts do Supabase e impede que parâmetros SSL da URL substituam a CA ou desliguem a validação. Erros identificam a conexão de origem, destino ou ledger sem imprimir credenciais. A CA pública tem validade até abril de 2031; sua procedência e fingerprint estão em `backend/certs/README.md`.

A comparação de schema e os hashes dos registros agora ignoram a ordem física das colunas. Isso evita falso erro após ADD COLUMN, sem ignorar nomes, tipos, defaults ou conteúdo. A cópia continua transacional, com FKs ativas e verificação de hashes antes do commit. Não há sincronização automática de schema.

## Cópia preservada e acesso

Antes de qualquer alteração, foi gerado um dump PostgreSQL custom de `public`, com dados, estrutura e ACLs, usando snapshot consistente. O diretório local tem acesso restrito ao usuário do Windows:

`%USERPROFILE%/.codex/backups/valen-barber/supabase-antes-reparo-2026-09-27T00-56-13-631Z/supabase-public.dump`

Tamanho: 679.492 bytes. SHA-256: `0af4679cffe904a24a4da698ed38cbb538a82cda173e5cd0b7b9172e261161be`.

O arquivo foi restaurado localmente, e os hashes dos 201 registros em 20 tabelas, incluindo `_prisma_migrations`, coincidiram com o snapshot exportado. `manifest.json` e `restore-verificado.json` documentam a verificação. O diretório também contém os resultados da atualização, controle de acesso, cópia e validação final. O servidor local de ensaio foi encerrado. O dump conserva o estado anterior, desatualizado; não substitui a réplica atual.

Às 22h02min44s, estrutura e proteção foram aplicadas juntas em uma transação no Supabase, após conferir que o destino ainda correspondia ao snapshot. As 31 tabelas de `public` (30 de aplicação e a tabela de controle) ficaram com RLS habilitado. Foram removidos privilégios de tabelas e sequências para PUBLIC, `anon` e `authenticated`, assim como CREATE no schema público. Os privilégios padrão de tabelas/sequências criadas por `postgres` em `public` foram restringidos. Não foram ampliados privilégios de `service_role`.

A verificação efetiva retornou zero acessos de `anon`/`authenticated`, inclusive por coluna. Consultas com esses papéis receberam `42501` (permissão negada). Storage ficou fora dessas mudanças. Objetos futuros criados por outros papéis administrativos precisam da mesma revisão de acesso.

## SQL e validações

`backup-supabase-2026-09-26.sql` registra a alteração estrutural aplicada. `backup-supabase-acesso-2026-09-26.sql` registra a proteção aplicada antes e depois do DDL, na mesma transação. São registros da operação, não migrations automáticas. Não reexecutar o SQL estrutural: os objetos já existem.

Os dois builds completos passaram antes do push: frontend com lint de cores, TypeScript e Vite; backend com Prisma generate e TypeScript. As verificações automáticas do pre-push também passaram.

O teste TLS cobre CA oficial, configuração efetiva do driver, cadeia confiável e rejeição de CA desconhecida/hostname incorreto. O teste PostgreSQL local cobre ordem diferente de colunas, conteúdo, bloqueio de schema divergente, rollback por FK e restauração/ledger. Um ensaio com as estruturas reais e dados fictícios preservou os valores financeiros e validou a cópia das 30 tabelas. A proteção de acesso foi ensaiada na restauração local do dump antes de ser aplicada remotamente.

## Continuidade

Toda mudança de estrutura no Railway precisa de atualização revisada no Supabase antes do próximo backup. Conferir drift, proteger tabelas novas e manter as FKs; não usar db push com accept-data-loss ou desabilitar TLS para contornar falhas.

As tabelas novas cobrem agendamentos, itens de atendimento, vendas, comissões, fidelidade, histórico, privacidade e assinaturas. Valores históricos foram copiados sem recálculo financeiro. As FKs da origem foram reproduzidas, inclusive referências com SET NULL. Nenhuma exclusão de registros do banco principal fez parte da manutenção.

A réplica é substituída diariamente e não guarda várias versões. Conservar o snapshot local anterior conforme a política de retenção. Restaurar o banco principal continua sendo outra operação, com autorização e ledger atual independente. A próxima execução automática às 04h15 ainda precisa ser observada; o agendamento e uma cópia real já foram verificados.
