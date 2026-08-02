# Valen Barber — Design System (DESIGN_SYSTEM.md)

> Documento vivo. É a **fonte de verdade** de aparência do sistema em conjunto com `frontend/src/styles/tokens.css`. O agente do Antigravity deve seguir este arquivo ao implementar UI. Vamos construindo componente por componente; nada é aplicado no código sem estar aqui e aprovado pelo Wellinton.

## Princípios

- Aparência **profissional e elegante**: espaçamento consistente, uma cor de acento (Clay) usada com parcimônia, números alinhados, hierarquia clara, cantos e sombras coerentes.
- Referências que guiam o estilo: **Stripe** (números e botões), **Raycast/Linear** (UI limpa), **Cal.com/Google Calendar** (agenda). Adaptar a linguagem deles à nossa identidade — nossas cores e nossa fonte.

## Regra de tematização (obrigatória)

O acento é **temático por barbearia**. Nunca hardcode a cor nos componentes — use sempre as variáveis CSS de tema (ex.: `--cor-primaria`). O padrão do sistema é Ivory (tema claro), mas cada admin pode configurar preferências. Só os **valores padrão** das variáveis ficam definidos em `tokens.css`.

---

## 1. Tipografia

A tipografia do Valen Barber é composta pelas seguintes fontes:
- **UI Geral**: `Inter Tight`, -apple-system, "Segoe UI", Arial, sans-serif.
- **Serifa (leitura e destaques)**: `Newsreader`, Georgia, "Times New Roman", serif.
- **Números, dinheiro e horários**: `JetBrains Mono`, ui-monospace, "SF Mono", Menlo, monospace. (Sempre com `font-variant-numeric: tabular-nums`).

### Regras Tipográficas Críticas
- **Tamanho mínimo de fonte no sistema**: `0.8125rem` (`13px`). É terminantemente proibido utilizar tamanhos de fonte inferiores a 13px em qualquer elemento da interface.
- **Proibido uppercase**: É **proibido usar `text-transform: uppercase`** em qualquer texto do sistema, inclusive em micro-rótulos ou badges.
- Hierarquia fluida (`clamp`):
  - Display: `clamp(2.5rem, 1.9rem + 2.6vw, 3.9rem)` (`--texto-display`)
  - Título de tela (h1): `clamp(1.75rem, 1.6rem + 0.7vw, 2.25rem)` (`--texto-h1`)
  - Subtítulo/seção (h2): `1.5rem` (`--texto-h2`)
  - Título menor (h3): `1.25rem` (`--texto-h3`)
  - Título compacto (h4): `1.0625rem` (`--texto-h4`)
  - Corpo / UI: `1rem` (`--texto-corpo`) ou `1.125rem` (`--texto-corpo-lg`)
  - Rótulos e detalhes: `0.875rem` (`--texto-label`) e no mínimo `0.8125rem` (`--texto-detalhe` / `--texto-sm`).

### Ícones

- Conjunto **único** no sistema: **Lucide React**, variante **outline**, com `strokeWidth={1.75}`.
- Tamanho: 18–20px inline; 22–24px em barras de navegação.
- Mesmo ícone para a mesma seção em todo o sistema. A cor herda do contexto via `currentColor` ou variáveis de texto/ícone (nunca hardcodar cores hexadecimais no ícone).
- Decorativo: `aria-hidden`; ícone sem texto: `aria-label`.

---

## 2. Cores e tokens

O sistema consome os valores definidos em `frontend/src/styles/tokens.css`. A paleta primitiva baseia-se nos tons **Ivory, Slate e Clay**.

### 2.1 Paleta Primitiva (Anthropic) — `--swatch-*`
Nunca use estas variáveis diretamente nos componentes; utilize sempre os tokens semânticos de tema (`--fundo-*`, `--texto-*`, `--cor-primaria`, etc.).

- **Ivory (superfícies claras)**:
  - `--swatch-ivory-light`: `#faf9f5`
  - `--swatch-ivory-medium`: `#f0eee6`
  - `--swatch-ivory-dark`: `#e8e6dc`
  - `--swatch-oat`: `#e3dacc`
