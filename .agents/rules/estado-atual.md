---
trigger: always_on
---

# Valen Barber - estado atual

Este arquivo diz ONDE ESTAMOS. O arquivo valen-barber.md diz QUAIS SAO AS REGRAS. Leia os dois.

Se algo aqui contradisser o que voce acha que lembra, ESTE ARQUIVO VENCE. Voce pode ter sido reiniciado desde a ultima tarefa. Assuma que voce nao lembra de nada.

Versao 1.

## O QUE VOCE PODE E NAO PODE EDITAR NESTE ARQUIVO

PODE editar, ao terminar cada tarefa:

- A secao "EM ANDAMENTO AGORA" - o que voce fez, quais arquivos mudou, onde parou
- A secao "PENDENCIAS CONHECIDAS" - acrescentar item novo que voce descobriu

NAO PODE editar, em nenhuma hipotese:

- A tabela "DECISOES FECHADAS" - so o Wellinton muda
- A secao "O QUE JA ESTA NO AR" - so entra aqui o que foi publicado E confirmado funcionando em producao
- A secao "FILA" - a ordem e definida pelo Wellinton

NAO marque nada como testado, aprovado ou concluido por conta propria. Registre o que VOCE FEZ, nao o que voce acha que ficou pronto. Memoria que mente e pior que memoria nenhuma.

## O QUE JA ESTA NO AR (producao)

- Desconto no fechamento: em reais, em percentual e por resgate de pontos, com teto configuravel na tela de Fidelidade
- Base de calculo da comissao e do acumulo de pontos configuravel por barbearia (padrao VALOR_LIQUIDO), com o valor congelado no atendimento
- Bloqueio de agendamento fora do horario de funcionamento
- Remarcacao com historico
- Agenda exibindo multiplos servicos: bloco com a duracao somada, cartao indicando que ha mais de um, detalhes listando todos
- Escala Z_INDEX centralizada em frontend/src/utils/constantes.ts, aplicada nas tres grades de agenda
- Correcao do seletor "Todos os barbeiros", que ficava escondido atras do cabecalho fixo

## SITUACAO EM 08/09 - PRONTO PARA PUBLICAR, AGUARDANDO COMMIT

Trabalho de varias frentes concluido e TESTADO na tela pelo Wellinton. Nada commitado ainda.

Verificado por mim (Claude), lendo o codigo:
- Comissao sem barbeiro: corrigida em TODOS os lugares, com "barbeiro ? (comissaoPercent ?? 0) : 0".
  Confirmado na tela: lancamento sem barbeiro sai com comissao R$ 0,00
- Consulta em PRODUCAO retornou ZERO lancamentos com comissao fantasma. As barbearias reais
  nunca foram afetadas. Nao ha dado a corrigir
- Regra de pontos por servico agora soma TODOS os servicos do combo, nao so o primeiro
- Aniversario comparado no fuso de Brasilia
- Protecao contra resgate simultaneo (transacao serializavel + tratamento de P2034).
  Teste automatizado prova: dois lancamentos disputando 700 pontos, so um debita 500
- Validacao de entrada no calcularFechamento (rejeita NaN, negativo, ponto fracionado)
- Calculo de pontos unificado numa funcao pura usada pelos dois motores
- schema.prisma: SO o ItemAtendimento, que JA ESTA EM PRODUCAO. Nenhuma mudanca de schema pendente
- npx tsc --noEmit limpo nas duas pastas
- Testes: npm test (fechamento 10 cenarios + fidelidade combo) e test:concorrencia, todos passando

Correcoes que EU fiz nesta sessao (Wellinton autorizou apenas o mecanico):
- Apagado backend/count_ghosts.ts
- Atalhos no package.json: test:fidelidade, test:financeiro, test:concorrencia, e "test"
- Financeiro.tsx linha 118: "valorBrutoOriginal" -> "valorBruto" (campo nao existia na resposta,
  a validacao nunca disparava)
- Financeiro.tsx buscarFidelidade: apontava para /clientes/:id, que NAO devolve saldoPontos nem
  resgatePontosAtivo. Trocado para /fidelidade/clientes/:id/saldo, o mesmo que o modal de
  fechamento usa. Era por isso que o botao Pontos nunca habilitava
