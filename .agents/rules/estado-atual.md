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

Correcao do calculo do fechamento de atendimento.

Bug encontrado em producao: o fechamento lia agendamento.servico.preco - a relacao antiga, no singular - e ignorava todos os servicos menos o primeiro. Um atendimento de R$ 75,00 (tres servicos) com 10% de desconto foi registrado como R$ 36,00. A comissao saiu R$ 18,00 em vez de R$ 33,75.

O trabalho e guiado pelo documento checklist-definitivo-fechamento.md, entregue pelo Wellinton. Sao 7 blocos com caixinhas e ele substitui qualquer plano anterior.

Situacao: em execucao. Nada publicado.

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

## FILA - nesta ordem, uma de cada vez

1. Concluir a correcao do fechamento (em andamento)
2. Selecao multipla de servicos no painel do ADMIN - hoje so o cliente consegue
3. Servico extra no fechamento
4. Tabela de itens com preco e duracao congelados + lancamento como combo

## PENDENCIAS CONHECIDAS - nao mexa sem pedido explicito

- 4 atendimentos concluidos sem lancamento financeiro, R$ 210 no total
- Atendimento 4d4a8561 com valor errado em producao. Correcao pendente de autorizacao
- 14 agendamentos aguardando fechamento com valorBruto zerado; 10 deles so tem servicoId
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

## COMO TRABALHAR

- Assuma que voce nao lembra de nada. O documento que o Wellinton entregar tem tudo. Se faltar informacao, PERGUNTE - nao deduza
- Traga o plano antes de implementar
- Quando nao souber, diga "nao sei". Nao invente explicacao
- Evidencia acima de afirmacao: mostre a saida do comando, o trecho do arquivo, o JSON real
- npx tsc --noEmit limpo e a aplicacao aberta na tela antes de dizer que terminou
- Commit local. Push so com autorizacao explicita, por tarefa
- Nenhuma escrita em producao sem autorizacao explicita
- Portugues simples nas explicacoes - o Wellinton nao e programador de formacao
