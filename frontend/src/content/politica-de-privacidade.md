# Política de Privacidade do Valen Barber

**Minuta consolidada para revisão em 15 de setembro de 2026. Não publicada e sem data de vigência.**

Esta política explica o tratamento de informações de administradores, profissionais e clientes no Valen Barber. Reúne o funcionamento identificado e as regras aprovadas para a operação. O anexo identifica o que precisa ser confirmado antes da publicação; funcionalidades preparadas localmente não são apresentadas como disponíveis em produção.

## 1 Responsável e contato

O Valen Barber é oferecido por Wellinton Pereira Alves, pessoa física, identificado nos Termos de Uso, com endereço na Av. Moaçara, 2070, bairro Diamantino, Santarém, PA, CEP 68025-740.

Para dúvidas e solicitações de privacidade, utilize **wellintonalves1910@gmail.com**. O atendimento ocorre de segunda a sexta-feira, das 8h às 12h e das 14h às 18h, no horário de Brasília. Pedidos podem ser enviados fora desse horário. Uma futura mudança para pessoa jurídica será acompanhada da atualização da identificação e da comunicação pertinente.

## 2 Responsabilidades pelo tratamento

O Valen Barber decide sobre o tratamento necessário à administração das suas contas, assinaturas, suporte, segurança e campanhas próprias. Cada barbearia decide sobre seus atendimentos, registros comerciais e campanhas. Nas operações realizadas em nome da barbearia, o sistema trata os dados para prestar o serviço contratado. A classificação de controlador e operador deve acompanhar cada operação concreta.

Pedidos relacionados ao atendimento ou aos registros de uma barbearia podem exigir sua participação. Isso não impede o contato pelo canal desta política. A conta global de um cliente pode possuir vínculos com vários estabelecimentos; esse vínculo não autoriza acesso irrestrito de uma barbearia aos registros das demais.

## 3 Dados utilizados

**Contas e acesso.** Nome, e-mail, credencial de autenticação, perfil de acesso, vínculo com a barbearia, informações de verificação de e-mail e registros de criação da conta. As senhas são armazenadas por hash e as sessões utilizam tokens.

**Clientes.** Telefone, data de nascimento, observações e código de indicação, conforme os campos utilizados. A implementação local prevê nascimento no novo cadastro e edição no perfil. Clientes antigos sem essa informação permanecem com idade desconhecida. A data declarada não comprova identidade nem autorização de responsável.

**Profissionais.** Foto, telefone, especialidades, disponibilidade e horários, comissão, situação do cadastro e avaliações, além dos dados da conta.

**Operações.** Agendamentos, serviços, remarcações, profissional escolhido, valores, descontos, formas de pagamento registradas, lançamentos, compras presenciais, fidelidade, resgates, indicações e avaliações. Estoque e produtos podem estar associados a operações identificadas.

**Comunicações e preferências.** Mensagens do chat e suporte, remetente, data e situação de leitura, além das escolhas promocionais por origem e canal. Evite inserir informações sensíveis desnecessárias em mensagens ou campos de observações.

## 4 Finalidades

**Registro dos documentos apresentados.** Para novas contas, registramos a data da confirmação, a origem e as versões dos Termos de Uso e da Política de Privacidade apresentadas. Contas antigas não recebem datas ou confirmações retroativas. Para barbearias em transição para planos, registramos a apresentação do aviso e os prazos de contratação e consulta/exportação. Esses registros permitem explicar as condições aplicáveis e atender solicitações relativas à conta; não substituem as escolhas promocionais por canal e remetente.

Os dados apoiam a criação e administração de contas, autenticação, agenda, disponibilidade dos profissionais, registro de operações, consulta de histórico, fidelidade e comunicação com a barbearia. Também permitem suporte, proteção das contas e administração da assinatura.

A data de nascimento já possui uso nas funções de aniversário da fidelidade e na listagem de aniversariantes. Sua utilização para determinar idade declarada deve ser distinguida de eventuais mecanismos específicos de verificação de idade, que exigem avaliação própria.

As hipóteses legais devem ser definidas por finalidade, considerando execução contratual, obrigações legais, exercício de direitos, consentimento ou legítimo interesse quando cabível. O aceite geral desta política não substitui escolhas específicas necessárias. O enquadramento detalhado ainda será revisado antes da publicação.

## 5 Promoções por e-mail e pelo aplicativo

Estão previstas campanhas das barbearias e campanhas próprias do Valen Barber. O cliente poderá escolher separadamente o remetente e o canal, e desativar cada escolha quando quiser. Aceitar mensagens de uma barbearia não autoriza campanhas de outra ou do Valen Barber.

As preferências começam desligadas até uma escolha afirmativa. Recusar promoções não impede os avisos necessários de agendamento, segurança e administração da conta. As mensagens deverão identificar claramente quem as envia e oferecer um caminho simples para alterar as preferências.

A implementação local já registra essas escolhas e suas alterações. A ativação está bloqueada para menores de dezoito anos ou pessoas com idade desconhecida. O mecanismo de envio de campanhas e notificações ainda não foi implementado; o armazenamento de preferências não significa que campanhas já sejam entregues.

## 6 Fornecedores e acesso

Os perfis de acesso e vínculos determinam as informações disponíveis para administradores e profissionais. As exportações devem respeitar a unidade do administrador e não incluir credenciais ou informações alheias a esse contexto.

Foram identificados **Railway**, para hospedagem e bancos PostgreSQL; **Supabase Storage**, para fotos e logos; e **Resend**, para e-mails de verificação, recuperação e alertas operacionais. Fotos e logos nos buckets atualmente configurados podem ser acessados por URLs públicas.