- Financeiro.tsx: "fidelidade.limitesResgate.pontosMaximosPermitidos" nao existe na resposta;
  trocado por "maxPontosUtilizaveis". Essa linha quebraria a tela assim que a busca voltasse
- O efeito da fidelidade passou a depender tambem de form.valor (o teto e percentual sobre ele)

PENDENTE, NAO BLOQUEIA A PUBLICACAO:
- fidelidade.engine.ts deduz "foi aniversario" comparando pontosFinais > pontos. Funciona hoje,
  mas se surgir qualquer outro bonus a descricao vai mentir. Melhor: a funcao pura devolver
  { pontos, motivo, dobrouAniversario } em vez de so o numero
- saldoFidelidade.util.ts esta em services/ mas e um util; deveria estar em utils/
- O card "Lancamentos de Hoje" no Financeiro mostra a categoria ("Servico Prestado") enquanto as
  outras duas listas ja mostram os servicos compostos. Inconsistencia visual
- Editar servicos de um lancamento existente continua nao implementado

## PRIMEIRA COISA A FAZER NA PROXIMA SESSAO

A tarefa dos ITENS DE ATENDIMENTO esta quase pronta, TESTADA PARCIALMENTE, NAO publicada.

Ja funciona e foi conferido no codigo:
- Itens criados ao marcar agendamento e no lancamento manual, com barbeariaId preenchido
- Desconto no lancamento manual (reais, percentual, pontos)
- Relatorios mostrando "Corte + Barba" em vez da categoria
- Zero silencioso da linha 170 corrigido
- Rascunhos apagados

FALTA, em ordem:

1. AUTORIZADO E NAO FEITO - corrigir as 6 ocorrencias de "barbeiro?.comissaoPercent || 50":
   financeiro.service.ts:117, agendamento.service.ts:374 e :669, barbeiroApp.service.ts:162 e :271
   Regra: const percentual = barbeiro ? (barbeiro.comissaoPercent ?? 0) : 0;
   Sem barbeiro = comissao ZERO. Com barbeiro = o percentual dele, inclusive se for 0.
   Motivo: hoje um lancamento sem barbeiro gera 50% de comissao "fantasma", que sai do liquido
   da barbearia e nao vai para ninguem. E o || tambem engole comissao configurada como 0%.
   Encontrado em teste real: lancamento de R$ 105,00 sem barbeiro com R$ 52,50 de comissao.

2. Apagar backend/count_ghosts.ts (rascunho novo)

3. O Wellinton rodar em PRODUCAO (so leitura, aba Query do servico Postgres):
   SELECT COUNT(*) AS lancamentos, COALESCE(SUM("valorComissao"), 0) AS comissao_fantasma
   FROM lancamentos_financeiros WHERE "barbeiroId" IS NULL AND "valorComissao" > 0;
   As duas barbearias reais usam lancamento manual. Se elas lancaram sem escolher barbeiro,
   o faturamento liquido delas esta sendo mostrado MENOR do que e.

4. Wellinton testar na tela: lancamento com 2 servicos, com desconto em reais, com desconto
   por pontos, e um agendamento com 3 servicos conferindo a tabela itens_atendimento

5. So entao commit e push

DADO EXISTENTE ERRADO: 1 lancamento no banco de desenvolvimento com comissao sem barbeiro.
NAO corrigir sem decisao do Wellinton.

## ESTADO ATUAL DE PRODUCAO

RESOLVIDO: o redeploy foi feito e produção está rodando o commit 95f34b1 (Parte B, tratamento
de erro nos logins, correção do vazamento entre barbearias). Backend e frontend Ativos.

BANCO DE PRODUCAO ESTA A FRENTE DO CODIGO, DE PROPOSITO:
- Colunas clienteId (lancamentos_financeiros) e lancamentoId (pontos_fidelidade): aplicadas e EM USO
- Tabela itens_atendimento (9 colunas, 4 indices, 4 chaves estrangeiras): JA CRIADA em producao,
  ainda VAZIA e ainda NAO usada pelo codigo. Foi criada antes de proposito, seguindo a regra nova

