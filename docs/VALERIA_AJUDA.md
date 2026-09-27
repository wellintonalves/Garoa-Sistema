# Guia do sistema para a Valéria

O catálogo versionado em `backend/src/services/ia/ajudaSistema.ts` reúne 21 orientações baseadas nas telas atuais. A ferramenta recebe somente um assunto permitido para o perfil autenticado e retorna descrição, passos, limites e caminho interno. O manual completo não é enviado a cada mensagem.

Administradores têm orientações sobre agenda, produção, financeiro, comissões, estoque, clientes, serviços, fidelidade, relatórios, configurações, assinatura e chat. Barbeiros recebem ajuda da própria agenda, atendimentos de hoje, comissões e perfil. Clientes recebem ajuda de agendamento, fidelidade, histórico, chat e perfil, com o identificador da barbearia inserido pelo servidor.

O catálogo não concede permissões. Cada consulta revalida o perfil, a barbearia ativa e o vínculo atual. Não há ferramenta para escrever na agenda, financeiro ou cadastros. A ajuda descreve o que a pessoa pode fazer na interface e não afirma ter executado essas ações. Não promete disponibilidade, saldo de pontos ou permissões por plano sem uma fonte que confirme esses dados.

A conversa continua limitada a uma ferramenta de leitura e duas gerações por mensagem, com uso somado em uma única liquidação. Perguntas sobre uso consultam o guia; perguntas sobre valores reais usam a ferramenta administrativa. Os caminhos são apresentados como texto simples na interface atual.

Ao alterar rotas ou ações, revise os artigos correspondentes e atualize a versão. `npm run test:ia-ajuda --workspace=barbearia-backend` confere as rotas pela árvore de sintaxe de App.tsx, a existência dos arquivos de origem, o isolamento por perfil e barbearia, a revogação e a integração com o adaptador. A validação de conteúdo dos passos também exige revisão quando uma tela muda; existência da rota não comprova o texto de cada controle.
