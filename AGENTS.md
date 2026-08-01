# AGENTS.md — Valen Barber

Regras obrigatórias para qualquer agente que trabalhe neste repositório.

## Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind
- **Backend:** Node.js + Express + TypeScript + Prisma
- **Banco principal:** PostgreSQL no Railway
- **Réplica de backup:** Supabase (cópia diária às 4h)
- **Hospedagem:** Railway — frontend e backend em serviços separados, com deploy automático a cada push na `main`
- **Domínio:** valenbarber.com.br
- **Visão de longo prazo:** o sistema será expandido para app mobile (Android e iOS) e desktop (Windows). Decisões de arquitetura devem considerar isso.

---

## 1. Antes de qualquer push — obrigatório

Rode o **build completo**, o mesmo que o Railway executa. Nunca valide apenas com `tsc --noEmit`: ele não executa os lints do projeto, e já deixou passar três deploys quebrados.

```bash
npm run build --workspace=barbearia-frontend
npm run build --workspace=barbearia-backend
```

O build do frontend executa `lint:cores && tsc -b && vite build`. **Se qualquer um dos dois falhar, não faça push.** Corrija e rode de novo.

Frontend e backend são serviços separados no Railway. Um pode subir enquanto o outro falha — então valide sempre os dois, mesmo que a alteração pareça tocar só um lado.

## 2. Nunca suba frontend sem o backend que o alimenta

Se uma tela nova consome um endpoint novo, os dois vão juntos no mesmo push. Subir só o frontend publica tela quebrada em produção.

Vale o inverso ao reverter: ao remover um endpoint, remova também a rota e os atalhos que levam a ele.

## 3. Banco de dados e schema

- **Nunca** altere `schema.prisma` sem aprovação explícita, mesmo que a tarefa pareça exigir.
- **Nunca** rode migration, `db push` ou qualquer comando de escrita contra o banco de produção.
- Antes de propor mudança de schema, verifique drift: `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
- Alterar schema significa mapear antes o impacto em: **agendamentos, financeiro, comissões, fidelidade, relatórios e histórico do cliente**.
- Evite `onDelete: SetNull` em relação que sustenta histórico financeiro. Prefira bloquear a exclusão a anular a referência.

## 4. Exclusão de dados

Toda exclusão permanente precisa de:

1. Validação de vínculo **no backend**, no momento do delete. Checagem só na UI não conta.
2. Confirmação explícita do usuário (digitar o nome do registro).
3. Bloqueio quando houver histórico — nesse caso ofereça desativar, nunca excluir.

Registro com histórico continua aparecendo em relatórios, financeiro e histórico do cliente. Some apenas da agenda e das telas de criação.

## 5. Git

- Um commit por assunto. Nunca misture correção de bug, feature e configuração no mesmo commit.
- Mensagens: `feat:`, `fix:`, `refactor:`, `style:`, `chore:`
- **Nunca** use `git reset --hard` sem antes garantir que alterações não commitadas estejam em stash ou branch.
- **Nunca** use force push.
- Nunca versione artefatos de build (`tsconfig.tsbuildinfo`, `dist/`, `.env`).

## 6. Escopo

Quando o pedido for **plano**, entregue plano. Não escreva código, não altere schema, não crie migration. Aguarde aprovação.

Se durante a execução perceber que a tarefa exige mudança maior que a solicitada, **pare e pergunte** antes de ampliar o escopo.

## 7. Segurança

- Nunca peça `DATABASE_URL`, `JWT_SECRET` ou qualquer credencial no chat.
- Nunca escreva valores reais de credencial em arquivo versionado. Use `.env.example` com valores fictícios.
- Para comandos que precisam de variáveis de produção, use a Railway CLI (`railway run`) ou o Console do serviço no painel.
- Endpoints consumidos por clientes **nunca** podem retornar dados de outros clientes. Use serializer próprio no backend — não filtre no frontend.

---

## 8. Design System

- **Cores:** sempre tokens (`var(--cor-primaria)`, `var(--texto-principal)`). **Nunca** hexadecimal fixo. O sistema é multi-tenant e cada barbearia configura suas cores — hex fixo quebra a tematização. Há lint que barra isso no build.
- **Fontes:** Inter Tight para interface, Newsreader para títulos editoriais, JetBrains Mono para números e valores monetários.
- **Sem uppercase** em textos. Se vier de `text-transform` no CSS, remova a propriedade.
- **Ícones:** Phosphor Icons, variante outline.
- **Sem bordas** em botões de navegação.

## 9. Responsividade e acessibilidade

- Testar sempre em **375px**, 768px e 1920px.
- Alvo de toque mínimo de **48px** no mobile (Lei de Fitts).
- Contraste mínimo de **4.5:1** para texto normal e 3:1 para texto grande e ícones.
- Em flex e grid, use `min-w-0` nos filhos que contêm texto variável. Sem isso o conteúdo estoura o container — causa raiz da maioria dos overflows deste projeto.
- Valores monetários: `tabular-nums`, `whitespace-nowrap` e tamanho de fonte fluido.
- Barra de ação fixa e botão flutuante não podem sobrepor conteúdo nem o CTA principal.

## 10. Estados de tela — os três são obrigatórios

Toda tela que carrega dados precisa tratar:

1. **Carregando** — skeleton screen, não spinner de tela cheia
2. **Erro** — mensagem visível com botão de tentar novamente
3. **Vazio** — mensagem explicativa. "Japa não atende às segundas" é útil; "Nenhum resultado" não é.

Nunca deixe uma tela renderizar em branco. Toda área principal precisa de ErrorBoundary.

## 11. Tratamento de erro

Erro de transporte nunca vira mensagem de domínio. A camada de API define:

- Sem resposta / timeout → "Não foi possível conectar ao servidor. Verifique sua conexão."
- 401 → sessão ou credenciais
- 403 → permissão
- 404 → recurso não encontrado
- 5xx → "Erro no servidor. Tente novamente em instantes."

Aplique no interceptor do axios, não tela por tela. Dizer "credenciais inválidas" quando o servidor está fora do ar já custou horas de investigação neste projeto.

## 12. React — armadilhas recorrentes

- **Nunca** chame `setState` dentro de `useMemo`. Isso causa loop infinito de render, congela o navegador e resulta em tela preta sem erro no console. `useMemo` só calcula e retorna valor.
- Requisições em `useEffect` com `AbortController`.
- Nunca use `new Date()` ou objeto literal como dependência de hook — React compara por referência.
- Sempre `(lista ?? []).map(...)`. Array vindo de API pode ser `undefined`.
- Mantenha `react-hooks/exhaustive-deps` ativo.

## 13. Formulários

- Campos de email: `inputMode="email"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `autoComplete="email"`. Sem isso o teclado do celular capitaliza e quebra o login.
- Normalize email com `.trim().toLowerCase()` no frontend **e** no backend.
- Seja liberal no que aceita, consistente no que exibe (Lei de Postel).

## 14. Feedback e performance

- Toda ação precisa de resposta visual imediata. Botão de submit com estado de loading e desabilitado durante a requisição.
- Fluxos multi-etapa precisam de indicador de progresso honesto — se passos forem pulados, o indicador reflete isso, e os passos pulados continuam editáveis.
- Pré-selecione o que já é conhecido. O usuário nunca reinforma o que já informou (Lei de Tesler).

## 15. Datas e fuso

Todo cálculo de horário em `America/Sao_Paulo`. Nunca use `new Date()` do servidor sem fixar timezone. Nunca ofereça horário no passado.