Isso e o esperado. Tabela vazia nao atrapalha nada, e quando o codigo dos itens for publicado
o db push do boot nao vai ter nada a alterar.

## REGRA APRENDIDA NA MARRA - MUDANCA DE SCHEMA VAI PARA PRODUCAO ANTES DO CODIGO

Em 27/08 o commit 95f34b1 derrubou o backend em producao. O comando de inicializacao e
"npx prisma db push && node dist/server.js", sem --accept-data-loss (removido de proposito).
O schema criava uma restricao unica, o Prisma exigiu a flag, o db push falhou, o && interrompeu
e o servidor nunca subiu. Ciclo de queda, produção fora do ar. Recuperado com redeploy manual
da versao anterior.

Procedimento obrigatorio a partir de agora, toda vez que schema.prisma mudar:
1. npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
2. O Claude revisa o SQL
3. O Wellinton aplica no banco de PRODUCAO pela aba Query do Railway
4. So entao publica o codigo. O db push do boot vira confirmacao, nunca alteracao

Se o migrate diff devolver SQL, HA mudanca pendente e ela vai para producao ANTES do push.

## HISTORICO - JA RESOLVIDO (referencia)

Em 27/08 o commit 95f34b1 foi publicado e DERRUBOU o backend em producao. Foi revertido
por redeploy manual da versao anterior. Situacao AGORA:

- GitHub main = 95f34b1 (codigo novo: Parte B, tratamento de erro, correcao do vazamento)
- Producao rodando = a implantacao ANTERIOR ("fix: remove campo total da interface do ranking")
- Banco de producao = SEM as colunas novas. O db push falhou antes de alterar qualquer coisa

CAUSA: o comando de inicializacao em producao e "npx prisma db push && node dist/server.js".
O schema novo adiciona lancamentoId com @unique em pontos_fidelidade. O Prisma exige
--accept-data-loss para criar restricao unica em tabela existente. A flag foi removida de
proposito no commit 83c5767, por seguranca. Sem ela o db push falha, o && interrompe, e o
servidor nunca sobe. Ficou em ciclo de queda.

O QUE FAZER (nesta ordem, com calma, nao as pressas):

1. Aplicar o schema em producao MANUALMENTE, pela aba Query do Railway no banco Postgres
   (o de producao e hayabusa.proxy.rlwy.net:30563). SQL exato, vindo do prisma migrate diff:

   ALTER TABLE "lancamentos_financeiros" ADD COLUMN "clienteId" TEXT;
   ALTER TABLE "pontos_fidelidade" ADD COLUMN "lancamentoId" TEXT;
   CREATE UNIQUE INDEX "pontos_fidelidade_lancamentoId_key" ON "pontos_fidelidade"("lancamentoId");
   ALTER TABLE "pontos_fidelidade" ADD CONSTRAINT "pontos_fidelidade_lancamentoId_fkey"
     FOREIGN KEY ("lancamentoId") REFERENCES "lancamentos_financeiros"("id") ON DELETE SET NULL ON UPDATE CASCADE;
   ALTER TABLE "lancamentos_financeiros" ADD CONSTRAINT "lancamentos_financeiros_clienteId_fkey"
     FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

   Tudo aditivo: duas colunas opcionais, um indice unico numa coluna recem-criada (todos os
   valores nulos, e nulos nao conflitam entre si) e duas chaves estrangeiras com SET NULL.

2. So depois: Redeploy do commit 95f34b1. O db push vai encontrar o banco ja igual ao schema,
   nao vai pedir a flag, e o servidor sobe.

3. Confirmar backend e frontend Ativos e testar a busca de clientes em producao.

REGRA NOVA - MUDANCA DE SCHEMA VAI PARA PRODUCAO ANTES DO CODIGO:
Toda vez que o schema.prisma mudar, aplicar a alteracao no banco de producao PRIMEIRO, pela
aba Query, e so entao publicar o codigo. O db push do boot passa a ser confirmacao, nunca
alteracao. Antes de publicar qualquer coisa, rodar:
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
Se sair SQL, ha mudanca de schema pendente e ela vai para producao antes do push.

## HISTORICO - BLOQUEADOR JA RESOLVIDO (mantido para referencia)

