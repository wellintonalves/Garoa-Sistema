# Contexto e períodos da Valéria

O navegador envia apenas a mensagem e um UUID da conversa. O servidor recupera até três pares de mensagens da mesma barbearia, pessoa, perfil e conversa, com limite de 6 KB e validade de 30 minutos. O conteúdo fica cifrado no resultado da reserva existente; não há tabela nova. Reabrir o painel mantém a conversa; recarregar a página inicia outra. Não é memória permanente.

O histórico não aceita instruções de sistema nem resultados de ferramentas enviados pelo navegador. A autorização atual é validada antes do envio ao provedor. A chave de idempotência também considera a conversa. Repetir um pedido concluído recupera o resultado sem nova geração.

O servidor calcula “este mês” desde o primeiro dia e “esta semana” desde domingo, em America/Sao_Paulo, até o instante da consulta. Fechar aos domingos não desloca o início da semana; lançamentos excepcionais nesse dia entram no cálculo. Horários futuros ficam fora.

O ranking compara os barbeiros da barbearia, inclusive profissionais inativos com histórico. Reutiliza o cálculo do relatório de produção: serviços após descontos e antes da comissão, por data financeira. Produtos, cancelados, fechamentos duplicados e registros inconsistentes são excluídos. O padrão é valor produzido; quantidade exige pedido explícito. Empates e períodos sem produção têm resultado próprio. A consulta aceita até 500 profissionais e 5.000 lançamentos, apresenta até dez posições e todos os líderes empatados.

`npm run test:ia-contexto --workspace=barbearia-backend` usa somente o PostgreSQL local de testes indicado por IA_TEST_DATABASE_URL. Cobre calendário, fuso, domingo excepcional, ranking, empate, ausência de dados, continuação de pedido, isolamento, expiração, revogação e repetição idempotente. O transporte do provedor é simulado nesses testes; eles não medem a interpretação de um modelo real.