- **Slate (textos e superfícies escuras)**:
  - `--swatch-slate-dark`: `#141413`
  - `--swatch-slate-medium`: `#3d3d3a`
  - `--swatch-slate-light`: `#5e5d59`
  - `--swatch-slate-faded-10`: `#1414131a`
  - `--swatch-slate-faded-20`: `#14141333`
- **Cloud (desabilitados e placeholders)**:
  - `--swatch-cloud-dark`: `#87867f`
  - `--swatch-cloud-medium`: `#b0aea5`
  - `--swatch-cloud-light`: `#d1cfc5`
- **Acento e sinalização**:
  - `--swatch-clay`: `#d97757`
  - `--swatch-accent`: `#c6613f`
  - `--swatch-kraft`: `#d4a27f`
  - `--swatch-olive`: `#788c5d`
  - `--swatch-sky`: `#6a9bcc`
  - `--swatch-manilla`: `#ebdbbc`
  - `--swatch-fig`: `#c46686`
  - `--swatch-coral`: `#ebcece`
  - `--swatch-cactus`: `#bcd1ca`
  - `--swatch-heather`: `#cbcadb`

### 2.2 Temas do Sistema

- **Tema Padrão do Sistema: Claro (Ivory)**
  - O tema claro (Ivory) é o **padrão oficial** e ativo da aplicação.
  - `--fundo-pagina`: `#faf9f5`
  - `--fundo-superficie`: `#f0eee6`
  - `--fundo-superficie-2`: `#e8e6dc`
  - `--fundo-superficie-3`: `#e3dacc`
  - `--fundo-inverso`: `#141413`
  - `--texto-principal`: `#141413`
  - `--texto-secundario`: `#5e5d59`
  - `--texto-terciario`: `#87867f`
  - `--cor-primaria`: `#d97757` (Clay)
  - `--cor-primaria-hover`: `#c6613f`
  - `--cor-primaria-ativa`: `#b0552f`

- **Tema Escuro (Slate) — Estruturado, mas NÃO liberado ao usuário final**
  - O tema escuro está estruturado na arquitetura de CSS (`[data-tema="escuro"]`), porém **não está liberado para seleção do usuário final**.
  - `--fundo-pagina`: `#141413`
  - `--fundo-superficie`: `#1f1f1d`
  - `--fundo-superficie-2`: `#2a2a27`
  - `--fundo-superficie-3`: `#3d3d3a`
  - `--fundo-inverso`: `#faf9f5`
  - `--texto-principal`: `#faf9f5`
  - `--texto-secundario`: `#d1cfc5`
  - `--cor-primaria`: `#d97757`

### 2.3 Regra de Contraste e Texto Sobre Primária
- **Nunca use texto branco sobre a cor primária (`--cor-primaria: #d97757`)!**
- O texto sobre `--cor-primaria` (`--texto-sobre-primaria`) DEVE SER `#141413` (Slate Dark).
- Motivo: A combinação de `#141413` sobre `#d97757` resulta em uma razão de contraste de **5.90:1** (aprovado em WCAG AA), enquanto branco sobre `#d97757` resulta em apenas **3.12:1** (reprovado).

### 2.4 Cores Semânticas (Sinalização)
- Sucesso: `#4c593b` sobre fundo `#bcd1ca` (claro) | `#a8c48a` sobre `#2b3a2a` (escuro)
- Info: `#476788` sobre fundo `#dbe7f2` (claro) | `#8fb8dd` sobre `#23323f` (escuro)
- Aviso: `#755c1e` sobre fundo `#ebdbbc` (claro) | `#e0c68f` sobre `#3a3122` (escuro)
- Erro: `#87465c` sobre fundo `#ebcece` (claro) | `#e08fa5` sobre `#3d2229` (escuro)

---

## 3. Botões

