# Valen Barber — Design System (design.md)

> Documento vivo. É a **fonte de verdade** de aparência do sistema. O agente do Antigravity deve
> seguir este arquivo ao implementar UI. Vamos construindo componente por componente; nada é
> aplicado no código sem estar aqui e aprovado pelo Wellinton.

## Princípios

- Aparência **profissional**, não "cara de template/IA": espaçamento consistente, uma cor de acento
  usada com parcimônia, números alinhados, hierarquia clara, cantos e sombras coerentes.
- Referências que guiam o estilo: **Stripe** (números e botões), **Raycast/Linear** (UI escura
  limpa), **Cal.com/Google Calendar** (agenda). Adaptar a linguagem deles à nossa identidade —
  nossas cores e nossa fonte.

## Regra de tematização (obrigatória)

O acento é **temático por barbearia**. Nunca hardcode a cor nos componentes — use sempre as
variáveis CSS de tema (ex.: `--cor-primaria`). O padrão do sistema é âmbar, mas cada admin pode
definir a cor da sua barbearia. Só os **valores padrão** das variáveis podem ser definidos aqui.

---

## 1. Tipografia

**Fonte única do sistema: Montserrat.** (Substitui a fonte anterior; não usar Inter, serifadas nem
mono.)

- Importar do Google Fonts, pesos **400, 500, 600, 700**.
  `https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap`
- `font-family` base do sistema: `'Montserrat', system-ui, sans-serif`.
- Hierarquia:
  - Título de tela (h1): 24–27px, peso 700, `letter-spacing: -0.01em`.
  - Subtítulo/seção (h2/h3): 16–18px, peso 600.
  - Corpo/UI: 14px, peso 400/500.
  - Rótulos pequenos (labels de KPI, seções): 11px, peso 600, `letter-spacing: .06em`,
    `text-transform: uppercase` (uso pontual, só em micro-rótulos).
- **Números (estilo Stripe):** valores, KPIs, horários e dinheiro em Montserrat com
  `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;` e
  `letter-spacing: -0.01em`. Alinhados e tabulares — NÃO usar fonte mono para números.

### Ícones

- Conjunto **único** no sistema: **Phosphor Icons** (livre, MIT) — traço arredondado, próximo do
  iOS/SF Symbols, sem problema de licença (diferente dos ícones do WhatsApp/Apple, que são
  proprietários e não podem ser usados).
- Import: `@phosphor-icons/web` (webfont) ou `@phosphor-icons/react` (SVG).
- Peso padrão: **Regular (outline)**. Tamanho: 18–20px inline; 22–24px na tab bar.
- **Tab bar (mobile): aba ATIVA preenchida (`ph-fill`), inativas em contorno (`ph`)** — padrão iOS.
  Nas demais áreas (sidebar, botões, inputs, tabelas) usar sempre **outline (regular)**.
- Mesmo ícone para a mesma seção em todo o sistema. Cor herda do contexto (nunca hardcodar).
  Decorativo: `aria-hidden`; ícone sem texto: `aria-label`.
- Referência por seção (Phosphor): Dashboard `squares-four` · Agenda `calendar-blank` ·
  Clientes `users` · Serviços `scissors` · Financeiro `wallet` · Relatórios `chart-bar` ·
  Barbeiros `users-three` · Estoque `package` · Fidelidade `gift` · Chat `chat-circle` ·
  Configurações `gear` · Comissões `currency-circle-dollar` · Perfil `user` · Hoje `clock` ·
  Buscar `magnifying-glass` · Ações `dots-three` · Sucesso `check-circle` · Alerta `warning-circle`.

---

## 2. Cores e tokens

Paleta escolhida: **Neutra** (preto/cinza neutro). O contraste vem da **escada de elevação**, não
de cores fortes. Definir tudo como variáveis CSS; só os valores padrão ficam aqui; **acento sempre
via `--cor-primaria`**, nunca hardcode.

### Escada de elevação (regra que dá o contraste)

`fundo da página` < `card` < `superfície elevada`. Botões secundários, inputs e estados de hover
usam a **superfície elevada** para "descolar" do card e do fundo. O botão primário usa o **acento**
e se destaca pela cor + sombra. Bordas hairline (1px, baixo contraste) definem os limites.

### Modo escuro (padrão)

