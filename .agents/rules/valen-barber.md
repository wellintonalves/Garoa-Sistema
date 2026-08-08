---
trigger: always_on
---

# Valen Barber - regras permanentes

SaaS multi-tenant para gestao de barbearias. React 19 + TypeScript + Vite + Tailwind no frontend; Node.js + Express + TypeScript + Prisma no backend. Frontend e backend hospedados no Railway (projeto Garoa-Sistema). Dominio: valenbarber.com.br. Caminho local: C:\dev\valen-barber

Visao de longo prazo: apps mobile (Android/iOS) e desktop (Windows). Por isso TODA regra de negocio fica no backend, nunca duplicada no frontend. O frontend desenha e faz preview otimista; o valor final e sempre o que o backend calcula.

## BANCO DE DADOS - LEIA ANTES DE QUALQUER COMANDO PRISMA

O banco principal e o PostgreSQL do Railway. O Supabase e secundario: backup e armazenamento de dados que mudam pouco (fotos), acessado por backend/src/services/supabase.service.ts com cliente proprio, FORA do Prisma. O Prisma aponta exclusivamente para o Railway.

Portanto pgbouncer=true e connection_limit=1 (pooler do Supabase) NAO se aplicam aqui. O DIRECT_URL existe, mas aponta para o mesmo Postgres do Railway.

ESTE PROJETO NAO USA PRISMA MIGRATE. Nao existe pasta prisma/migrations. O schema sempre foi aplicado com prisma db push.

- NUNCA rodar prisma migrate dev ou prisma migrate deploy - nao ha migrations, esses comandos nao fazem nada util
- Usar npx prisma db push seguido de npx prisma generate
- db push contra banco COM DADOS pode dropar colunas e tabelas. Em producao: rodar --dry-run primeiro, mostrar a saida ao Wellinton, e NUNCA usar --accept-data-loss
- NUNCA rodar prisma migrate reset ou db push --force-reset
- Se qualquer comando pedir confirmacao para resetar ou recriar o banco: CANCELAR e perguntar ao Wellinton

Ambiente local usa banco separado: servico postgres-dev no Railway. Antes de qualquer comando Prisma, verificar o host e confirmar que e o postgres-dev. Se nao for, PARAR e avisar.

Variaveis do Railway - armadilhas conhecidas:

- O Raw Editor mostra REFERENCIAS que so resolvem dentro da infra do Railway. No .env local viram texto literal e o Prisma falha com host invalido
- DATABASE_URL do servico Postgres aponta para postgres.railway.internal, so funciona dentro da rede do Railway
- DATABASE_PUBLIC_URL aponta para proxy.rlwy.net:PORTA, e a que funciona localmente
- No .env local: NODE_ENV=development (no Railway fica production)

## CREDENCIAIS

- NUNCA pedir que o Wellinton cole connection strings, senhas, chaves de API ou tokens no chat. Se precisar de credencial, pedir que ele preencha o arquivo .env diretamente pelo editor e apenas avise
- Ao diagnosticar problemas de .env, sempre MASCARAR senhas na saida
- NUNCA sobrescrever um .env existente sem confirmacao explicita. Se precisar de prisma init, verificar antes se ja existe .env - esse comando ja destruiu a configuracao deste projeto uma vez
- Manter todos os .env no .gitignore. Se algum aparecer no historico do git, avisar imediatamente

## FLUXO DE TRABALHO - PUSH SO COM AUTORIZACAO

- Trabalhar sempre em branch de feature, nunca direto na main
- Commits locais sao livres
- git push e merge em main SOMENTE quando o Wellinton autorizar explicitamente na conversa. Autorizacao de uma tarefa anterior nao vale para a proxima
- Antes de qualquer deploy: npx tsc --noEmit && npm run build nas duas pastas, com ZERO erros
- Ao terminar uma tarefa, reportar: arquivos alterados, o que cada mudanca faz, resultado dos testes, resultado dos builds, roteiro de teste manual, e decisoes tomadas por conta propria que merecam revisao

## ARMADILHAS DE BUILD DO RAILWAY

Passam no local e quebram no deploy:

- Import com caixa diferente do nome do arquivo (Linux e case-sensitive, Windows nao) - conferir todo import novo
- Dependencia de producao declarada em devDependencies
- package-lock.json desatualizado (o Railway usa npm ci)
- prisma generate ausente do script de build
- Variaveis VITE_ novas nao cadastradas no servico de frontend
- __dirname nao existe em ESM - se o package.json tiver type module, usar fileURLToPath(import.meta.url)
- Caminho do .env via path.resolve(__dirname, ...) muda conforme a estrutura do build (dist/server.js vs dist/src/server.js) - testar com o build compilado, nao so com npm run dev
- Em producao o Railway injeta as variaveis direto no ambiente, sem arquivo .env. A ausencia do arquivo nao pode derrubar o processo

## DINHEIRO E PONTOS

- Valores monetarios: usar DECIMAL(10,2), padrao ja adotado em todo o projeto. Nunca Float. Nunca misturar DECIMAL com inteiro em centavos no mesmo fluxo.
- Operacoes que envolvem dinheiro ou pontos de fidelidade: sempre dentro de prisma.$transaction
- Valores SEMPRE recalculados no servidor. O frontend nunca envia o total - envia os parametros e o backend calcula
- Protecao contra duplo clique obrigatoria: botao desabilitado durante a requisicao no frontend, e retorno 409 no backend se a operacao ja foi concluida