Existe um VAZAMENTO DE DADOS ENTRE BARBEARIAS no commit local, ainda NAO publicado.
Nenhum push pode ser feito ate isto ser corrigido e testado.

Arquivo: backend/src/services/cliente.service.ts, metodo listarTodos, linhas ~38 a 55.

Dois bugs no mesmo trecho:

BUG 1 (visivel) - linha 43: { telefone: { contains: termoBusca.replace(/\D/g, '') } }
Quando o termo nao tem numero (qualquer nome), o replace devolve string VAZIA, e
"contains vazio" e verdadeiro para toda linha. Resultado: toda busca por nome retorna
a base inteira. Corrigir: so incluir essa condicao se somenteDigitos.length > 0.

BUG 2 (GRAVE, invisivel) - o objeto where tem DUAS chaves OR:
  where: { OR: [filtro da barbearia], ...buscaFilter }   e buscaFilter tambem e { OR: [...] }
No JavaScript a segunda chave apaga a primeira. Com termo de busca, o filtro de barbearia
DESAPARECE. E a extensao do Prisma nao salva: o modelo Cliente esta na lista ignoredModels
em backend/src/lib/prisma.ts linha 21.
Efeito: uma barbearia buscando um nome recebe clientes de OUTRAS barbearias - nome, email
e telefone. Ha duas barbearias reais em producao.
Corrigir com AND combinando os dois blocos, nunca duas chaves OR no mesmo objeto.

TESTE OBRIGATORIO: criar duas barbearias com clientes de nomes parecidos, entrar como admin
de cada uma e confirmar que a busca so devolve os clientes da propria barbearia.

INVESTIGAR E RELATAR (sem alterar): a lista ignoredModels tem Cliente, ClienteBarbearia,
Usuario, AprovacaoEdicao e BloqueioAgenda. Verificar se algum outro modelo dessa lista e
consultado sem filtro explicito de barbearia. NAO mexer na lista sem autorizacao.

LICAO REGISTRADA: nenhum dos 12 cenarios de teste pegaria isso, porque todos usavam uma
barbearia so. Toda tela que lista dados precisa de um teste com DUAS barbearias.

## EM ANDAMENTO AGORA

Correção de comissão e isolamento de saldo de fidelidade — em andamento localmente, sem publicação.

- Corrigidos os cálculos que transformavam barbeiro ausente ou comissão de 0% em 50%, incluindo prévias, fechamentos e relatórios. A criação de barbeiro e serviço agora também preserva 0% explícito.
- As prévias e fechamentos de financeiro/agendamento agora somam pontos e resgates somente da barbearia atual.
- Executados com sucesso: `npx tsx scripts/testes_fechamento.ts` e `npx tsx src/services/desconto.service.test.ts`. O build do backend concluiu sem erro.
- A interface local abre, mas o backend permanece parado: o host do banco no `.env` não pôde ser associado com evidência local ao serviço `postgres-dev`. A regra em `valen-barber.md` exige essa confirmação antes de iniciar.
- Investigação de fidelidade: desconto por pontos cria movimento negativo em `PontoFidelidade`; resgates de recompensa são registros separados, portanto não há evidência de dupla subtração só pela fórmula do saldo.
- Decisão expressa do Wellinton nesta sessão: somar os pontos específicos de cada serviço do combo. O motor agora recebe todos os IDs (itens, lista legada ou serviço singular) nos fluxos manual, administrativo e barbeiro. Mantida a precedência existente: soma de regras específicas positivas; se não houver, cálculo por valor ou visita. Extrato inclui os nomes dos serviços.
- Executado `scripts/testes_fidelidade_combo.ts`: motor real com adaptador em memória, cobrindo soma, regras distintas de duas unidades, descrição do combo, crédito já existente, programa inativo e fallback por valor. NÃO comprova persistência PostgreSQL, concorrência nem o fluxo completo de saldo/resgate.
- Correção de avaliação anterior: a extensão de `lib/prisma.ts` já injeta barbeariaId em aggregate quando há contexto ALS; os filtros explícitos reforçam isolamento. A ausência deles não provava vazamento em requisições normais. Testes anteriores de fechamento eram da função pura, não dos serviços nem da persistência.
- Pendências concretas: alinhar pontosAcumulados da prévia ao motor; lançamento manual com crédito e débito tenta criar dois registros com o mesmo lancamentoId único; validar concorrência e saldos completos. Sem publicação.