- Base: Fonte `Inter Tight`, peso 600, tamanho mínimo de `0.8125rem` (13px) ou 14px.
- Altura mínima: **40px** (`--alvo-desktop`) ou **48px** (`--alvo-mobile`).
- **Botão Primário**:
  - `background: var(--cor-primaria);`
  - `color: var(--texto-sobre-primaria);` (Sempre `#141413`, NUNCA branco).
  - Hover: `background: var(--cor-primaria-hover);`
- **Botão Secundário**:
  - `background: transparent;`
  - `border: 1px solid var(--borda-input);`
  - `color: var(--texto-principal);`
  - Hover: `background: var(--hover);`
- Ícones opcionais à esquerda do texto com `strokeWidth={1.75}` (Lucide React).

---

## 4. Cards e superfícies

- `background: var(--fundo-superficie);`
- `border: 1px solid var(--borda-sutil);`
- `border-radius: var(--raio-xl);` (16px) ou `var(--raio-lg);` (12px).
- Padding: `1.5rem` (24px) no desktop, `1rem` (16px) no mobile.
- Sombra: `var(--elevacao-1)`, `var(--elevacao-2)` ou `var(--elevacao-3)`.

---

## 5. Inputs e formulários

- `background: var(--fundo-superficie-2);`
- `border: 1px solid var(--borda-forte);`
- `border-radius: var(--raio-md);`
- `height: 44px;` padding `0 14px`.
- Rótulo acima: fonte `Inter Tight`, peso 500/600, `0.875rem` ou mínimo `0.8125rem` (`13px`), cor `var(--texto-secundario)`. (Sem uppercase).
- Foco: `border-color: var(--borda-foco);`

---

## 6. Números e KPIs do dashboard

- Números, moedas, horários e percentuais **sempre em JetBrains Mono** com `font-variant-numeric: tabular-nums;`.
- Rótulo: 13px mínimo (`0.8125rem`), `var(--texto-secundario)`. **Sem uppercase.**
- Valor: 24px a 32px, peso 700.
- Variação (delta): cor semântica de sucesso ou erro.

---

## 7. Tabelas e listas

- Cabeçalho de coluna (`th`): `0.8125rem` (13px), peso 600, `var(--texto-secundario)`. **Sem uppercase.**
- Linhas (`td`): padding `12px 18px`, `border-top: 1px solid var(--borda-sutil)`.
- Números e moedas em coluna tabular à direita com `JetBrains Mono`.
- Ações: ícone Lucide React (`MoreHorizontal` ou `MoreVertical`) em `var(--texto-terciario)`.

---

## 8. Badges / status

- Pílula com fundo semântico (`--*-fundo`) e texto na cor correspondente (`--sucesso`, `--aviso`, `--erro`, `--info`).
- Tamanho de fonte: mínimo `0.8125rem` (13px), peso 600, padding `4px 10px`, raio `var(--raio-full)`.
- **Proibido uppercase** no texto do badge.

---

## 9. Navegação

- **Sidebar (desktop)**: `background: var(--fundo-superficie); border-right: 1px solid var(--borda-sutil);`. Itens com ícones Lucide React (`strokeWidth={1.75}`).
- **Tab bar (mobile)**: Fixa na base, `background: var(--fundo-superficie); border-top: 1px solid var(--borda-sutil);`. Altura de toque mínima de `48px`.

---

## 10. Agenda

- Régua de horários e blocos de tempo utilizam a fonte `JetBrains Mono` para precisão na exibição de horas e minutos.
- Status do agendamento reflete a paleta semântica de sinalização (sucesso, aviso, info, erro ou neutro cloud).

## Selects e Opções (Dropdowns)

**Regra Crítica para <option>:** NUNCA aplique as propriedades ackground-color ou color nas tags <option>. Deixe que o navegador renderize as opções nativamente. Como o sistema utiliza color-scheme via CSS (em 	okens.css), o sistema operacional automaticamente adaptará o fundo e o texto do menu suspenso para o modo claro ou escuro garantindo o contraste perfeito e acessibilidade (evitando texto branco em fundo branco).