# Valéria: identidade, consultas e validação local

A Valéria é a assistente de IA do Valen Barber. Sua missão é ajudar clientes e equipe a esclarecer dúvidas e resolver tarefas da barbearia dentro das permissões e ferramentas disponíveis. O servidor orienta uma comunicação simpática, atenciosa, curta e natural, sem presumir nome ou gênero. Ela não se apresenta como humana nem afirma ter executado operações que não executou.

Exemplo de apresentação para administrador: “Sou a Valéria, assistente de IA do Valen Barber. Posso ajudar a entender os dados da barbearia, como produção, recebimentos e vendas de produtos. Nesta versão, consulto informações, mas não altero registros.” Este exemplo é editorial, não uma resposta validada do modelo real.

O avatar usa uma cópia PNG da imagem fornecida, em `frontend/src/assets/valeria.png`. O arquivo original não foi alterado. O rosto não foi recriado; o enquadramento circular é CSS. A propriedade `avatarUrl` continua permitindo substituição.

## Consultas disponíveis para administradores

`consultar_dados_administrativos` recebe tipo de consulta, datas inclusivas em America/Sao_Paulo, nome exato opcional do barbeiro/produto, meio de pagamento e critério do ranking. O servidor valida todos os campos, rejeita propriedades extras, períodos inválidos ou maiores que 366 dias e resultados com mais de 5.000 registros por seleção. Não entrega totais truncados. Nomes ambíguos exigem seleção no relatório. Não recebe tenant nem SQL do modelo.

- Produção: quantidade e valor cobrado de agendamentos concluídos pela data do atendimento. Cancelados e não concluídos ficam fora. Informa separadamente lançamentos de serviços, inclusive manuais, pela data financeira, valores após descontos e comissões históricas registradas. Não recalcula comissão pelo percentual atual. Valores ausentes são indicados.
- Recebimentos: entradas, saídas, estornos de produtos e saldo movimentado do financeiro, filtrados por dinheiro, Pix, cartão de crédito/débito ou ambos os cartões. Soma cada lançamento uma vez. Esses valores representam registros do sistema, sem conciliação bancária. Saídas não são todas devoluções. Não há parcelas estruturadas de pagamentos divididos no schema; a consulta não inventa sua distribuição.
- Produtos: ranking por quantidade ou receita, receita líquida do desconto rateado, custo unitário guardado na venda, lucro e margem bruta. Exclui vendas atualmente estornadas, como o histórico de estoque. O caixa reconhece o estorno na sua data, portanto os critérios diferem. O ranking mostra os dez primeiros; totais usam todos os registros selecionados. Não há cálculo de lucro líquido sem despesas, taxas e tributos.
- Preços: mínimo e máximo unitário registrado e média líquida ponderada por unidades, por mês, de um produto. Não existe histórico de alterações do preço de tabela; preço praticado e desconto não provam reajuste de tabela. Itens sem vínculo de estoque são agrupados pelo nome histórico, com essa limitação explícita.

As consultas usam as definições existentes de atendimento financeiro, categoria de venda/estorno, snapshots de venda e utilitários de fuso. O retorno contém apenas agregados e nomes necessários, sem nomes, contatos ou registros individuais de clientes. Toda execução revalida o administrador e tenant no banco. Clientes e barbeiros não recebem a ferramenta; uma chamada forjada também é negada no backend.

Uma operação pode fazer até duas gerações de no máximo 512 tokens cada, com uma consulta intermediária de leitura. Entrada reservada: 40.000 tokens no total; saída: 1.024. Há limite conservador de corpo UTF-8 e verificação do envelope restante antes de nova geração. Tokens e IDs das respostas são agregados antes de liquidar uma única mensagem concluída. Falha após qualquer etapa mantém a reserva incerta, sem retry pago automático. Não há histórico de conversa enviado: cada mensagem precisa conter os filtros necessários. Tarifas e franquias comerciais continuam sem definição.

## Evidência de testes em 27/09/2026

O teste com transporte real usou GPT-4.1 mini, cuja consulta de disponibilidade retornou HTTP 200. A documentação oficial informa US$ 0,40 por milhão de tokens de entrada e US$ 1,60 de saída na tarifa Standard: https://developers.openai.com/api/docs/models/gpt-4.1-mini . O modelo foi escolhido para este teste curto; não define o modelo comercial.