Correção de bloqueador de lançamento (Vazamento de Erro Técnico no Login).
SITUACAO: Etapa 1 Implementada e testada localmente.

O que foi feito:
- Criada classe `ErroDeNegocio` (erro controlado e seguro para o usuário final).
- Alterado o `error.middleware.ts` para capturar `ErroDeNegocio` e formatar respostas.
- Exceções técnicas genéricas não mapeadas ganham um código `ERR-XXXX` amigável no frontend e seu rastreio completo fica restrito ao log do servidor com o mesmo prefixo `ERR-XXXX`.
- Atualizado os controllers e services de Login (Admin, Barbeiro, Cliente) para usarem `next(error)` e `ErroDeNegocio`.
- Atualizadas as páginas `AdminLogin.tsx`, `BarbeiroLoginPage.tsx` e `ClienteLoginPrincipal.tsx` para exibirem o código de referência de forma limpa, não suprimindo erros nem vazando infraestrutura.
- Validação executada usando banco forjado (.env.teste) e testado no browser com prints e logs garantindo funcionamento.

A parte B do Lançamento Manual continua com as pendências citadas abaixo, mas pausada para esse hotfix e refatorações menores.

Próximos passos desta task:
- [x] (A) `.gitignore` corrigido para UTF-8 sem BOM.
- [x] (B) Contraste de "Gasto Total" alterado para `var(--text-primary)`, garantindo contraste alto (>15:1) nos dois temas.
- [x] (C) Removido `textTransform: 'uppercase'` nos botões do modal de Financeiro.

Ações menores e correções finalizadas:
- [x] Middleware atualizado para `err instanceof ErroDeNegocio || err.name === 'ErroDeNegocio'` (previne falhas se o módulo for carregado duas vezes ou o servidor local não tiver reiniciado perfeitamente).
- [x] Testado via UI os 3 portais (Admin, Barbeiro, Cliente) com senha errada: todos exibem a mensagem limpa "Email ou senha incorretos".

**EM ANDAMENTO AGORA: Pendentes da Parte B**
- [x] Executar testes na tela de Lançamento Manual (foco no cenário 4). (Realizado com browser_subagent: duplo clique bloqueado com sucesso, apenas um lançamento criado; autocomplete, registro no perfil do cliente e pontuação avulsa verificados funcionais).
- [x] Calcular o custo real do histórico do cliente no BD (Custo identificado: `buscarPorIdCompleto` carrega todos os agendamentos, pontos, resgates e lançamentos na memória e processa totais via javascript `reduce`. Solução futura: usar agregações `_sum`/`_count` no BD e paginar os históricos).
- [x] Verificar como o vínculo cliente-barbearia é validado antes de pontuar (Validado em `FinanceiroService.criar`: ele checa a ligação direta `cliente.barbeariaId` e a tabela pivô `clienteBarbearia`. Se falhar, lança erro antes de abrir a `$transaction` de pontos).
- [x] Executar os 10 cenários finais da Parte B (cenários 2, 3, 5, 6, 7, 8, 9, 10, 11 e 12) para assegurar o funcionamento da busca aprimorada.
- [x] Tabela de Itens + Múltiplos Serviços e Desconto no Lançamento Manual (Implementado suporte a múltiplos checkboxes em `Financeiro.tsx`, simulação de descontos corrigida para o FinanceiroService.criar e persistência de `ItemAtendimento` testada com sucesso e sem erros no TypeScript).
- [ ] Edição de serviços de um lançamento existente na tela "Editar Lançamento" (Ainda não implementado, preço congelado sobrevive, manter como pendência).

SITUACAO ATUAL: A Parte B aguarda teste do Wellinton para ser considerada concluída. Aguardando liberação para a Etapa 2.

ATENCAO - EXISTEM TRES COPIAS DO PROJETO NA MAQUINA. So uma vale:
- C:\dev\valen-barber  <- ESTA. E a unica correta
- C:\Users\welli\Garoa_Sistema  <- copia velha, NAO USE
- C:\Users\welli\OneDrive\Documentos\Garoa Sistema  <- 240 commits atrasada, dentro do OneDrive, NAO USE
Antes de qualquer comando git, confirme o caminho com pwd. Um push da pasta errada ja foi recusado por causa disso.

