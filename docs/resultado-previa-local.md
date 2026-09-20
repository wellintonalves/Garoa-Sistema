# Resultado da prévia local

Verificado em 15/09/2026. Ambiente exclusivamente fictício, sem publicação, banco remoto, e-mail, Supabase ou cobrança real.

## URLs e acesso

- Prévia visual sintética: http://127.0.0.1:5174/dev/assinatura
- Cadastro com nascimento: http://127.0.0.1:5174/cadastro
- Login administrador: http://127.0.0.1:5174/admin/login
- Configurações reais (após login), aba Assinatura: http://127.0.0.1:5174/admin/configuracoes
- Login cliente: http://127.0.0.1:5174/
- Perfil real do cliente, nascimento e preferências: http://127.0.0.1:5174/cliente/barbearia/demo-local/perfil

Credenciais exclusivamente de demonstração, criadas só neste banco local:

| Papel | E-mail | Senha |
|---|---|---|
| Administrador | admin@demo.invalid | DemoLocal!2026 |
| Cliente | cliente@demo.invalid | DemoLocal!2026 |

Unidade: Barbearia Demonstração Local. Assinatura fictícia Básico em teste de sete dias. Provedor não configurado; ações que exigem provedor real não serão confirmadas como cobrança.

## Processos

- Vite em 127.0.0.1:5174.
- Backend em 127.0.0.1:3002.
- PostgreSQL em 127.0.0.1:55432, banco `valen_preview`, usuário local `preview`.
- Launchers/seed/logs: `.tmp/preview-local/`. Não contêm credenciais de produção.
- Vite usa configuração temporária sem `.env` frontend e sem proxy produção; API explicitamente3002.
- Backend usa launcher temporário, sem `.env` real, secrets exclusivamente locais, sem jobs/backup externo e com bloqueio de conexões Node fora de loopback. Importa o app sem o bootstrap de produção.

## Extração PostgreSQL diagnosticada

O instalador PID7712 realmente estava progredindo e encerrou. O log temporário `installbuilder_installer.log` registrou `Installation completed` e saída0. A biblioteca `runtime/lib/dict_snowball.dll` apareceu. A primeira inicialização, tentada antes dessa etapa, falhou por biblioteca ausente; o próprio initdb limpou aquele cluster incompleto. A segunda inicialização concluiu com sucesso, e o cluster atual foi iniciado localmente.

## Escopo da aplicação do schema

Foi executado Prisma `db push --schema backend/prisma/schema.prisma --skip-generate` com DATABASE_URL e DIRECT_URL explícitas para `127.0.0.1:55432/valen_preview`. O comando concluiu e o seed fictício passou.

Isso cria o esquema atual para demonstração: **não valida a migração SQL de banco legado**, preservação/transformação de dados legados nem restauração de backup. Esses gates continuam separados.

## Verificações

- Vite: HTTP200 para `/dev/assinatura` e log de erro vazio.
- Login admin e cliente reais no banco fictício: ambos retornaram tokens válidos (não registrados no relatório).
- GET autenticados: `/assinatura/`, `/configuracoes`, `/cliente/perfil`, `/cliente/preferencias-promocionais`, `/cliente/minhas-barbearias`: todos200.
- A inspeção visual fica com o coordenador; nenhuma ferramenta de navegador foi usada nesta subetapa.

## Prévia antiga

A porta5173 permanece fora desta preparação. Sua configuração inclui proxy `/api` para backend de produção. Use5174 para a demonstração isolada.

## Encerramento

Após a revisão, encerrar exclusivamente os PIDs Vite5596 e backend12540 e parar o cluster com `.tmp/postgres-portable/runtime/bin/pg_ctl.exe -D .tmp/preview-local-db -m fast stop`. O cluster contém só dados fictícios. Não é preciso apagar arquivos para encerrar os serviços.


## Correção identificada na inspeção visual

A tela autenticada inicialmente exibiu erro de conexão em assinatura/cancelamento. Não era proxy ou backend: ambos GET reais retornavam200. A deduplicação global em `frontend/src/api/client.ts` compartilhava a mesma promise entre efeitos com AbortSignal distintos; StrictMode abortava o primeiro efeito e o segundo herdava o cancelamento.

Correção pontual: GET com signal mantém ciclo independente; GET sem signal preserva deduplicação. Teste de regressão `frontend/src/api/client.test.ts` falhou antes (remontagem produzia somente uma chamada) e passou após o ajuste, verificando resposta do segundo efeito e deduplicação sem signal. Suíte frontend: 3 arquivos,18 testes aprovados. Revalidação visual pelo coordenador após recarga ainda necessária.

Revalidação visual confirmada após recarga: login demo e Configurações > Assinatura mostram Básico/Mensal/Período de teste, cartões de cancelamento e exportação sem erros de conexão. A prévia sintética foi validada em 375, 768 e 1920 pixels, sem rolagem horizontal; os alvos móveis medidos têm no mínimo 48 pixels. Aba mantida como entrega ao usuário.
Build completo frontend aprovado (lint de cores, TypeScript e Vite). Aviso preexistente de eval em lottie-web; nenhum erro de build.
