# Verificação e publicação dos controles de acesso

## Portões de liberação

1. Revisão independente do commit final e autorização explícita para publicar. Nunca fazer push em main ou executar SQL de produção automaticamente
2. Verificar versão atual implantada, drift do banco, versão PostgreSQL, backup recente e caminho de restauração já testado. O SQL aditivo tem timeout de lock; se houver contenção/drift, parar e reagendar, sem reset, drop ou aceitação de perda de dados
3. Confirmar, sem imprimir valores, presença dos três segredos de autenticação existentes e configuração de envio de email. Não inventar nem trocar credenciais
4. Validar políticas existentes do Storage conforme uploads-seguros.md. Leitura das políticas e teste autorizado em homologação são obrigatórios; a suíte local usa provedor simulado e não comprova autorização SELECT/DELETE do ambiente. Não conceder permissões anônimas novas automaticamente
5. Conferir alvo HTTPS fixo do proxy (`API_PROXY_TARGET`, padrão o backend Railway existente) e origem WSS de voz. Se voz usar outra origem, CSP_VOICE_ORIGIN deve ser a origem WSS exata aprovada. Não copiar chave de API para o frontend
6. Validar plano por etapas, duração da ponte e atualização de abas conforme sessoes-e-limites-seguros.md. Frontend/backend são serviços separados e não publicam atomicamente. Apenas credenciais curtas recém-autenticadas são aceitas pela ponte; JWT original nunca
7. Encerrar a ponte e verificar recusa de Bearer, cookies/CSRF, quatro portais, verificação/recuperação, agendamento, financeiro, fidelidade, foto, tema e voz. Repetir GET/HEAD dos cabeçalhos públicos e conferir o commit efetivamente implantado antes de encerrar

Manter as adições de banco durante rollback de código evita operações destrutivas. Reverter autenticação para a versão antiga reintroduz riscos e exige decisão explícita, não é ação automática. Não prolongar a ponte por falha de publicação.

## Verificação local reproduzível

- Instalação limpa: npm ci
- Builds obrigatórios: npm run build --workspace=barbearia-frontend; npm run build --workspace=barbearia-backend
- Frontend: npm run test --workspace=barbearia-frontend (inclui testes do servidor/proxy)
- Backend: npm run test --workspace=barbearia-backend, com NODE_ENV=test e três JWT_SECRET* sintéticos de pelo menos 24 caracteres, nunca de produção
- A suíte padrão inclui test:seguranca: autorização, sessões/limites, imagens/multipart, logs e compatibilidade da dependência de configuração
- PostgreSQL: scripts separados `test:autorizacao-postgres-local`, `test:sessao-postgres-local`, `test:upload-postgres-local` e `test:conta-seguranca-postgres-local`. Recusam destinos fora do PostgreSQL descartável em 127.0.0.1:55439, com usuário valen_test e bancos específicos; exigem ALLOW_LOCAL_SECURITY_TEST=1
- Os fixtures são sintéticos, sem email, cobrança, IA ou bucket reais. O teste de sessões cria um schema isolado representando a estrutura antiga, aplica o SQL aditivo e compara registros anteriores; oito processos verificam atomicidade dos limites

A fixture antiga de consulta/exportação usava uma data fixa já expirada. Agora permanece no prazo previsto por meio de uma data relativa ao teste, sem alterar regra de assinatura. Os scripts de teste usam o hook TypeScript de Node em vez do IPC do executável tsx, executando os mesmos arquivos.

## Dependência de configuração

Prisma CLI/cliente permanecem na série 6, ambos fixados em 6.19.3. A única dependência afetada encontrada no inventário original era deepmerge-ts 7.1.5 no carregador de configuração Prisma; não há chamada desse carregador na aplicação HTTP. O override 8.0.2 foi validado com carga real de configuração Prisma, objetos recursivos, geração do cliente, builds e testes. A CLI também está explicitamente declarada na raiz para que npm aplique o override no monorepo; instalação limpa deve resolver somente 8.0.2. Não é uma atualização principal de Prisma nem uma alegação de segurança absoluta.

## Limitações da evidência

Testes automatizados não validam as políticas reais de Storage, os serviços implantados, o backup atual ou o comportamento de todos os navegadores. A tentativa de QA visual no navegador cloud contra o servidor sintético local foi bloqueada por ERR_BLOCKED_BY_CLIENT. Não foi contornada. Validação interativa mobile/desktop e smoke autorizado em ambiente apropriado continuam portões de publicação, não resultados já confirmados.