## PRIMEIRA COISA A FAZER AMANHA

BUG ABERTO: a aba Clientes do admin mostra "Nenhum cliente encontrado" no ambiente LOCAL,
depois do db push que adicionou clienteId e lancamentoId. Antes disso a lista funcionava.

Ordem de investigacao, do mais barato para o mais caro:

1. RELIGAR O BACKEND LOCAL. O schema mudou e o prisma generate rodou, mas o processo que
   estava no ar continua com o Prisma Client antigo em memoria. Isso NAO recarrega a quente.
   Parar com Ctrl+C, rodar npm run dev de novo, e testar. Suspeito numero um
2. Se persistir: abrir o DevTools na aba Rede e ver o que a chamada de listagem de clientes
   responde. Status e corpo da resposta
3. Conferir o log do backend no terminal - erro de Prisma aparece la
4. So depois olhar o codigo. O diff de cliente.service.ts mexeu no HISTORICO do cliente
   (juntando agendamentos e lancamentos avulsos), nao na listagem. Entao o codigo da
   listagem em si nao foi alterado nesta tarefa

## DECISOES FECHADAS - nao reabra, nao proponha alternativa

| Assunto | Decisao |
|---|---|
| Preco do atendimento | O da MARCACAO, congelado em valorBruto. Preco atual so como plano B para agendamentos antigos, e com log |
| Valor monetario vindo do navegador | NUNCA aceito. O servidor calcula sozinho, sempre |
| Leitura dos servicos | Uma funcao unica: servicosIds -> servicoId -> erro. Nenhum lugar le os campos direto |
| Calculo financeiro | Uma funcao PURA, sem banco. Previa na tela e cobranca chamam a mesma |
| Data do lancamento financeiro | Data do FECHAMENTO da conta. Mantido como esta |
| Fechar atendimento futuro | Permitido, COM CONFIRMACAO mostrando a data por extenso |
| Barbeiro num atendimento com varios servicos | Sempre o mesmo. Barbeiros diferentes = atendimentos separados |
| Comissao | Percentual do barbeiro sobre o total. O campo de comissao por servico foi removido |
| Desconto | Sobre o total do atendimento, nunca por item |
| Remover servico apos concluir | Nao permitido |
| Servico extra no fechamento | Permitido, nao estende o bloco na agenda |
| Lancamento financeiro | Um so, com nome composto: Combo (Corte social + Barba + Sobrancelha) |

## CONTEXTO DE USO REAL - importante para priorizar

Duas barbearias reais ja usam o sistema em producao: a do socio do Wellinton e mais uma em teste.
ELAS NAO USAM A AGENDA. O fluxo diario delas e o LANCAMENTO MANUAL do financeiro.

Consequencia: a tela de lancamento manual e a mais critica do sistema hoje, e ela nao tem campo de
cliente. Ou seja, o programa de fidelidade nao funciona para nenhum cliente dessas duas barbearias.

## FILA - nesta ordem, uma de cada vez

1. Cliente no lancamento manual, com busca por nome (Parte B) - e a tela que os usuarios reais usam todo dia
2. Auditoria das demais telas, com foco em responsividade no celular
3. Selecao multipla de servicos no painel do ADMIN - hoje so o cliente consegue
4. Servico extra no fechamento
5. Tabela de itens com preco e duracao congelados + lancamento como combo

## PENDENCIAS CONHECIDAS - nao mexa sem pedido explicito