## DESIGN SYSTEM

- Tematizacao por barbearia (multi-tenant): cores vem de variaveis CSS (--cor-primaria, --fundo-pagina, --texto-principal, --fundo-card). NUNCA hardcode hex. O padrao e amber #F59E0B com fundo #0A0A0A e cards #141414, mas cada barbearia configura as suas
- O tema e ESCURO. Blocos de erro usam fundo vermelho escuro translucido com texto vermelho claro - nunca fundo vermelho claro
- Fontes: Inter para texto, JetBrains Mono para numeros e valores monetarios (usar tabular-nums em valores que mudam ao vivo)
- Padroes: sem uppercase nos textos, sem bordas nos botoes de navegacao, icones Lucide React sempre outline
- Contraste e prioridade alta: minimo 4.5:1 para texto normal, 3:1 para texto grande. Vale para labels, placeholders, textos secundarios, badges e icones
- Mobile: alvo de toque minimo de 44px, 48px em botoes de acao principal, acao primaria na parte inferior da tela
- Responsivo: funcionar em 1920px, 768px e 375px

## LAWS OF UX

Aplicar ao escrever qualquer interface:

- Jakob: seguir padroes conhecidos (menu lateral no desktop, bottom tab no mobile, label acima do campo). Nao inventar padroes novos
- Fitts: alvos grandes e faceis de alcancar
- Hick: no maximo 7 opcoes visiveis por vez
- Miller: agrupar informacao em blocos logicos; maximo 4 cards por linha
- Estetico-Usabilidade: padding minimo de 16px em cards e 24px em secoes; hierarquia tipografica clara; alinhamento perfeito
- Pareto: destacar o essencial, nao sobrecarregar
- Proximidade: label a no maximo 4px do campo; separar grupos com espaco ou divisor sutil, nao com borda pesada
- Semelhanca: botoes primarios todos iguais; cards com mesmo padding e border-radius. Inconsistencia visual e bug
- Von Restorff: cor primaria SO em acoes importantes
- Pico-Fim: confirmacoes devem ser satisfatorias e informativas
- Zeigarnik: indicador de progresso em fluxo multi-etapa
- Tesler: complexidade fica no backend - autocompletar, pre-selecionar padroes, calcular automaticamente
- Doherty: feedback em menos de 400ms. Spinner em botao, skeleton em lista. Tela que demora mais de 1s sem feedback visual e bug
- Postel: aceitar variacoes na entrada (telefone com ou sem parenteses, email com espacos), exibir sempre formatado

## PADROES DE BUG A EVITAR

Ja aconteceram neste projeto:

- Botao travado em loading sem mensagem: todo handler assincrono precisa de try/catch/finally, com o finally SEMPRE limpando o estado de loading. E o cliente HTTP precisa de timeout explicito (10s) - sem ele, requisicao pendurada trava o botao para sempre
- Elemento sumindo sem explicacao: fallback gracioso mudo faz problema de infraestrutura parecer problema de configuracao. Estados diferentes exigem mensagens diferentes: erro de rede, recurso desativado, sem saldo, limite atingido
- Erro engolido no backend: logar erro e seguir como se nada tivesse acontecido dificulta o diagnostico. Mensagem de erro boa economiza horas - informar o que falhou, qual configuracao foi carregada e o que verificar (sempre mascarando dados sensiveis)
- Nunca usar alert() para erro. Sempre bloco visivel na interface
- Nunca usar any em fluxo novo
## COMO RODAR LOCALMENTE

Estrutura: monorepo com backend em backend/ e frontend em frontend/. Backend na porta definida em PORT no .env (3001). Frontend em Vite.

ATENCAO - causa de bug ja ocorrido neste projeto: rodar npm run dev a partir da RAIZ (C:\dev\valen-barber) faz o processo do backend herdar o cwd da raiz. Se o carregamento do .env depender do cwd, ele carrega o arquivo errado ou nenhum, e o Prisma falha com host invalido. Aplicar as DUAS protecoes:

- Rodar backend e frontend separadamente, cada um a partir da sua propria pasta
- Garantir que o backend carregue o .env por caminho absoluto derivado do proprio modulo, nunca do cwd

Ordem para subir o ambiente do zero:

1. Confirmar que o host do banco no .env e o postgres-dev, nao o de producao. Se nao for, PARAR e avisar
2. cd backend; npx prisma db push; npx prisma generate
3. Rodar o seed para ter dados de teste: barbearia, admin, barbeiro, cliente com pontos, servico e agendamento em aberto
4. Subir o backend e conferir GET /api/health antes de testar qualquer tela
5. Subir o frontend apontando para o backend local

Durante o desenvolvimento local:

- Alteracao em .env ou em schema.prisma NAO e recarregada a quente. Parar o servidor, aplicar, e religar limpo
- Depois de mexer no schema, rodar db push e generate de novo antes de testar
- NUNCA testar contra o banco de producao. Se o teste exigir dados reais, pedir autorizacao ao Wellinton
- Antes de dizer que terminou, rodar o BUILD COMPILADO e executar o dist, nao apenas npm run dev. Varios erros so aparecem no build, e o Railway roda build
- Ao entregar, informar as credenciais geradas pelo seed e o roteiro de teste manual passo a passo
