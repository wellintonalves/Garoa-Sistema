# Dashboard: atendimentos manuais

Validação local executada em 13/09/2026.

## Regra

Cada entrada identificada como atendimento conta uma vez, inclusive combo. A identificação aceita serviço, barbeiro ou agendamento vinculado, ou categoria Serviço/Serviços/Serviço Prestado/Serviços Prestados (normalizada). Vendas de produtos e saídas não contam. Entradas genéricas sem esses vínculos, como aporte, não contam.

O ticket médio usa somente a receita desses atendimentos. A mesma regra alimenta o período anterior e as séries do card. A contagem de agendamentos concluídos e o ranking de serviços continuam separados.

## Arquivos

- `backend/src/utils/atendimentoFinanceiro.util.ts`: classificador compartilhado.
- `backend/src/services/financeiro.service.ts`: contagem, ticket, comparativos e séries; série horária para período de um dia; mantém a chave antiga de métricas e acrescenta atendimentosFechados.
- `backend/scripts/testes_dashboard_atendimentos.ts`: regressão offline com serviço e isolamento reais, persistência simulada.
- `backend/scripts/testes_dashboard_postgres.ts`: API compilada com PostgreSQL de desenvolvimento, duas unidades temporárias e limpeza verificada.
- `backend/package.json`: atalhos e inclusão da regressão offline na suíte padrão.

## Resultados observados

- Suíte backend: fechamento, fidelidade, comissão, email administrativo e dashboard passaram.
- Frontend: 16 testes passaram.
- Builds completos de backend e frontend passaram; TypeScript sem emissão também passou nas duas pastas.
- API compilada respondeu 200 nas duas unidades de desenvolvimento. Duas entradas manuais de 40 e 20 produziram 2 atendimentos e ticket 30; produto e aporte ficaram fora da contagem; receita total permaneceu 210. Outra unidade retornou somente seu atendimento de 80.
- Fixtures removidas e ausência confirmada no banco de desenvolvimento.
- Nenhuma mudança de schema, comissão, fidelidade ou escrita em dados de produção.

## Conferência visual restante

Após a implantação, entrar no dashboard, escolher período com lançamentos manuais e conferir card, ticket e comparativo. Combo deve contar uma vez; produto não deve aumentar atendimentos. Conferir também período vazio e filtro de um dia. A validação automatizada não substitui essa conferência visual autenticada.

Publicação autorizada pelo usuário após testes; este registro não comprova conclusão do deploy.
