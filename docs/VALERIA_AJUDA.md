# Guia do sistema para a Valéria

O catálogo versionado em `backend/src/services/ia/ajudaSistema.ts` reúne 30 orientações baseadas nas telas atuais. A ferramenta recebe somente um assunto permitido para o perfil autenticado e retorna descrição, passos, limites e caminho interno. O manual completo não é enviado a cada mensagem.

Administradores têm orientações sobre agenda, produção, financeiro, comissões, estoque, clientes, serviços, fidelidade, relatórios, configurações, assinatura e chat. Barbeiros recebem ajuda da própria agenda, atendimentos de hoje, comissões e perfil. Clientes recebem ajuda de agendamento, fidelidade, histórico, chat e perfil, com o identificador da barbearia inserido pelo servidor.

O catálogo não concede permissões. Cada consulta revalida o perfil, a barbearia ativa e o vínculo atual. Não há ferramenta para escrever na agenda, financeiro ou cadastros. A ajuda descreve o que a pessoa pode fazer na interface e não afirma ter executado essas ações. Não promete disponibilidade, saldo de pontos ou permissões por plano sem uma fonte que confirme esses dados.

A conversa continua limitada a uma ferramenta de leitura e duas gerações por mensagem, com uso somado em uma única liquidação. Perguntas sobre uso consultam o guia; perguntas sobre valores reais usam a ferramenta administrativa. As rotas verificadas ficam no guia; a resposta usa nomes de telas e botões. Links só são orientados quando a pessoa pede o link ou endereço explicitamente. Não há anexação automática de rodapé técnico nem filtro que remova trechos da resposta.

Ao alterar rotas ou ações, revise os artigos correspondentes e atualize a versão. `npm run test:ia-ajuda --workspace=barbearia-backend` confere as rotas pela árvore de sintaxe de App.tsx, a existência dos arquivos de origem, o isolamento por perfil e barbearia, a revogação e a integração com o adaptador. Os artigos de lançamento também associam trechos dos controles, requisições e efeitos do backend, conferidos no teste. Isso detecta alterações, mas não substitui a revisão do comportamento da tela.

## Correção de lançamentos em 27/09/2026

O registro local da pergunta “Como eu faço pra lançar um serviço no sistema?” continha uma resposta errada indicando Barbeiros, depois de uma pergunta sobre ranking. O ledger registrou duas gerações, compatíveis com a consulta intermediária do adaptador, mas não guardava o nome ou argumentos da ferramenta. Portanto não foi possível afirmar qual assunto o modelo consultou. O guia não diferenciava lançamento manual, conclusão de atendimento e cadastro de catálogo; o assunto PRODUCAO descrevia uma tela de consulta sem explicitar a ausência de ação de lançamento.

Agora as perguntas explícitas de uso exigem a ferramenta de ajuda. As definições dos assuntos distinguem as operações, o resultado informa os controles verificados, e o prompt manda substituir orientações antigas incorretas pela evidência atual. Se o provedor ignorar a consulta obrigatória, sua orientação não é aceita como resposta concluída. Esta é uma atualização versionada de catálogo e instruções, sem fine-tuning ou aprendizado automático.

Fluxos conferidos no código:

