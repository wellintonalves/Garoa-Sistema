# 💈 Sistema de Gestão para Barbearia

Sistema completo de gestão para barbearia brasileira. Roda 100% na nuvem — sem dependência de computador local.

## 🏗️ Stack Tecnológica

| Camada | Tecnologia | Hospedagem |
|--------|-----------|------------|
| **Backend** | Node.js + Express + TypeScript | Railway (~US$5/mês) |
| **Banco de dados** | PostgreSQL + Prisma ORM | Supabase (gratuito) |
| **Frontend** | React + TypeScript + Tailwind CSS | Vercel (gratuito) |
| **Autenticação** | JWT + bcrypt | — |

---

## 📋 Passo a Passo para Colocar no Ar

### 1. Criar o Banco de Dados no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (pode usar GitHub)
2. Clique em **"New Project"**
3. Escolha um nome (ex: `barbearia`), defina uma **senha forte** e escolha a região **South America (São Paulo)**
4. Aguarde a criação (1-2 minutos)
5. Vá em **Settings → Database → Connection string → URI**
6. Copie a string. Ela será algo assim:
   ```
   postgresql://postgres.[ref]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
   ```
7. Substitua `[SENHA]` pela senha que você definiu no passo 3

✅ **Guarde essa URL. Ela é a sua `DATABASE_URL`.**

---

### 2. Deploy do Backend no Railway

1. Acesse [railway.app](https://railway.app) e crie uma conta (pode usar GitHub)
2. Suba este projeto para um repositório no GitHub
3. No Railway, clique em **"New Project" → "Deploy from GitHub repo"**
4. Selecione o repositório e escolha a pasta **`/backend`** como root directory
5. Vá em **Settings → Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | A URL do Supabase (passo 1) |
| `JWT_SECRET` | Uma string aleatória longa (ex: `minha-chave-secreta-super-segura-2024`) |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | *(preencha depois do deploy da Vercel)* |
| `BARBEARIA_NOME` | O nome da sua barbearia |

6. O Railway vai fazer o build automaticamente
7. Após o deploy, copie a **URL pública** do serviço (algo como `https://barbearia-backend-production.up.railway.app`)

✅ **Guarde essa URL. Ela é o seu backend.**

---

### 3. Deploy do Frontend na Vercel

1. Acesse [vercel.com](https://vercel.com) e crie uma conta (pode usar GitHub)
2. Clique em **"Add New" → "Project"**
3. Importe o mesmo repositório do GitHub
4. Em **Root Directory**, coloque `frontend`
5. Em **Environment Variables**, adicione:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | A URL do backend no Railway (passo 2) |
| `VITE_BARBEARIA_NOME` | O nome da sua barbearia |

6. Clique em **Deploy**
7. Após concluir, copie a **URL da Vercel** (ex: `https://barbearia-frontend.vercel.app`)

✅ **Agora volte no Railway e atualize a variável `FRONTEND_URL` com essa URL.**

---

### 4. Popular o Banco de Dados (Seed)

Você precisa rodar o seed **uma vez** para criar os dados iniciais. Existem duas formas:

**Opção A — Pelo Railway (recomendado):**
1. No Railway, vá na aba do seu serviço
2. Abra o **Shell** (terminal)
3. Execute: `npx prisma db seed`

**Opção B — Do seu computador (precisa de Node.js instalado):**
1. Clone o repositório
2. Na pasta `backend`, crie um arquivo `.env` com a `DATABASE_URL` do Supabase
3. Execute:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npx prisma db seed
   ```

---

### 5. Primeiro Acesso

1. Abra a URL da Vercel no navegador
2. Faça login com:
   - **Email:** `admin@barbearia.com`
   - **Senha:** `Admin123!`
3. Pronto! Você terá acesso ao painel completo.

---

## 🖥️ Rodando Localmente (Desenvolvimento)

Se quiser rodar no computador para fazer alterações:

```bash
# 1. Clone o repositório
git clone [URL_DO_REPO]
cd garoa-sistema

# 2. Copie os arquivos de ambiente
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Edite backend/.env com a DATABASE_URL do Supabase

# 4. Instale as dependências
npm install

# 5. Gere o client Prisma e rode as migrations
cd backend
npx prisma generate
npx prisma migrate dev
npx prisma db seed
cd ..

# 6. Rode tudo com um comando
npm run dev
```

O backend roda em `http://localhost:3001` e o frontend em `http://localhost:5173`.

---

## 📊 Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `DATABASE_URL` | ✅ | Connection string do PostgreSQL (Supabase) |
| `JWT_SECRET` | ✅ | Chave secreta para gerar tokens JWT |
| `JWT_EXPIRES_IN` | ❌ | Tempo de expiração do token (padrão: `7d`) |
| `PORT` | ❌ | Porta do servidor (padrão: `3001`) |
| `NODE_ENV` | ❌ | Ambiente: `development` ou `production` |
| `FRONTEND_URL` | ✅ | URL do frontend para configurar CORS |
| `BARBEARIA_NOME` | ❌ | Nome da barbearia |

### Frontend (`frontend/.env`)

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `VITE_API_URL` | ✅ | URL base da API do backend |
| `VITE_BARBEARIA_NOME` | ❌ | Nome exibido na tela de login |

---

## 🗃️ Estrutura do Projeto

```
├── backend/
│   ├── prisma/          # Schema e migrations
│   ├── src/
│   │   ├── config/      # Configurações (auth)
│   │   ├── controllers/ # Controladores das rotas
│   │   ├── lib/         # PrismaClient singleton
│   │   ├── middlewares/  # Auth, role, error
│   │   ├── routes/      # Definição de rotas
│   │   ├── services/    # Lógica de negócio
│   │   └── types/       # Tipos TypeScript
│   └── railway.toml     # Config de deploy
│
├── frontend/
│   ├── src/
│   │   ├── api/         # Cliente HTTP (Axios)
│   │   ├── components/  # Componentes reutilizáveis
│   │   ├── contexts/    # Context de autenticação
│   │   ├── hooks/       # Hooks customizados
│   │   ├── layouts/     # Layout com sidebar
│   │   └── pages/       # Páginas da aplicação
│   └── vercel.json      # Config de deploy
│
└── package.json         # Root do monorepo
```

---

## 👤 Dados Iniciais (Seed)

| Tipo | Dados |
|------|-------|
| **Admin** | admin@barbearia.com / Admin123! |
| **Barbeiros** | Carlos Silva, Rafael Santos, Lucas Oliveira |
| **Serviços** | Corte (R$45), Barba (R$35), Combo (R$70), Hidratação (R$50), Pigmentação (R$80), Sobrancelha (R$25), Infantil (R$35), Platinado (R$120) |
| **Clientes** | 5 clientes com telefone |
| **Agendamentos** | 10 distribuídos na semana |
| **Financeiro** | 5 lançamentos de exemplo |
| **Estoque** | 6 produtos com alertas de baixo estoque |
