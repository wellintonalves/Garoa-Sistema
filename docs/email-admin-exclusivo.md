# Email exclusivo para administradores

Regra confirmada pelo Wellinton em 09/09/2026: o mesmo email de ADMIN não pode cadastrar outra barbearia. Clientes e barbeiros continuam podendo ter o mesmo email em unidades diferentes.

## Implementação

- `AuthService.registrar`: normaliza email, verifica duplicidade global apenas de ADMIN e duplicidade local para os demais papéis; usa transação SERIALIZABLE para verificação e criação.
- Nova barbearia e usuário são criados juntos. Falha ou disputa concorrente não deixa uma barbearia órfã; conflitos conhecidos recebem HTTP 409.
- Controller delega a criação inteira ao serviço e encaminha erros ao middleware central.
- Sem alteração de schema. A proteção vale para o fluxo de cadastro do aplicativo, não é um índice global no banco; scripts ou futuras rotas de promoção/alteração de ADMIN precisam respeitar a mesma regra.
- Login existente preservado nesta publicação. Bloqueio de contas administrativas legadas duplicadas foi deliberadamente separado para não interromper a H Sousa antes da regularização.

## Validação

- `npm test`: fechamento, fidelidade, comissão e regressões de cadastro com persistência controlada.
- `npm run test:email-admin-postgres`: postgres-dev, duas transações simultâneas reais, apenas um ADMIN e uma nova barbearia; duplicidade retorna 409; cliente com mesmo email permitido.
- Rotas HTTP reais: cadastro duplicado 409; novo ADMIN 201; login 200 com barbearia correta. Somente envio de verificação de email substituído por adaptador de teste, sem email externo.
- Limpeza das fixtures verificada após o teste. Nenhuma escrita de teste em produção.

## Pendências separadas

- Desativar cadastro antigo da H Sousa e impedir seus acessos, inclusive tokens existentes: autorizado, mas ainda não executado. Exige implementar/verificar bloqueio por barbearia inativa antes da operação em produção.
- Não excluir usuários, serviços ou histórico. Cadastro com 154 lançamentos deve permanecer intacto.
- Não há registro de último login no schema atual; ausência de lançamentos não comprova ausência de acesso.
- Não corrigir automaticamente os lançamentos antigos de comissão nesta publicação.

## Verificação manual após implantação

1. No portal ADMIN, tentar registrar email administrativo já existente: mensagem de duplicidade, sem nova unidade.
2. Conferir login de administrador existente: comportamento preservado.
3. Cadastro com email novo: mantém criação e envio de verificação. Validar entrega real do email separadamente.
4. Clientes continuam podendo se vincular a mais de uma barbearia.