- Administrador, serviço realizado avulso: Financeiro → Lançamento → Entrada → serviços/barbeiro, valores, desconto, pagamento e data → Registrar. O POST /financeiro cria LancamentoFinanceiro e guarda os valores de comissão aplicáveis. Não cria agendamento.
- Atendimento já agendado: Agenda → agendamento → Concluir Agendamento → Confirmar Pagamento. O PUT /agendamentos/:id conclui e cria o lançamento financeiro na transação. Não duplicar no lançamento manual.
- Catálogo de serviços: Serviços → Novo serviço → Cadastrar. O POST /servicos cria Servico, sem lançamento financeiro.
- Barbeiro: Hoje → atendimento próprio → Concluir Atendimento → Confirmar Pagamento. O POST /barbeiro/concluir-agendamento/:id verifica o profissional e faz o fechamento. Cliente não tem ação de lançamento; pode falar com a equipe.
- Venda de produto: Estoque → Nova venda de produtos → Adicionar → Sua venda → Finalizar venda. O POST /estoque/vender-carrinho baixa estoque, cria venda e entrada financeira, guarda custo histórico e desconto rateado. Não atribui comissão de barbeiro. A interface diz que serviços são registrados separadamente; não há carrinho misto no fechamento.
- Cadastro de produto: Estoque → Novo produto → Salvar produto. O POST /estoque cria o item e seu saldo inicial, sem registrar compra ou venda financeira.
- Reposição ou ajuste: Estoque → Editar produto → Quantidade → Salvar produto. O PUT /estoque/:id substitui o saldo total. Não é uma quantidade incremental nem um formulário de movimentação com motivo; não cria receita ou despesa.
- Estorno: Estoque → Histórico de vendas → Estornar venda → motivo e confirmação de devolução/reembolso → Confirmar estorno. O POST /estoque/vendas/:id/estornar devolve estoque e pontos usados, gera saída financeira e preserva histórico. Não envia reembolso bancário. Cadastro, venda e ajuste de produtos são exclusivos do administrador.

Na interface local foram abertos Financeiro/Novo Lançamento e Estoque/Editar produto, sem salvar. Os controles de carrinho, descontos e Finalizar venda também foram conferidos. A demonstração bloqueia POSTs de negócio, inclusive a simulação de desconto; por isso Registrar ficou desabilitado nessa inspeção. A conferência do efeito de persistência foi feita no código, não por um lançamento manual na demonstração.

As regressões cobrem a pergunta literal, cadastro versus serviço realizado, conclusão de agendamento, lançar/vender/cadastrar produto, reposição como saldo total, perfis sem acesso administrativo, histórico antigo errado e ausência de consulta obrigatória. O teste com transporte simulado comprova o contrato e os controles; não é evidência da seleção semântica de um modelo real.

Nesta rodada houve validação paga específica do fluxo, distinta do teste anterior de ranking. Com histórico fictício contendo ranking e uma orientação errada sobre Barbeiros, a pergunta literal chamou consultar_ajuda_sistema/LANCAR_SERVICO e recebeu Financeiro → Lançamento → Entrada → Registrar, com aviso contra duplicação de atendimento agendado. “Como faço para vender um produto junto com um atendimento?” chamou LANCAR_PRODUTO e recebeu orientação de venda separada em Estoque, com carrinho, pagamento, baixa de estoque e receita financeira.

As quatro gerações GPT-4.1 mini retornaram HTTP 200: 8.384 tokens de entrada, 303 de saída e duas mensagens no ledger, US$ 0,003839 calculados. A asserção literal “Finalizar venda” falhou porque a resposta usou “Finalize a venda”; a falha foi preservada na evidência e as duas respostas foram revisadas, sem repetir chamadas pagas. O ledger foi recuperado por leitura local. Os modelos omitiram a rota apesar da instrução: o adaptador passou a acrescentar o caminho retornado pela ferramenta se estiver ausente. Esse complemento foi validado com transporte simulado, sem outra geração paga.

O total conservador desta sessão, incluindo os diagnósticos anteriores, US$ 0,02646 reservados para tentativas antigas incertas e todo o teto manual de US$ 0,03, ficou em US$ 0,064910. O teto anterior à rodada era US$ 0,096351. As flags do arquivo de ambiente continuam desligadas; somente o processo local usa a IA real. Não houve publicação, alteração de schema ou escrita de negócio em produção.

Posteriormente, a pedido do usuário, foi removido o complemento automático “Caminho”. O prompt também passou a evitar rotas cruas e detalhes técnicos em orientações comuns. O teste de regressão confere que o adaptador preserva o texto útil sem acrescentar rodapé e não altera um link retornado para uma solicitação explícita. Esta alteração foi validada sem chamada paga.