O **Asaas** foi escolhido para a cobrança futura, mas permanece desativado. Antes da integração, a política deverá detalhar os dados transmitidos para cobrança e conciliação. A futura loja virtual também exigirá atualização compatível com seu funcionamento.

## 7 Localização e armazenamento no navegador

O painel Railway consultado mostra o backend no leste dos Estados Unidos e o banco principal na Virgínia. Outro banco, denominado postgres-dev, está na Califórnia; sua função exata ainda precisa ser confirmada. Portanto, há tratamento fora do Brasil. A região do Supabase e os instrumentos aplicáveis às transferências internacionais permanecem em conferência.

O navegador armazena tokens e dados básicos da sessão, tema, preferências de agenda e som do chat e informações temporárias de convites. Remover esses dados pode exigir novo login e redefinir preferências, mas não exclui automaticamente registros dos servidores. Não foi identificada integração de análise publicitária no código pesquisado; a aplicação publicada ainda deve ser conferida.

## 8 Exportação conservação e exclusão

A regra aprovada prevê **trinta dias de consulta e exportação** após o encerramento do acesso contratado, sem novos lançamentos. A exportação preparada utiliza um pacote ZIP com arquivos CSV por categoria, manifesto e instruções, preservando relações entre registros e excluindo senhas, tokens e códigos de autenticação. Inclui os dados operacionais pertinentes à barbearia. Sua disponibilidade depende da aplicação e validação das alterações no ambiente de operação.

Após a janela de trinta dias, será iniciada a triagem dos dados para revisão da conservação e eventual exclusão autorizada. O fim da janela encerra o acesso de consulta e exportação da barbearia, mesmo quando determinados dados precisem continuar armazenados com acesso interno restrito.

**Histórico financeiro: prazo operacional de doze meses.** Para atendimento de suporte, foi definido conservar o histórico financeiro por doze meses de calendário. Nesta minuta, o marco inicial adotado é o fim do acesso contratado, e não a data de cada lançamento; esse marco é uma premissa operacional explicitada para revisão. Se a data correspondente não existir no ano seguinte, utiliza-se o último dia do mês. A conservação interna não prolonga o acesso da barbearia após os trinta dias.

Esse prazo não foi validado por advogado e não é apresentado como suficiente para cumprir todas as obrigações legais. Se houver obrigação legal ou disputa que justifique conservação adicional, os dados necessários permanecerão restritos, com justificativa registrada e revisão do prazo. Ao completar doze meses, a fila encaminha o caso para revisão; não executa exclusão automática de histórico financeiro. A tabela de retenção das demais categorias e o procedimento de autorização ainda precisam ser concluídos.

A regra operacional aprovada prevê que os dados excluídos da base principal saiam dos backups em **até trinta dias após essa exclusão**, ressalvada conservação legal necessária. A aplicação desse prazo a todas as cópias ainda depende da configuração e validação da retenção externa. Esse prazo não se confunde com a janela de exportação. Cópias manuais e snapshots dos fornecedores devem ser abrangidos, e restaurações devem respeitar exclusões já registradas. A fila local de revisão não comprova exclusão nem limpeza de snapshots.

Arquivar um cadastro por limite de plano não significa eliminar dados pessoais. O encerramento de um vínculo não deve apagar indevidamente a conta global ou o histórico de outras barbearias. Os direitos individuais não ficam limitados ao prazo comercial de exportação.

## 9 Direitos e solicitações

O titular pode solicitar confirmação e acesso, correção, informações sobre compartilhamento e, quando cabível, eliminação, anonimização, bloqueio ou portabilidade. Também pode revogar consentimentos e exercer oposição e revisão de decisões automatizadas nas hipóteses legais. O canal é o e-mail indicado nesta política.

A identidade poderá ser conferida proporcionalmente para evitar acesso por terceiros. A resposta deverá explicar eventuais limitações legais e a participação necessária da barbearia. O titular também pode recorrer à ANPD e aos órgãos competentes.

## 10 Crianças e adolescentes

O fluxo de idade, agendamento e participação de responsáveis permanece em revisão. A proposta de agendamento a partir de quinze anos não constitui conclusão jurídica nem dispensa automática da atuação de responsável. Esta minuta não autoriza a ativação desse fluxo antes da definição e validação das salvaguardas aplicáveis.

## 11 Segurança e atualizações

Os controles identificados incluem hash de senhas, autenticação por tokens, limitação de tentativas de login e permissões por perfil e unidade. Reduzem riscos, mas não representam garantia de invulnerabilidade. Situações suspeitas podem ser comunicadas pelo canal de privacidade para avaliação e providências pertinentes.

Alterações relevantes serão comunicadas de forma acessível. A versão publicada deverá indicar sua vigência e preservar o registro das versões anteriores. Novas finalidades que dependam de consentimento exigirão escolha apropriada, sem presumir autorização retroativa.

## Anexo de verificação antes da publicação

Permanecem pendentes a revisão jurídica das regras de menores, das bases legais por finalidade e da retenção por categoria; a confirmação de regiões, contratos e retenção dos fornecedores; e os procedimentos de atendimento aos titulares e resposta a incidentes. A integração Asaas depende de homologação no Sandbox real e da definição dos dados efetivamente transmitidos antes de ser habilitada. Campanhas e loja virtual exigirão revisão própria antes de sua disponibilização.

As migrações, a cópia e a restauração já foram testadas em PostgreSQL local descartável, conforme os registros da segunda etapa. Essa validação não comprova migração com dados legados reais nem recuperação nos fornecedores. A preparação operacional de migração, backup, rollback e monitoramento permanece necessária. A exclusão física e a limpeza de snapshots não são executadas pela fila local de triagem.