As três primeiras tentativas ficaram incertas por uma falha do harness de diagnóstico: a expressão regular aceitava a conversão de undefined para texto, e o código tentava ler error.code de uma resposta sem erro. A terceira tentativa registrou HTTP 200 antes desse TypeError. O problema estava na instrumentação de teste. Ela foi corrigida com validação explícita do tipo antes de acessar o campo; nenhuma resposta foi escrita manualmente para simular o modelo.

Após autorização para prosseguir dentro de US$ 0,10, uma operação real de análise completou duas gerações: 675 + 1.153 tokens de entrada e 132 + 149 de saída. A OpenAI chamou consultar_dados_administrativos e respondeu receita líquida R$ 90, custo histórico R$ 40 e margem bruta 55,56% para duas unidades fictícias. O banco registrou uma mensagem, um evento de uso, 1.828 tokens de entrada, 281 de saída e custo calculado de US$ 0,001181. O retry HTTP devolveu a mesma resposta sem nova geração. A resposta conjunta omitiu a apresentação solicitada, por isso a identidade foi testada separadamente.

A consulta real de identidade retornou: “Sou Valéria, assistente de IA do Valen Barber. Minha missão é ajudar clientes e equipe nas tarefas da barbearia, como esclarecer dúvidas e apoiar a gestão com dados. Posso consultar informações administrativas e facilitar agendamentos, mas não crio ou edito registros.” Foram 631 tokens de entrada, 59 de saída, uma mensagem e US$ 0,000347 calculado no ledger, também com replay idempotente. A referência a facilitar agendamentos deve ser entendida como orientação: não há ferramenta de agenda nesta versão.

Total confirmado nas duas operações concluídas: 2.459 tokens de entrada, 340 de saída e US$ 0,001528 no ledger, com arredondamento por operação. Isso é custo calculado pela tarifa publicada, não conciliação de fatura. As três tentativas incertas não têm usage recuperado; reserva-se conservadoramente até US$ 0,02646 para elas. O teto conservador de todo o teste automatizado era US$ 0,05292. Nenhuma compra de créditos ou alteração de billing foi feita.

`npm run test:ia-analises --workspace=barbearia-backend`, com `IA_TEST_DATABASE_URL` apontando exclusivamente para `127.0.0.1/valen_ia_test`, usa PostgreSQL e rotas HTTP reais com OpenAI simulada. Verifica autenticação, isolamento, filtros, fuso, cancelados, descontos, estornos, custo histórico em vez de atual, comissão histórica, preços praticados, ausência de dados de clientes, duas chamadas somadas e replay sem nova geração. Fixture: entrada 300 tokens, saída 70, custo calculado 232 microunidades de USD, uma mensagem e um evento de uso. Esses números são simulados, não cobrança OpenAI.

Os testes anteriores de IA e persistência também passaram. A UI foi verificada em 375, 768 e 1920 px. A chave permaneceu no `.env` ignorado; as flags desse arquivo continuam `false`. Não houve push, deploy, migração ou escrita em produção.

## Demonstração desta sessão

Interface real: http://127.0.0.1:5173/admin/login . API real local em 127.0.0.1:55440 e PostgreSQL em 127.0.0.1:55439. O endereço 55440 redireciona para o frontend; a página HTML de diagnóstico foi substituída. O login foi validado pela UI com valeria-demo@example.invalid e senha exclusivamente local Valeria-local-2026!. O avatar e o painel foram verificados dentro do dashboard real.

O processo da API permite leitura e conversa real, bloqueando outras alterações; não inicia server.ts, jobs ou backups. A chave é lida apenas pelo servidor do .env ignorado. Flags e cotas do teste são sobrescritas somente no processo. O painel avisa que são dados fictícios, OpenAI real e créditos técnicos sem valor comercial. Há orçamento adicional máximo de US$ 0,03 para interação manual, registrado em arquivo local ignorado e protegido antes de cada chamada por reserva conservadora de custo. Somando o teto automatizado e o manual, o máximo permanece abaixo de US$ 0,10. Tentativas incertas conservam sua reserva; reiniciar não zera o contador do teste.

Scripts transitórios ignorados: node_modules/ia-demo.ts e node_modules/ia-vite-local.mjs. Vite usa proxy exclusivamente local neste processo, sem alterar a configuração de deploy. A demonstração depende dos processos locais desta sessão. As flags do backend/.env continuam false e não houve push/deploy.
