# Dados e backup — validação local e implantação controlada

## Implementado e testado localmente

Em 15/09/2026, `testes_backup_postgres_local.ts` passou em três bancos exclusivos de teste no PostgreSQL 127.0.0.1:55432. Verificou cópia com FKs ativas e conteúdo igual, variável DIRECT_URL inválida ignorada, rejeição de restore sem ledger atual, exclusão posterior ao backup refletida na restauração, rollback integral quando um filho sobrevivente referencia pai removido e bloqueio por schema divergente. Não houve conexão remota.

`testes_migracao_local.ts` criou banco a partir do baseline anterior versionado, inseriu barbearia, administrador e lançamento financeiro com comissão, aplicou as duas migrations, comparou conteúdo financeiro antes/depois e obteve diff vazio contra schema Prisma atual. Validou aceite antigo nulo, classificação legado e nova barbearia não legada. Copiou também o schema Valen inteiro para outro banco local e comparou o lançamento financeiro. Isso não equivale a ensaio com cópia dos dados reais nem prova todos os casos possíveis de dados antigos.

Arquivos reexecutáveis: backend/scripts/testes_backup_postgres_local.ts e backend/scripts/testes_migracao_local.ts. São fixos em loopback, usuário preview, bancos prefixados de teste. Resultados da migração: .tmp/migration-audit/resultado.txt e schema-after-migrations.sql. Os bancos de teste são mantidos para inspeção.

## Sequência de migrações

1. `20260914_baseline`: esquema anterior completo. Em banco vazio é aplicado normalmente. Em banco existente, **não executar este SQL nem marcar aplicado sem verificar equivalência do esquema existente com esse baseline**. Corrigir/registrar qualquer drift primeiro. Somente depois o operador pode estabelecer o baseline com `prisma migrate resolve --applied 20260914_baseline`, apontando explicitamente DATABASE_URL e DIRECT_URL para o mesmo banco aprovado.
2. `20260915_assinatura_privacidade`: tabelas, enums e vínculos da assinatura e privacidade.
3. `20260916_aceite_transicao`: campos opcionais de aceite (sem backfill de aceite) e classificação de barbearias anteriores ao início da transação, sem assinatura. A contagem de cinco dias só começa no aviso; não nesta migração.

Usar janela sem novos cadastros ao aplicar a classificação. Executar apenas uma vez pelo histórico Prisma; **não executar também os antigos recortes SQL em docs**. Eles não são uma sequência alternativa reaplicável. Para banco já parcialmente atualizado por db push, produzir plano específico a partir do drift; não executar a sequência cegamente.

O start agora executa somente o servidor. Migrations são uma etapa explícita anterior ao deploy, após backup verificado, revisão de drift, ensaio local e autorização da janela. Não há DDL automático durante backup. Preparar o schema do destino de backup pela mesma migração revisada antes de copiar.

## Cópia e restauração

`copiarBanco` usa snapshot consistente da origem, transação no destino, advisory lock, FKs ativas e ordenação das dependências. Não usa CASCADE, desabilitação de triggers ou accept-data-loss. Verifica hashes do conteúdo, não apenas contagens. Divergência ou falha de inserção reverte o destino inteiro. Esquemas ou ciclos incompatíveis são bloqueados para análise.

Restauração exige `ledgerAtualUrl` explícita para um banco atual independente do backup e do destino. O operador precisa preservar/exportar esse ledger após cada exclusão autorizada e confirmar que é a versão vigente. O código não consegue provar que um operador apontou para o ledger mais recente. Sem ledger independente, restore é bloqueado. A tabela de marcadores atual substitui a versão antiga da cópia. FKs impedem restaurar registros dependentes inconsistentes; não se apagam filhos automaticamente.

O bootstrap RUN_DB_COPY antigo não fornece esse ledger e, portanto, falha de forma segura. Para restore aprovado, usar procedimento controlado que forneça o terceiro banco; não contornar a exigência nem usar o backup antigo como ledger.

Conexões remotas usam validação de certificado TLS. Configurar CA confiável do provedor se necessário; não desabilitar a validação para contornar erro. Acesso interno Railway e loopback usam conexão local sem TLS.

## Pendências que impedem prometer exclusão automática

- Não há autorização individual nem política legal aprovada por categoria para apagar dados financeiros/históricos. A exclusão física desses dados continua bloqueada. Arquivamento preserva o histórico.
- O helper de trinta dias não constitui limpeza automática de snapshots Railway/Supabase. Definir e aplicar retenção externa, incluindo legal hold, é uma etapa operacional pendente.
- Antes de habilitar exclusão, definir responsável, base da conservação, prazo por categoria, confirmação do titular/autorização, marcadores duráveis e propagação para todas as cópias. Nunca inventar um prazo legal nem executar delete em cascata para concluir uma rotina.
- Os testes locais não verificam permissões, certificados, armazenamento, espaço, duração nem recuperação dos provedores em produção. Fazer ensaio controlado e registrar resultado antes da liberação.


## Atualização: retenção operacional financeira aprovada

Foi definido um ano para suporte. A implementação usa **doze meses de calendário após fimAcessoEm**, premissa explicitada na política para revisão, com ajuste de 29 de fevereiro para 28 de fevereiro quando necessário e horário de Brasília. Não equivale a prazo legal validado.

A fila interna `triarRetencaoEncerramentos` começa após consultaExportacaoAte (ou trinta dias do fim do acesso quando ausente), registra duas revisões idempotentes por assinatura e não faz exclusões. A financeira informa prazo operacional e passa a revisão necessária após doze meses. As duas permanecem AGUARDANDO_POLITICA até decisão apropriada. Não preenche excluidoPrincipalEm, removerBackupAte ou propagadoBackupEm sem acontecimento real; não altera permissões de acesso.

Retenção legal/disputa não é inferida pelo prazo de um ano. Justificativa, responsável e revisão devem ser registrados pelo procedimento restrito; holds e decisões já registradas não são sobrescritos pela triagem. Snapshots e eliminação física continuam etapas independentes, ainda não garantidas pela fila.
