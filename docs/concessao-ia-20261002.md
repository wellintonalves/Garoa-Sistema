# Concessões temporárias de Valéria

Pedido aprovado: Teste (`garoa-barbearia`), garoa barbearia (`barbearia-1782909453620`) e H Sousa **ativa** (`barbearia-1787143080659`). A homônima desativada está excluída.

Cada concessão tem 100 mensagens e 2.000.000 créditos, a 1 microunidade USD/crédito (teto contabilizado US$ 2). Texto somente; sem renovação, reset ou acúmulo. Reservas pendentes ocupam saldo. Fins exclusivos em America/Sao_Paulo: Teste 16/11/2026 00:00, Garoa 28/10/2026 00:00, H Sousa 26/10/2026 00:00. Nenhum prazo de acesso geral é alterado.

## Implementação

`IaConcessao` independe de assinatura e não possui endpoint público de concessão. Limites e datas são imutáveis; revogação é definitiva. `IaPeriodo` aceita exatamente uma origem, assinatura ou concessão, com FK composta por tenant e um único período por concessão. A assinatura paga válida continua prioritária, com saldo separado. Os locks, reservas, idempotência, ledger imutável, expiração, rate limits e liquidações tardias existentes são preservados. Mudança do custo unitário bloqueia a concessão em vez de ampliar seu teto.

Migração `20261002_concessao_ia`: adiciona tabela/coluna/constraints; relaxa somente o NOT NULL de assinaturaId. Não remove dados/tabelas. O verificador de sobreposição passa a distinguir fontes, permitindo ciclo pago e concessão sem misturar seus consumos. Toda requisição continua sujeita aos gates gerais de atividade/assinatura.

## Validação

- Migração ensaiada partindo do schema anteriormente publicado, em PostgreSQL isolado.
- Comparação do schema produtivo anterior com `fe844c6`: sem drift.
- Testes novos: elegibilidade, fronteira de expiração, isolamento, tenant inativo, voz negada, teto financeiro, 109 reservas concorrentes para 99 vagas, envio/liquidação idempotentes, imutabilidade, revogação e priorização de ciclo pago.
- HTTP real local com JWT/PostgreSQL: status disponível, 401 sem token, 403 após acesso geral expirar, zero chamadas externas.
- Regressões IA: políticas/ciclos, PostgreSQL, contexto, ajuda e voz com transporte simulado aprovadas. A ajuda do barbeiro foi atualizada aos botões atuais da interface.
- Frontend: build completo, lint de cores, TypeScript e 58 testes aprovados. Backend: build completo com Prisma/TypeScript aprovado.
- Falhas iniciais do harness (variáveis/nome/papel exigidos pelos testes e espera do servidor) foram corrigidas mantendo as guardas de alvo local. Nenhuma suíte foi adaptada para banco remoto.

## Operação autorizada

`qa/apply-ia-grants.cjs --apply-approved`, exclusivamente via Railway `run` no Postgres de produção, revalida IDs/slugs/estado/datas e exige ausência de consumo prévio nos três cadastros. Migração e três inserções são atômicas; guarda impede repetição cega. Confere preservação dos períodos existentes, das assinaturas e dos cadastros completos. Resultado de readback fica em `qa/ia-grants-applied.json`, sem credenciais.

Não usar `prisma db push` ou reaplicar migrações anteriores em produção. A implantação não executa migrações automaticamente. Em caso de falha, inspecionar resultado antes de repetir. Desativação da concessão preserva o histórico; não apagar ledger nem resetar saldo. Nenhuma geração OpenAI real é necessária à validação.
