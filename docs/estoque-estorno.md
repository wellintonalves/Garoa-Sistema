# Estorno e integração de vendas de produtos

Implementação local na branch `feat/estoque-venda-composta`. Sem publicação.

## Comportamento

- Somente ADMIN da barbearia pode estornar pelo Histórico de vendas. Exige motivo (5–500 caracteres) e confirmação explícita de devolução física e reembolso integral.
- O sistema registra o reembolso; não movimenta Pix nem cancela pagamentos em adquirentes. A confirmação cabe ao operador.
- Transação Serializable marca a venda, incrementa cada estoque, registra SAIDA `Estorno de Produto` pelo líquido original e credita os pontos utilizados com tipo ESTORNO. Original, itens, preços, custo, descontos e débito são preservados.
- Data atual, motivo, ID do responsável e vínculo financeiro ficam registrados. Uma venda tem no máximo um estorno; repetição retorna sucesso sem repetir efeitos. Concorrência pode retornar409, permitindo consulta/repetição segura.
- Original e reversão não são editáveis/excluíveis no Financeiro. Demais lançamentos conservam seu comportamento. Itens legados sem VendaEstoque não ganham vínculo inventado: a UI informa que estorno automático está indisponível.
- Divergência de valores/pagamento, ausência de item ou débito incompatível bloqueiam o estorno completo com rollback.

## Relatórios e cliente

- Estoque/histórico mantém vendas canceladas visíveis, mas exclui seus valores e unidades dos totais de vendas ativas, inclusive ao consultar um período antigo. Cards de estoque refletem a quantidade devolvida, preços atuais e custo cadastrado.
- Financeiro de caixa mantém entrada e saída em suas respectivas datas. Dashboard e consolidado de produtos reduzem faturamento no dia do reembolso, sem contabilizar esse mesmo valor também como despesa operacional. Serviços/comissões/atendimentos não recebem o estorno de produtos.
- Perfil/listagem do cliente incluem compras líquidas ativas no gasto. Ticket médio = (gasto em agendamentos concluídos + compras ativas) / (quantidade desses agendamentos + compras). Compras NÃO incrementam visitas. Estornadas continuam identificadas no histórico e saem dos totais.
- Movimentos de pontos negativos, inclusive legados com enum antigo, são gastos/resgates; positivos são créditos. Reservas de recompensa canceladas não consomem saldo. Créditos de devolução ficam identificados pela descrição e tipo persistido ESTORNO; saldos não são recalculados retroativamente.

## Banco

Schema aditivo autorizado: quatro colunas opcionais e FK/índice de estorno em VendaEstoque. Baseline diff vazio. `db push` recusou índice unique e foi interrompido sem usar accept-data-loss. Após autorização específica, `estoque-estorno.sql` foi aplicado em transação somente no postgres-dev, verificando inexistência das colunas/índice e preservação dos registros anteriores. Não aplicado em produção.

## Validação

- `npm run test:estoque`: API compilada/Prisma real no postgres-dev, dois tenants, baixa/pontos concorrentes, limite, rateio, venda legada, estorno integral, repetição, concorrência, rollback após reposição, proteção Financeiro e perfil. Fixtures da suíte removidas.
- `npm test` backend; `test:extrato-pontos`; `test:protecao-venda`; `test:rateio-desconto`; teste de mensagem de produtos. Dashboard e comissão/relatório incluem regressão de reembolso.
- Frontend: 16 testes, lint de cores e build completo.
- Preview manual: venda QA de R$100 com100 pontos (R$10) resultou R$90; estorno exibiu confirmação, devolveu estoque20 e saldo500, manteve original90 e saída90. Histórico marcou estornada e totais ativos0; Financeiro apresentou links ao histórico sem botões de edição/exclusão. Perfil mostrou gasto/ticket0, visitas0, compra estornada identificada, movimentos−100 e+100. Modal conferido em375px e sem overflow horizontal em768/1920px, viewport restaurado.
- Limpeza manual: helper restrito removeu somente1 produto,1 usuário,1 cliente,1 item,1 venda,2 lançamentos e3 movimentos de QA. Todas as24 tabelas foram comparadas por contagem/SHA-256 antes e depois, excluindo apenas os IDs descartáveis: demais registros intactos. Backend compilado reiniciado e `/health` HTTP200. Builds completos finais de ambos os projetos com exit0; aviso preexistente de eval em lottie-web.

Limites deliberados: estorno integral (não parcial), sem reconciliação automática de registros financeiros já divergentes, sem migração de vendas legadas e sem mudar o cálculo de visitas de serviços manuais. Ajustes manuais de estoque concorrentes e valores extremos de custo são riscos anteriores fora desta correção.
