# Auditoria de Cores e Tematização — Valen Barber

Este documento apresenta o levantamento completo de cores literais, classes fixas do Tailwind, arquitetura do sistema de temas e carregamento de tipografia no repositório do Valen Barber, conforme solicitado antes de qualquer alteração de código na refatoração visual para o Design System v2.

---

## 1. Arquivos em `src/` com cor hex literal

Busca realizada com a expressão regular `#[0-9a-fA-F]{3,8}` nos diretórios `src/` (excluindo `node_modules`, `dist` e `.git`).
Foram encontrados **38 arquivos** contendo cores literais hexadecimais:

| Arquivo | Ocorrências |
| :--- | :---: |
| `frontend/src/pages/RecuperarSenha.tsx` | 53 |
| `frontend/src/pages/admin/Fidelidade.tsx` | 46 |
| `frontend/src/pages/admin/AdminPrimeiroAcesso.tsx` | 43 |
| `frontend/src/index.css` | 42 |
| `frontend/src/pages/cliente/ClienteLoginPrincipal.tsx` | 37 |
| `frontend/src/pages/admin/AdminLogin.tsx` | 35 |
| `frontend/src/pages/VerificarEmail.tsx` | 32 |
| `frontend/src/pages/cliente/ClienteRegister.tsx` | 29 |
| `backend/src/services/email.service.ts` | 26 |
| `frontend/src/pages/cliente/ClienteCadastro.tsx` | 19 |
| `frontend/src/pages/barbeiro/BarbeiroLogin.tsx` | 18 |
| `frontend/src/pages/cliente/ClienteLogin.tsx` | 18 |
| `frontend/src/pages/Agenda.tsx` | 15 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaFidelidade.tsx` | 11 |
| `frontend/src/pages/cliente/ClienteHome.tsx` | 10 |
| `frontend/src/pages/cliente/ClienteWelcome.tsx` | 10 |
| `frontend/src/pages/Barbeiros.tsx` | 8 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaPerfil.tsx` | 7 |
| `frontend/src/pages/Configuracoes.tsx` | 6 |
| `frontend/src/pages/Servicos.tsx` | 6 |
| `frontend/src/pages/Vendas.tsx` | 5 |
| `backend/src/services/cliente.service.ts` | 4 |
| `frontend/src/components/QrCodeScanner.tsx` | 4 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaAgendar.tsx` | 4 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaChat.tsx` | 3 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaInicio.tsx` | 3 |
| `frontend/src/components/BarbeiroAnimation.tsx` | 2 |
| `frontend/src/pages/Login.tsx` | 2 |
| `frontend/src/pages/admin/AdminChat.tsx` | 2 |
| `frontend/src/pages/barbeiro/BarbeiroAgenda.tsx` | 2 |
| `frontend/src/utils/cores.ts` | 2 |
| `backend/src/services/barbeiro.service.ts` | 1 |
| `backend/src/services/servico.service.ts` | 1 |
| `frontend/src/components/AprovacoesPopup.tsx` | 1 |
| `frontend/src/components/ImageCropperModal.tsx` | 1 |
| `frontend/src/layouts/ClienteLayout.tsx` | 1 |
| `frontend/src/pages/barbeiro/BarbeiroPerfil.tsx` | 1 |
| `frontend/src/pages/publico/Agendar.tsx` | 1 |

---

## 2. Arquivos com classes de cor fixas do Tailwind

Busca realizada com a expressão regular `(bg|text|border|ring|from|to|via)-(slate|gray|zinc|neutral|stone|amber|yellow|orange|red|green|emerald|blue|sky|indigo|violet|purple|pink)-\d{2,3}`.
Foram encontrados **19 arquivos** utilizando classes fixas de paleta de cores:

| Arquivo | Ocorrências |
| :--- | :---: |
| `frontend/src/pages/Configuracoes.tsx` | 27 |
| `frontend/src/components/admin/FidelidadeConfig.tsx` | 25 |
| `frontend/src/pages/barbeiro/BarbeiroHoje.tsx` | 13 |
| `frontend/src/pages/tenant/RegisterClient.tsx` | 12 |
| `frontend/src/layouts/ClientLayout.tsx` | 9 |
| `frontend/src/pages/tenant/LoginClient.tsx` | 8 |
| `frontend/src/pages/barbeiro/BarbeiroPerfil.tsx` | 7 |
| `frontend/src/pages/barbeiro/BarbeiroAgenda.tsx` | 6 |
| `frontend/src/pages/tenant/Welcome.tsx` | 6 |
| `frontend/src/pages/tenant/app/Historico.tsx` | 6 |
| `frontend/src/pages/tenant/app/Inicio.tsx` | 6 |
| `frontend/src/pages/Agenda.tsx` | 5 |
| `frontend/src/pages/barbeiro/BarbeiroHorariosCard.tsx` | 5 |
| `frontend/src/pages/tenant/app/FidelidadeTenant.tsx` | 5 |
| `frontend/src/pages/tenant/app/AgendarTenant.tsx` | 4 |
| `frontend/src/pages/tenant/app/Perfil.tsx` | 4 |
| `frontend/src/pages/Barbeiros.tsx` | 2 |
| `frontend/src/pages/admin/AdminChat.tsx` | 1 |
| `frontend/src/pages/cliente/barbearia/ClienteBarbeariaChat.tsx` | 1 |

---

## 3. Sistema de Temas por Barbearia

### Onde está definido hoje
1. **Valores Padrão e Estrutura CSS (`frontend/src/index.css`)**:
   - As variáveis CSS de tema (como `--fundo-pagina`, `--superficie-1`, `--texto-principal`, `--cor-primaria`, etc.) estão declaradas na raiz (`:root`) para o **Modo Escuro (padrão)** e em `:root.light` para o **Modo Claro**.
   - A alternância entre escuro e claro é feita pelo componente `ToggleModo.tsx` através da adição/remoção da classe `.light` em `document.documentElement`.

2. **Injeção Dinâmica de Tema (`frontend/src/hooks/useTema.ts`)**:
   - É o único local responsável por aplicar as personalizações da barbearia em tempo de execução através da função `aplicarTema`.
   - **Comportamento atual:** o hook lê a cor do backend e aplica via `document.documentElement.style.setProperty`:
     - `--cor-primaria` (recebe `tema.corPrimaria`)
     - `--amber` (alias que recebe `tema.corPrimaria`)
     - `--cor-primaria-rgb` (cálculo dos valores RGB a partir do hex)
     - `--cor-icone` (cor calculada para contraste pelo helper `gerarCorIcone`)
   - **Nota importante:** Atualmente, as variáveis `--fundo-pagina` e `--texto-principal` **não são injetadas dinamicamente via JS** por barbearia; elas usam exclusivamente os valores globais definidos em `index.css` de acordo com o modo claro/escuro ativo.

### Shape exato do objeto de tema que vem do backend

No banco de dados (`backend/prisma/schema.prisma`), o modelo `Barbearia` possui as colunas de identidade visual:
```prisma
corPrimaria   String? @default("#FF8C00") // Laranja
corSecundaria String? @default("#1A1A1A") // Escuro
corTexto      String? @default("#FFFFFF") // Branco
fonte         String? @default("Inter")
fonteCorpo    String? @default("Inter")
fonteNumeros  String? @default("DM Mono")
```

Na API, o shape varia dependendo da rota de consulta:

#### 1. Rota Pública do Tenant (`GET /b/:slug/identidade`)
Controlada pelo `TenantController.getIdentidade` (`backend/src/controllers/tenantController.ts`), o shape exato do JSON retornado é:
```json
{
  "nome": "string",
  "logo": "string | null",
  "corPrimaria": "string | null",
  "corSecundaria": "string | null",
  "corTexto": "string | null",
  "fonte": "string | null"
}
```

#### 2. Rota Administrativa (`GET /configuracoes/minha-barbearia`)
Controlada pelo `ConfiguracaoController.getMinhaBarbearia` (`backend/src/controllers/configuracao.controller.ts`), o shape exato retornado inclui todas as colunas do modelo `Barbearia` combinadas à contagem de clientes:
```json
{
  "id": "string",
  "nome": "string",
  "slug": "string",
  "telefone": "string | null",
  "endereco": "string | null",
  "logo": "string | null",
  "corPrimaria": "string | null",
  "corSecundaria": "string | null",
  "corTexto": "string | null",
  "fonte": "string | null",
  "fonteCorpo": "string | null",
  "fonteNumeros": "string | null",
  "horarioAbertura": "string | null",
  "horarioFechamento": "string | null",
  "temAlmoco": "boolean",
  "horarioAlmocoInicio": "string | null",
  "horarioAlmocoFim": "string | null",
  "diasFuncionamento": ["string"],
  "ativo": "boolean",
  "createdAt": "string (ISO Date)",
  "clientesCount": "number"
}
```

---

## 4. Carregamento de Fontes

Atualmente, o carregamento das fontes está centralizado no HTML e nas regras CSS:

1. **Carregamento via `index.html` (`frontend/index.html`)**:
   - A fonte principal **Montserrat** é carregada externamente diretamente do Google Fonts através de tags `<link>` no cabeçalho do documento (pesos 400, 500, 600 e 700):
     ```html
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
     <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
     ```
   - **Não existe** uso de `@fontsource` nas dependências do projeto (`package.json`) nem carregamento via `@import` no CSS.

2. **Definição dos Tokens no CSS (`frontend/src/index.css`)**:
   - As variáveis globais de tipografia apontam para `Montserrat`:
     ```css
     --fonte-interface: 'Montserrat', system-ui, sans-serif;
     --fonte-numeros:   'Montserrat', system-ui, sans-serif;
     ```