- `--fundo-pagina: #0A0A0A`
- `--superficie-1` (card): `#141414`
- `--superficie-2` (elevado: input, botão secundário, hover): `#1E1E1E`
- `--borda: #262626`
- `--borda-forte` (divisor/hover destacado): `#333333`
- `--texto-principal: #F4F4F4`
- `--texto-secundario: #8F8F8F`
- `--texto-terciario` (placeholder/hint): `#666666`
- `--cor-primaria` (acento, para PREENCHIMENTOS): `#F59E0B`
- `--texto-sobre-primaria: #2A1C00`
- `--cor-primaria-texto` (acento como TEXTO/BORDA): `#F59E0B` (no dark já tem bom contraste)

### Modo claro (fundo âmbar bem claro + cards brancos — mantém a identidade âmbar)

Esquema escolhido: **fundo em âmbar bem claro (intensidade "suave"), cards brancos** — dá o ar quente
do sistema e os cards brancos "flutuam" com bom contraste.

- `--fundo-pagina: #FDF8EF` (âmbar bem claro, "suave")
- `--superficie-1` (card): `#FFFFFF` (branco)
- `--superficie-2` (elevado: input/hover): `#FBF4E8`
- `--borda: #EFE9DB`
- `--borda-forte: #E3DBCB`
- `--texto-principal: #1A1712`
- `--texto-secundario: #6E675C`
- `--texto-terciario: #9A9186`
- `--cor-primaria` (acento, para PREENCHIMENTOS): `#F59E0B` (mesmo âmbar)
- `--texto-sobre-primaria: #2A1C00`
- `--cor-primaria-texto` (acento como TEXTO/BORDA): `#9A6300` — âmbar escurecido, porque
  `#F59E0B` como texto sobre branco/creme não passa no contraste. Usar este token em links,
  horários em destaque, borda/texto do botão secundário, etc.

### Cores semânticas (status/feedback) — fixas, NÃO temáticas

- Sucesso: `#34D399` sobre fundo tênue `rgba(52,211,153,.14)`
- Aviso: `#FBBF24` sobre `rgba(251,191,36,.14)`
- Perigo: `#F87171` sobre `rgba(248,113,113,.14)`
- Info: usar o próprio acento.

> Cuidado: o "Aviso" (amarelo) é próximo do âmbar. Diferenciar por ícone/contexto para não
> confundir com o acento.

### Contraste (prioridade alta)

Mínimo 4.5:1 para texto normal e 3:1 para texto grande/ícones. Texto secundário nunca abaixo disso.
Sombras escuras para elevação no dark; no claro, sombras suaves.

---

## 3. Botões

Base comum a todos:

- Fonte Montserrat **600**, 14px.
- Padding padrão: `11px 20px`. Raio: `border-radius: 10px`.
- Altura mínima: **44px** (desktop) / **48px** em ações principais no mobile.
- Transição: `transform .06s ease, box-shadow .15s ease, filter .15s ease`.
- Estado `:active` desce 1px (`transform: translateY(1px)`).
- **Loading:** trocar o texto por um spinner mantendo a largura; desabilitar clique.
- Ícones Phosphor (outline) opcionais à esquerda do texto, gap 8px.
- Tamanhos: `sm` (36px), `md` (44px), `lg` (48px). Variante `full` = 100% da largura (mobile).

### 3.1 Primário — "Soft" (estilo Stripe)

Ação principal (Agendar, Salvar, Confirmar). **Um primário por tela.**

- `background: var(--cor-primaria);`
- `color: var(--texto-sobre-primaria);`
- `box-shadow: 0 1px 2px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.28);`
- `:hover` → `filter: brightness(1.05); box-shadow: 0 2px 6px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.30);`
- `:active` → `transform: translateY(1px); box-shadow: 0 1px 1px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.20);`

### 3.2 Secundário — "Contorno âmbar" (usa o acento)

Ações de apoio (Cancelar, Detalhes). Veste o acento (temático), sem competir com o primário.

- `background: transparent;`
- `border: 1px solid color-mix(in srgb, var(--cor-primaria-texto) 55%, transparent);`
- `color: var(--cor-primaria-texto);`
- `:hover` → `background: color-mix(in srgb, var(--cor-primaria) 12%, transparent);`
- `:active` → `transform: translateY(1px);`

### 3.3 Terciário / destrutivo

- Terciário: link/ghost discreto (texto no acento ou em `--texto-secundario`).
- Destrutivo (Sair/Excluir): mesma base do secundário, com texto/realce em vermelho de perigo.

---

## 4. Cards e superfícies

Estilo: **Elevado (Stripe)** — superfície + borda hairline + sombra suave.

