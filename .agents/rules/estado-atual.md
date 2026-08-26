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

## EM ANDAMENTO AGORA

Implementação de "Cliente no lançamento manual (Parte B)".

SITUACAO: IMPLEMENTADO E COMMITADO LOCALMENTE (sem push).

O que foi feito:
- Adicionadas as colunas `clienteId` em `LancamentoFinanceiro` e `lancamentoId` em `PontoFidelidade` (com índice único) via `prisma db push --accept-data-loss` localmente (postgres-dev).
- Atualizado o histórico do cliente (backend: `cliente.service.ts` e `publico.controller.ts`) para consultar `LancamentoFinanceiro` vinculados ao cliente e mesclá-los com o histórico de agendamentos.
- Alterado o `fidelidade.engine.ts` para processar acúmulo de pontos também por `lancamentoId`.
- Alterado o `financeiro.service.ts` para capturar `barbeariaId` via ALS e criar Lançamento + Pontos na mesma transação caso `clienteId` seja preenchido.
- Criado componente frontend `BuscaCliente.tsx` com *debounce*, tratamento de fechamento por Esc/clique fora, e navegação limpa (sem erros de lint).
- Adicionado o campo `BuscaCliente` no formulário modal em `Financeiro.tsx`.
- Builds do frontend e backend (`npm run build`) completados com sucesso e sem erros de TypeScript (`tsc --noEmit`).

Próximo passo:
- Aguardando Wellinton realizar a verificação final na UI (testando os 12 cenários propostos e validando) e autorizar o push para produção.

ATENCAO - EXISTEM TRES COPIAS DO PROJETO NA MAQUINA. So uma vale:
- C:\dev\valen-barber  <- ESTA. E a unica correta
- C:\Users\welli\Garoa_Sistema  <- copia velha, NAO USE
- C:\Users\welli\OneDrive\Documentos\Garoa Sistema  <- 240 commits atrasada, dentro do OneDrive, NAO USE
Antes de qualquer comando git, confirme o caminho com pwd. Um push da pasta errada ja foi recusado por causa disso.

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

## COMO TRABALHAR

- Assuma que voce nao lembra de nada. O documento que o Wellinton entregar tem tudo. Se faltar informacao, PERGUNTE - nao deduza
- Traga o plano antes de implementar
- Quando nao souber, diga "nao sei". Nao invente explicacao
- Evidencia acima de afirmacao: mostre a saida do comando, o trecho do arquivo, o JSON real
- npx tsc --noEmit limpo e a aplicacao aberta na tela antes de dizer que terminou
- Commit local. Push so com autorizacao explicita, por tarefa
- Nenhuma escrita em producao sem autorizacao explicita
- Portugues simples nas explicacoes - o Wellinton nao e programador de formacao
