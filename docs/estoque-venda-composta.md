# Estoque: catálogo e venda composta

Implementação local em 13/09/2026, sem publicação em produção.

## Mudanças

- `frontend/src/pages/Vendas.tsx` e `Vendas.css`: título Estoque, quatro cards de resumo preservados, catálogo com busca sem acentos, categorias reais, cards, carrinho lateral sticky no desktop e empilhado em telas menores. Cadastro/edição, quantidade, preço, estado sem estoque/sem preço, subtotal, total, pagamento, remoção e limpeza. Histórico agrupa os novos itens pela venda; registros antigos continuam separados.
- `backend/prisma/schema.prisma`: categoria textual opcional por produto; nova VendaEstoque; vínculo opcional VendaProduto.vendaId; relação com lançamento financeiro e chave única por barbearia/requisição. Nenhum vínculo histórico foi inferido.
- `backend/src/services/estoque.service.ts`: validação e baixa condicional dentro de transação serializável; consolidação de produtos repetidos; cálculos Decimal; um lançamento financeiro por venda; snapshots dos preços/custos; rejeição de repetição/conflito com 409. Consultas explicitamente limitadas à barbearia. Payload de edição permitido por lista branca. Venda individual também usa o caminho atômico.
- `backend/src/controllers/estoque.controller.ts`: repassa chave da requisição e usa erro central no carrinho.
- `backend/scripts/testes_estoque_venda.ts` e atalho `npm run test:estoque`: integração com API compilada e PostgreSQL de desenvolvimento.

## Banco

Host confirmado como postgres-dev antes dos comandos. Comparação inicial: nenhuma diferença. Após alteração, SQL apenas aditivo: duas colunas opcionais, uma tabela e índices/relações. Aplicado via `prisma db push --skip-generate`, sem flags de perda de dados; Prisma Client regenerado. Não houve backup, cópia ou correção automática.

SQL revisável em `docs/estoque-venda-composta.sql`. **Não aplicado em produção.** Antes de qualquer publicação, revisar/aplicar esse SQL no banco de produção conforme o procedimento do projeto e confirmar sincronização. Autorização desta tarefa cobre implementação local, não push/deploy.

## Verificações executadas

- Build completo de backend e frontend passou; lint de cores passou. Um erro de inferência de array foi corrigido antes de aprovar o backend.
- Suítes existentes do backend passaram (fechamento, fidelidade, comissão, email administrativo e dashboard); frontend: 16 testes passaram.
- API compilada/Postgres: quantidades zero/negativas/fracionárias rejeitadas; produto de outra unidade e sem preço rejeitados; IDs repetidos consolidados em uma linha; total do servidor 60,60 ignorou total enviado; dois itens vinculados a uma venda/lançamento; repetição409; rollback integral quando o segundo produto falha; concorrência pela última unidade resulta em201+409; legado permaneceu sem vínculo; serviços não vinculados. Fixtures removidas e limpeza confirmada.
- Preview: cadastro de dois produtos descartáveis, categoria, busca sem resultados, limpar filtros, adicionar dois produtos, mesmo produto na mesma linha, aumentar/diminuir, limite de estoque, remover, limpar carrinho e finalizar desabilitado quando vazio. Seleção de Dinheiro, venda de30 com dois itens, tela bloqueada durante envio, sucesso, baixa e histórico agrupado conferidos.
- Edição/quantidade zero: produto sem estoque ficou desabilitado. Atalho Definir preço abriu edição do produto existente sem salvar nada. Fechar modal funcionou. Botão de recuperação carregou catálogo após indisponibilidade inicial. Alterar data pelo teclado disparou validação de período; ajuste adicional limpa resultados anteriores e adapta o botão de nova tentativa ao histórico.
- Capturas inspecionadas em375,768 e1920; sem overflow horizontal medido. Override de viewport removido ao final. Não alterado tema da barbearia: acentos seguem tokens configuráveis, sem impor cor fixa.
- Dois produtos temporários, seus dois itens, uma venda e um lançamento financeiro da validação visual foram removidos por IDs conferidos, em transação. Nenhum produto anterior foi alterado; seis produtos originais preservados.

## Decisões para revisão

- Categorias são rótulos opcionais editáveis no produto, com sugestões dos rótulos existentes. Não há tela separada de gerenciamento de categorias.
- Receita potencial e lucro estimado consideram apenas produtos com preço positivo; custo do estoque considera todos. Texto visível explica a diferença, evitando prejuízo artificial causado por preço ausente.
- Após resultado incerto/conflito, carrinho é bloqueado até conferir histórico e iniciar nova venda; não há repetição automática que possa gerar duplicação.
- Fluxos de serviços, comissões, agenda e fidelidade não foram alterados. Não existe checkout misto.

Preview: http://localhost:5173/admin/vendas (backend local compilado na porta3001, postgres-dev, tarefas automáticas desligadas).