- `background: var(--superficie-1);`
- `border: 1px solid var(--borda);`
- `border-radius: 14px;`
- Padding: `18px 20px` (conteúdo); `16px` (compacto).
- Sombra: Escuro `0 2px 8px rgba(0,0,0,.45)`; Claro `0 1px 3px rgba(60,50,30,.07), 0 5px 14px rgba(60,50,30,.05)`.
- Card em destaque: `border: 1px solid color-mix(in srgb, var(--cor-primaria) 35%, var(--borda));` (2px só no "featured").
- Divisores internos: `1px solid var(--borda)`.

---

## 5. Inputs e formulários

Estilo: **Contornado (Stripe)** — só a borda desenha o campo. Rótulo acima. Anel de foco no acento.

### Campo base
- `background: transparent;`
- `border: 1px solid var(--borda);`
- `border-radius: 10px;`
- `height: 44px;` padding `0 14px` (com ícone: `padding-left: 40px`)
- Montserrat 14px, `color: var(--texto-principal)`; `::placeholder { color: var(--texto-terciario); }`

### Rótulo (acima)
- 12px, peso 600, `var(--texto-secundario)`, `margin-bottom: 6px`, associado (`for`/`id`).

### Ícone à esquerda (opcional)
- Phosphor (outline), ~18px, `var(--texto-terciario)`, absoluto a 12px.

### Estados
- **Foco:** `border-color: var(--cor-primaria); box-shadow: 0 0 0 3px color-mix(in srgb, var(--cor-primaria) 28%, transparent);` (no claro ~22–25%). Nunca remover o anel.
- **Erro:** `border-color: var(--perigo); box-shadow: 0 0 0 3px color-mix(in srgb, var(--perigo) 22%, transparent);` + rótulo/mensagem em `--perigo`; mensagem 12px com ícone `warning-circle`, `aria-live`.
- **Desabilitado:** `opacity: .55; cursor: not-allowed;`
- **Hint:** 12px, `var(--texto-terciario)`, abaixo.

### Variantes
- **Select:** chevron (`caret-down`) à direita; `appearance: none`.
- **Senha:** ícone de olho (`eye` / `eye-slash`) à direita.
- **Textarea:** mesma borda/raio; `resize: vertical`.
- **Date / time:** padronizar o input nativo com a mesma borda/raio.
- **Busca:** ícone `magnifying-glass` à esquerda.

### Formulário
- Gap ~16px entre campos. Ações à direita no desktop; primária em largura total na base no mobile.

---

## 6. Números e KPIs do dashboard (padrão Stripe)

Números sempre em Montserrat com `font-variant-numeric: tabular-nums; letter-spacing: -0.02em`.
Arredondar sempre; moeda `toLocaleString('pt-BR')`, percentuais inteiros ou 1 casa.

### Card de métrica (KPI)
- Rótulo: 11px, uppercase, `.06em`, `var(--texto-secundario)`.
- Valor: 22px, peso 700, tabular.
- **Variação (delta):** 12px, peso 600, seta ▲/▼ — alta = verde (`--sucesso`), baixa = vermelho (`--perigo`); comparação em `var(--texto-secundario)`.
- **Sparkline** (opcional): linha 2px na cor da variação, sem eixos.
- Card no estilo Elevado.

### Card de destaque
- Valor grande (32–34px, 700) + delta + comparação.
- **Gráfico de área:** linha 2.5px no acento + preenchimento do acento a ~10% (sólido, sem gradiente). Eixo X discreto.

### Grade
- Até 4 KPIs por linha, gap ~14px.

### Cores de delta por modo
- Verde: escuro `#34D399`, claro `#1A9E6A`. Vermelho: escuro `#F87171`, claro `#C0392B`.

---

## 7. Tabelas e listas (padrão Stripe)

Cabeçalho: título + contagem, busca (input contornado) e ação primária à direita.

### Estrutura
- **`th`:** 11px, uppercase, `.05em`, peso 600, `var(--texto-secundario)`, à esquerda; números à direita.
- **`td`:** padding `12px 18px`, `border-top: 1px solid var(--borda)`, 14px.
- **Hover:** `background: var(--hover)` (dark `#1A1A1A` / light `#FBF4E8`).
- **Pessoa:** avatar/iniciais (36px, raio 9px, fundo acento ~16%, texto no acento) + nome (600) + secundário embaixo.
- **Números/dinheiro:** tabulares, à direita.
- **Status:** badge (seção 8).
- **Ações:** menu `⋯` (`dots-three`) à direita, `var(--texto-terciario)`, realça no hover.

