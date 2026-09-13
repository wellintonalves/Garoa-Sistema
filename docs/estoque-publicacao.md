# Publicação de estoque, venda composta, descontos e estorno

## Banco — 13/09/2026

- Ambiente confirmado: Railway `artistic-happiness`, `production`, serviço `Postgres` (hayabusa:30563), separado de `postgres-dev`.
- Backup manual criado antes da atualização: painel registrou **13/09/2026 17:08, 1,02 GB**, disponível para restauração. Não foi feito teste de restauração, nem alterado PITR ou agendamento.
- Primeira tentativa pelo editor Query não executou DDL: os logs do PostgreSQL mostraram que o editor acrescentou `LIMIT 100` ao bloco `DO`, gerando erro de sintaxe. SELECT posterior confirmou esquema intacto (64 itens, 83 vendas de produtos).
- Após autorização, autenticação oficial Railway CLI limitada ao workspace e projeto selecionados. Não foi criada chave SSH. A conexão usou `railway run` e o driver `pg` já instalado, com credenciais apenas no ambiente do processo; `.env` local preservado.
- Comparação Prisma prévia mostrou exclusivamente as adições dos três SQLs; nenhum DROP ou mudança em coluna existente.
- Executor manual `backend/scripts/publicar_estoque_schema.cjs` aplicou as etapas na ordem: venda composta (10 operações), descontos (8), estorno (6). Cada etapa teve sua própria transação, validação de catálogo antes/depois, timeout de espera de lock de 5 segundos e comparação SHA-256/contagem das colunas preexistentes das tabelas tocadas. As três transações concluíram e preservaram os registros.
- Checagem posterior somente leitura: o executor reconheceu os 24 objetos, sem operação pendente. O Prisma retornou `This is an empty migration`, confirmando que o esquema de produção corresponde ao código local.

## Como usar o executor

Não usar o editor Query do Railway para esses scripts. Não adicionar o executor ao startup da aplicação. Rodar apenas com autorização específica, backup atual e ambiente confirmado.

O modo padrão é somente leitura. Em desenvolvimento, a partir de `backend`:

```powershell
node scripts/publicar_estoque_schema.cjs --dev --check
```

Na conexão `railway run` do serviço Postgres de produção, executar `node backend/scripts/publicar_estoque_schema.cjs --check` a partir da raiz. O programa exige os identificadores exatos de projeto/ambiente/serviço e o host público esperado. Nunca imprimir variáveis ou credenciais.

`--apply` é a ação explícita de escrita. Não misturar com `--check`. O executor lê os três arquivos SQL desta pasta, retira somente os delimitadores externos BEGIN/COMMIT e abre uma transação por arquivo com o driver. Objetos existentes são validados e pulados; incompatibilidades abortam a etapa. Não é um `IF NOT EXISTS` cego. Os SQLs isolados, sem o executor, **não são idempotentes**.

A validação de repetição foi executada no desenvolvimento com todos os objetos presentes: 0 operações DDL, 24 objetos reconhecidos, dados preservados. Falha em uma etapa não desfaz etapas já confirmadas anteriormente; a retomada reconhece essas etapas. Não apagar estruturas para repetir uma migração.

## Validações locais anteriores

Suítes backend/frontend e integração no Postgres de desenvolvimento passaram; builds completos frontend/backend terminaram com exit 0. Venda/estorno, desconto, estoque, pontos e histórico foram conferidos no preview; fixtures temporárias removidas com comparação das tabelas não-QA. `qa_descontos_preview.ts` é utilitário temporário e fica fora do commit.

## Situação do código

Este registro foi escrito após atualizar o esquema e antes do commit/push/deploy. Confirmação de implantação e checagens de leitura pós-publicação devem ser registradas separadamente; banco atualizado não significa código publicado.
