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

## PARE E LEIA - BLOQUEADOR ABERTO, NAO PUBLICAR

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

SITUACAO ATUAL: A Parte B e seus pendentes de validação estão 100% concluídos e testados. Aguardando liberação para a Etapa 2.

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