- DADOS DE TESTE EM PRODUCAO - NAO CORRIGIR, decisao do Wellinton. Os 4 atendimentos sem lancamento (R$ 210), o atendimento 4d4a8561 com valor errado, e os 14 agendamentos com valorBruto zerado sao TODOS da conta de teste do Wellinton. Sao valores ficticios. Os scripts A e B foram escritos mas NAO serao executados. Nao gaste tempo com isso
- Causa dos 4 orfaos: o fechamento antigo nao era atomico. Hoje o lancamento financeiro e criado dentro do mesmo $transaction que muda o status para CONCLUIDO, entao nao deve se repetir
- Editar um lancamento no relatorio nao atualiza o agendamento - os dois valores divergem
- valorCobrado e valorLiquido no agendamento sao redundantes
- z-index fora da escala em outras telas. Piores casos: AprovacoesPopup (99999) e ClienteHome (10000)
- 126 ocorrencias de --cor-primaria usada como cor de texto
- O numero 49 da escala da agenda deveria vir do CSS, nao estar escrito no codigo
- Sem migracoes versionadas: o schema e aplicado com prisma db push a cada subida
- Prisma 6.19.3, versao nova disponivel
- frontend/tsconfig.tsbuildinfo nao esta no .gitignore
- Arquivos de rascunho soltos no repositorio (query.ts, test_*.ts, scratch_time.ts, delete_users.ts e outros na raiz do backend)
- Copia antiga do projeto em C:\Users\welli\Garoa_Sistema - NAO E O REPOSITORIO ATIVO, nao trabalhe nela
- A linha de debito de pontos nao guarda o agendamento (agendamento.service.ts:396); o agendamentoId fica vazio, impedindo rastreamento de estorno.
- A descricao desse debito usa agendamentoOriginal.servico.nome - campo antigo e no singular.
- Existem tres motores ativos no projeto: financeiro.util.ts (novo), fidelidade.engine.ts (pontos, antigo) e desconto.service.ts (desconto, antigo, ainda chamado em agendamento.service.ts:332).
- O pontosAcumulados da funcao pura (financeiro.util.ts) e codigo morto, embora o teste 5.6 valide ele.
- injetarDuracaoTotalServicos sobrescreve ag.servico.nome e ag.servico.duracaoMinutos com o resumo do atendimento inteiro. O objeto deixa de representar um serviço. As três grades dependem disso para desenhar o bloco. Tarefa futura: criar ag.servicos, ag.duracaoTotalMinutos e ag.nomeServicos, parar de sobrescrever, e ajustar os 13 arquivos que leem esses campos. Lista dos arquivos levantada e disponível
- O campo servicosAdicionais tem nome enganoso: contém todos os serviços, não só os adicionais. Foi o que causou a duplicação no modal de detalhes
- A tela Editar Lançamento tem uma caixa de seleção de um serviço. Não representa combo. Depende da tabela de itens
- Grafico "Faturamento Dia a Dia" com filtro de UM dia mostra so um numero solto, sem linha. O backend JA calcula a serie por hora nesse caso (financeiro.service.ts, perto da linha 527) e o dado nao esta sendo usado. Melhoria aprovada pelo Wellinton: exibir faturamento POR HORA quando o periodo for de um dia so. Prioridade baixa, fica para depois do lancamento

## ACHADO DE ESCALA - anotado, nao corrigir agora

buscarPorIdCompleto em cliente.service.ts traz o historico INTEIRO do cliente para a memoria do
Node (agendamentos, pontosFidelidade, resgatesRecompensa e lancamentos, todos com include) e faz
as somas com .reduce() em JavaScript.

Funciona hoje porque os clientes tem poucos registros. Com um cliente de anos de casa, isso
carrega centenas de linhas na memoria e manda tudo pela rede a cada abertura de perfil.

Correcao futura: delegar as contas ao PostgreSQL com aggregate ({ _count, _sum }) e paginar o
historico exibido na tela (take: 10 e "ver mais"). Prioridade baixa enquanto a base for pequena,
mas revisar ANTES de a primeira barbearia passar de uns 200 clientes.

## COMO TRABALHAR

- Assuma que voce nao lembra de nada. O documento que o Wellinton entregar tem tudo. Se faltar informacao, PERGUNTE - nao deduza
- Traga o plano antes de implementar
- Quando nao souber, diga "nao sei". Nao invente explicacao
- Evidencia acima de afirmacao: mostre a saida do comando, o trecho do arquivo, o JSON real
- npx tsc --noEmit limpo e a aplicacao aberta na tela antes de dizer que terminou
- Commit local. Push so com autorizacao explicita, por tarefa
- Nenhuma escrita em producao sem autorizacao explicita
- Portugues simples nas explicacoes - o Wellinton nao e programador de formacao
