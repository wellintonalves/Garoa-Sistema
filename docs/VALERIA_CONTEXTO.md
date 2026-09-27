# Contexto e períodos da Valéria

O navegador envia apenas a mensagem e um UUID da conversa. O servidor recupera até três pares de mensagens da mesma barbearia, pessoa, perfil e conversa, com limite de 6 KB e validade de 30 minutos. O conteúdo fica cifrado no resultado da reserva existente; não há tabela nova. Reabrir o painel mantém a conversa; recarregar a página inicia outra. Não é memória permanente.

O histórico não aceita instruções de sistema nem resultados de ferramentas enviados pelo navegador. A autorização atual é validada antes do envio ao provedor. A chave de idempotência também considera a conversa. Repetir um pedido concluído recupera o resultado sem nova geração.

O servidor calcula “este mês” desde o primeiro dia e “esta semana” desde domingo, em America/Sao_Paulo, até o instante da consulta. Fechar aos domingos não desloca o início da semana; lançamentos excepcionais nesse dia entram no cálculo. Horários futuros ficam fora.

O ranking compara os barbeiros da barbearia, inclusive profissionais inativos com histórico. Reutiliza o cálculo do relatório de produção: serviços após descontos e antes da comissão, por data financeira. Produtos, cancelados, fechamentos duplicados e registros inconsistentes são excluídos. O padrão é valor produzido; quantidade exige pedido explícito. Empates e períodos sem produção têm resultado próprio. A consulta aceita até 500 profissionais e 5.000 lançamentos, apresenta até dez posições e todos os líderes empatados.

`npm run test:ia-contexto --workspace=barbearia-backend` usa somente o PostgreSQL local de testes indicado por IA_TEST_DATABASE_URL. Cobre calendário, fuso, domingo excepcional, ranking, empate, ausência de dados, continuação de pedido, isolamento, expiração, revogação e repetição idempotente. O transporte do provedor é simulado nesses testes; eles não medem a interpretação de um modelo real.

## Validação com o modelo real em 27/09/2026

Duas mensagens foram enviadas pelas rotas HTTP reais, com autenticação e dados exclusivamente fictícios no PostgreSQL local. “Qual barbeiro mais produziu este mês?” chamou RANKING_PRODUCAO com ESTE_MES, sem filtro de barbeiro, e respondeu Ana fictícia, R$ 300. “E nesta semana?” recebeu o par anterior como contexto, chamou o mesmo ranking com ESTA_SEMANA e respondeu Bia fictícia, R$ 200, desde domingo 27/09. Não pediu datas nem o nome do profissional. Cada repetição idempotente recuperou a mesma resposta sem nova chamada.

Foram quatro gerações GPT-4.1 mini, todas HTTP 200: 6.557 tokens de entrada e 287 de saída. O ledger registrou duas mensagens e US$ 0,003083 calculados pela tarifa configurada, sem conciliação de fatura. O diagnóstico teve uma falha inicial de configuração de autenticação local, antes de qualquer chamada ao provedor; ela foi corrigida com segredos efêmeros separados por perfil.

Somando US$ 0,001528 confirmados nos diagnósticos anteriores, US$ 0,02646 reservados para três tentativas antigas incertas e o teto integral de US$ 0,03 da demonstração manual, o total conservador após essa validação é US$ 0,061071. O teto previamente reservado para as quatro novas gerações era US$ 0,03528, com máximo combinado de US$ 0,093268. Não houve compra, alteração de billing ou troca automática de modelo. A ajuda foi validada com transporte simulado, não em uma nova chamada paga.
