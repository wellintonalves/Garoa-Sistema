# Sessões e limites de autenticação

## Arquitetura

O navegador usa apenas `/api` na mesma origem do frontend. O servidor do frontend encaminha a chamada para a API fixa; serviços continuam separados. Cookies de terceiros entre `valenbarber.com.br` e Railway não são necessários. Não configurar `Domain` nem `SameSite=None` como alternativa.

Há quatro cookies independentes (`__Host-valen_admin`, `__Host-valen_cliente`, `__Host-valen_barbeiro`, `__Host-valen_tenant`), com `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`. Apenas ambientes explicitamente `development` ou `test` usam nomes sem prefixo e sem Secure. NODE_ENV ausente continua seguro. O JavaScript não recebe credencial no modo definitivo e apaga as chaves antigas do localStorage; identidades permanecem somente em memória. Bootstrap autenticado, com cancelamento, restaura a identidade depois de recarregar.

Sessões de equipe/admin: até 2h sem atividade, máximo absoluto 12h. Clientes: 30min sem atividade, máximo absoluto 12h. Revalidação no banco ocorre a cada chamada, sem cache de credenciais/status. A renovação depois de 5min preserva o início absoluto. Não existe refresh-token JavaScript. Cookies só autenticam pedidos com `X-Valen-Client: web`; verbos mutáveis exigem Origin exata permitida. CORS sozinho não é a defesa CSRF.

O HMAC da sessão vincula senha, email, papel, unidade, versão e perfis atuais. `Usuario.authVersion` invalida sessões de forma durável. Alterações de senha/email/papel/unidade/verificação feitas por `prisma.usuario.update/updateMany/upsert` incrementam a versão na mesma escrita pela extensão Prisma. Desativação/reativação de barbeiro incrementa a versão por atualização relacional atômica. Arquivamento/desconexão de cliente incrementa na transação. Logout invalida todas as sessões daquele usuário, em todos os dispositivos. Exclusão de identidade falha na leitura da sessão.

Scripts administrativos/raw SQL externos à aplicação que mudem acesso/status precisam incrementar authVersion na mesma transação. Não há gatilhos ocultos. Mudanças futuras/nested writes de credenciais devem passar pelo mesmo contrato e teste de revogação.

## Limites compartilhados

A tabela `limites_autenticacao` contém somente escopo+HMAC da origem/conta, contador e expiração. UPSERT atômico usa relógio PostgreSQL. Nenhum email/IP em claro ou nova chave persistente. O segredo existente tem domínio HMAC específico para essas chaves.

Por conta: login 8/15min; cadastro 5/h; envio de código 10/15min; tentativa de código 20/15min. Aliases, maiúsculas/espaços e troca de IP não reiniciam o orçamento da conta. PR1 mantém limites por desafio e consumo único persistente.

O proxy remove encaminhamentos forjáveis. Sem evidência de um cabeçalho confiável da plataforma para IP individual, o backend trata a origem do proxy como orçamento agregado: 600 logins/15min, 100 cadastros/h, 600 envios/15min, 1.200 tentativas de código/15min. Um teto global independente de 5x esses valores é consultado antes de criar chaves variáveis; ele limita cardinalidade sob spray distribuído. Limpeza indexada de até 50.000 linhas expiradas ocorre antes da admissão, no máximo uma vez/minuto por processo; cobre mais que o máximo de chaves admitidas por janela somando todos os escopos. Não há promessa de proteção individual por IP através do proxy sem controles de borda verificados.

## Banco e implantação por etapas

Não executar migração automaticamente na inicialização, nem `db push` em produção. O script `backend/sql/seguranca-sessoes-limites.sql` é somente aditivo: campo com default 0, tabela nova e índice. Precisa de revisão de drift, backup, homologação e autorização de aplicação. Lock timeout 5s e statement timeout 30s fazem falhar em vez de aguardar indefinidamente. Nenhum dado de histórico é reescrito pelo script; não existe rollback destrutivo obrigatório.

Frontend/backend Railway publicam separadamente. A versão definitiva isolada não é uma implantação atômica. Plano preparado, cuja ativação/deploy ainda exige autorização:

1. Aplicar SQL revisado em homologação e depois em produção autorizada, antes do backend novo; código antigo tolera a coluna/tabela extras
2. Implantar backend novo com `LEGACY_SESSION_CUTOFF` explicitamente aprovado, ISO UTC absoluto e no máximo 30min depois do início do processo. Ausente, inválido, passado ou longe demais: ponte desativada
3. JWTs originais v1 são SEMPRE recusados. Um login novo, com senha válida e origem autorizada, feito pelo frontend antigo pode receber somente um v2bridge de até 5min, limitado também pelo corte absoluto, com estado/versionamento atuais. Não há troca de v1 antigo por sessão nova. Frontend novo nunca recebe esse bearer
4. Implantar frontend/proxy/CSP e testar quatro portais, cookie/reload/logout, uploads, faturamento legado e voz. Nova UI usa só cookie na própria origem
5. Remover a configuração da ponte e verificar que nenhum bearer é aceito. O prazo absoluto expira mesmo se alguém esquecer de removê-la; reiniciar não estende o prazo

Pode ser necessário fazer login novamente. Quem entrar durante a janela no frontend antigo pode precisar entrar de novo após mudar a origem do cookie; não prometer exatamente um login. Abas antigas normalmente recarregam ao navegar após 401. Aba antiga estacionada no formulário de login pode precisar atualizar a página após o corte. Retirada da ponte e teste pós-implantação são critérios de encerramento; o código local/testes não provam produção corrigida ou interrupção zero.

Rollback de frontend só é viável enquanto a ponte curta estiver válida e autorizada. Se o backend falhar, parar avanço e revisar antes de reverter para autenticação vulnerável. Não prolongar ponte automaticamente. Manter coluna/tabela aditivas evita tocar históricos durante rollback de aplicação.

## Testes

- `node --import tsx backend/scripts/testes_sessoes_limites.ts`: HTTP loopback + persistência simulada, cookies/Origin/portais, revogação, aliases, verificação, corte da ponte, login de vários usuários sob proxy
- `node --import tsx backend/scripts/testes_sessao_postgres_local.ts`: exige ALLOW_LOCAL_SECURITY_TEST=1 e DATABASE_URL/DIRECT_URL idênticas em PostgreSQL, usuário `valen_test`, host127.0.0.1 porta55439, banco descartável `valen_sessao_test`; cria schema sintético único, valida migração aditiva/histórico, 8 processos concorrentes, Prisma/HTTP/revogação reais. Não usar produção/dev remoto
- Testes de frontend cobrem respostas fora de ordem, bootstrap401, quatro portais, logout com falha e repetido; não equivalem a QA de navegador real
- Testes PR1 de cadastro/códigos mantêm separação de finalidade, CAS/consumo único e preservação de contas. Novo teste recusa sobrescrita de conta não verificada por cadastro repetido

Referências de arquitetura: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies e https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

### Páginas antigas durante a publicação

A ponte cobre autenticação, não todos os contratos antigos. Entre as versões, uma aba antiga pode precisar atualizar antes de remarcar (enviava `id` dentro do corpo), salvar configurações (enviava metadados/campos protegidos), trocar foto (enviava antes de existir cadastro) ou usar o antigo acesso público por telefone. Não afrouxar DTOs, propriedade de recurso ou verificação de identidade para aceitar esses corpos. Publicar o frontend logo após o backend e instruir atualização da página; validar todos esses fluxos na versão final. Se o intervalo não for aceitável, preparar uma versão intermediária compatível ou uma janela explicitamente autorizada. A implantação preparada não promete ausência de interrupções individuais.