### Recursos
- Ordenação por coluna; paginação/"carregar mais"; estado vazio (ícone+texto+ação); **sem zebra**.

### Responsivo
- Mobile: tabela vira **lista de cards empilhados** (`rótulo: valor`), sem rolagem horizontal.

### Implementação
- Base: **shadcn/ui + TanStack Table**.

---

## 8. Badges / status (estilo Tint)

Pílula com fundo tênue + texto na cor semântica. 12px, peso 600, padding `4px 11px`, `border-radius: 999px`. Ponto (7px) opcional.

### Paleta (texto dark/light — fundo dark/light)
- Verde: `#34D399`/`#1A8F5F` — `rgba(52,211,153,.15)`/`rgba(26,158,106,.12)`
- Âmbar: `#FBBF24`/`#A56A00` — `rgba(251,191,36,.15)`/`rgba(245,158,11,.15)`
- Azul: `#60A5FA`/`#1D6FD6` — `rgba(96,165,250,.15)`/`rgba(29,111,214,.10)`
- Vermelho: `#F87171`/`#C0392B` — `rgba(248,113,113,.15)`/`rgba(192,57,43,.10)`
- Cinza: `#A3A3A3`/`#6E675C` — `rgba(255,255,255,.07)`/`rgba(0,0,0,.05)`

### Mapeamento
- Agendamento: Confirmado=verde · Aguardando=âmbar · Em andamento=azul · Concluído=cinza · Cancelado=vermelho.
- Cliente: Ativo=verde · Novo=âmbar · Inativo=cinza.
- Comissão: Pago=verde · Pendente=âmbar. Agenda: Folga=cinza · Bloqueio=vermelho.

---

## 9. Navegação

Duas formas: sidebar (admin, desktop) e tab bar inferior (apps mobile).

### Sidebar (admin) — Linear/Stripe
- Largura ~236px; `background: var(--superficie-1)`; `border-right: 1px solid var(--borda)`.
- Marca no topo; itens agrupados (rótulo 10px uppercase `var(--texto-terciario)`): Principal · Financeiro · Gestão; Configurações embaixo.
- Item: ícone outline (19px) + rótulo (14px); padding `9px 10px`, raio 9px.
  - Hover: `background: var(--hover)`; texto `var(--texto-principal)`.
  - Ativo: `background: color-mix(in srgb, var(--cor-primaria) 15%, transparent)`; texto `var(--cor-primaria-texto)`; peso 600.
- Rodapé: avatar + nome + papel + logout. Responsivo: colapsa em drawer (hambúrguer) no mobile.

### Tab bar (mobile) — iOS
- Fixa na base; `background: var(--superficie-1)`; `border-top: 1px solid var(--borda)`; safe-area.
- 4 abas: ícone Phosphor (22px) + rótulo (11px). Ativa: ícone preenchido (`ph-fill`), `var(--cor-primaria-texto)`, peso 600; inativa: outline (`ph`), `var(--texto-secundario)`. Toque ≥ 44px.
- Barbeiro: Hoje · Agenda · Comissões · Perfil. Cliente: Início · Agendar · Fidelidade · Perfil.

---

## 10. Agenda (modelo calendário — Google Calendar / Cal.com)

Admin (desktop) = dia com colunas por barbeiro; app do barbeiro (mobile) = coluna única.

### Cabeçalho
- Título + navegação de data (‹ ›, "Hoje") + toggle Dia/Semana + primário "+ Novo agendamento".

### Grade
- Régua de horas à esquerda (~54px), limitada ao horário de trabalho do perfil; rótulos 11px `var(--texto-terciario)`. Linhas de hora sutis; altura da hora ~48px. Colunas por barbeiro com header (avatar+nome+contagem).

### Blocos
- `top = (início − abertura) × alturaHora`; `height = duração`.
- Fundo = tint da cor do status (verde/azul/âmbar) + barra de 3px da cor à esquerda. Nome (bold) + `serviço · horário`, truncado. Hover: brilho; clique: detalhes.
- Bloqueio/folga: bloco hachurado em cinza.

### Linha do "agora"
- Linha 2px no acento com ponto à esquerda, na hora atual.

### Interações
- Clicar em espaço livre → novo agendamento; clicar em bloco → detalhes/editar.

### Responsivo
- Mobile (barbeiro): coluna única. Admin em telas menores: rolagem horizontal ou seletor de barbeiro.
