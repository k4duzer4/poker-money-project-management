# ♠️ Chipz

<p align="center">
  <b>Gestão moderna para mesas de poker cash game</b><br/>
  Controle de autenticação, mesas e base financeira em uma arquitetura fullstack TypeScript.
</p>

<p align="center">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white" />
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" />
  <img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white" />
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white" />
</p>

---

## ✨ Visão geral

O **Chipz** é uma plataforma web para organizar mesas de poker cash game, com foco em clareza financeira, autenticação segura e base pronta para evolução do domínio.

### ✅ O que o projeto já entrega

- 🔐 Cadastro, login e sessão com JWT
- 🧩 Backend modular por contexto (`auth`, `tables`, `players`, `transactions`)
- 🗃️ Persistência relacional com Prisma + PostgreSQL
- 📱 Frontend React responsivo para operação rápida

> ℹ️ Os módulos de **players** e **transactions** já possuem contrato e namespace definidos e estão preparados para expansão funcional.

---

## 🧱 Stack técnica

| Camada | Tecnologias |
|---|---|
| Backend | Node.js, Fastify, TypeScript, Prisma, Zod, JWT, bcrypt |
| Banco de dados | PostgreSQL (Supabase) |
| Frontend | React 19, TypeScript, Vite, React Router, Bootstrap |

---

## 🏗️ Arquitetura e engenharia

### 🔭 Visão de arquitetura

O repositório é dividido em duas aplicações principais:

- `backend`: API HTTP, regras de domínio e acesso a dados
- `frontend`: SPA responsável pela interface do usuário

Fluxo principal:

1. 👤 Usuário autentica no frontend
2. 🌐 Frontend consome API REST no backend
3. 🛡️ Backend valida JWT nas rotas protegidas
4. 🗄️ Backend persiste e consulta dados no PostgreSQL via Prisma

### 🧠 Princípios aplicados

- **Modularidade por domínio**: rotas separadas por contexto (`auth`, `tables`, `players`, `transactions`)
- **Validação na borda**: payloads e variáveis de ambiente validados com Zod
- **Configuração centralizada**: parsing e normalização de env em um único módulo
- **Segurança de credenciais**: hash de senha (`bcrypt`) + autenticação stateless com JWT
- **Escalabilidade de dados**: schema relacional com índices e enums de domínio

### 🗂️ Modelo de dados (resumo)

**Entidades principais**

- `User`
- `Table`
- `TablePlayer`
- `Transaction`

**Enums de domínio**

- `TableStatus` → `OPEN`, `CLOSED`
- `PlayerStatus` → `ACTIVE`, `LEFT`
- `TxType` → `BUY_IN`, `REBUY`, `CASH_OUT`, `ADJUSTMENT`

---

## 📁 Estrutura de pastas (alto nível)

```text
.
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  └─ src/
│     ├─ config/
│     ├─ db/
│     ├─ modules/
│     │  ├─ auth/
│     │  ├─ tables/
│     │  ├─ players/
│     │  └─ transactions/
│     └─ shared/
└─ frontend/
   └─ src/
      ├─ pages/
      ├─ services/
      ├─ store/
      └─ styles/
```

---

## 🚀 Como executar localmente

### 1) Pré-requisitos

- Node.js 20+
- npm 10+
- PostgreSQL (recomendado: Supabase)

Verificação rápida:

```bash
node -v
npm -v
```

### 2) Clonar e acessar

```bash
git clone <URL_DO_REPOSITORIO>
cd poker-cash
```

### 3) Configurar banco no Supabase

1. Crie um projeto no Supabase.
2. Copie a connection string PostgreSQL (direct connection, porta 5432).
3. Garanta `?sslmode=require` ao final da URL.

Exemplo:

```text
postgresql://postgres:SUA_SENHA@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
```

### 4) Configurar variáveis de ambiente

#### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
JWT_SECRET=troque-por-um-segredo-forte
PORT=3333
CORS_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@chipz.local
ADMIN_PASSWORD=troque-por-uma-senha-forte
```

#### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3333
VITE_APP_NAME=Chipz
VITE_DEMO_AUTH=false
```

### 5) Instalar dependências

```bash
cd backend
npm install
cd ../frontend
npm install
```

### 6) Preparar banco (migrations)

No diretório `backend`:

```bash
npx prisma generate
npx prisma migrate deploy
```

Opcional (inspeção visual):

```bash
npx prisma studio
```

### 7) Subir backend

```bash
cd backend
npm run dev
```

Backend em `http://localhost:3333`.

Health-check:

- `GET /` → `{ "message": "hello world" }`

### 8) Subir frontend

Em outro terminal:

```bash
cd frontend
npm run dev
```

Frontend em `http://localhost:5173`.

### 9) Fluxo rápido de validação

1. Acesse `http://localhost:5173`
2. Crie uma conta
3. Faça login
4. Verifique geração/persistência do token
5. Crie uma mesa e valide o retorno da API

---

## 🔌 API atual (resumo)

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (protegida por Bearer token)

### Tables

- `GET /tables` (protegida)
- `POST /tables` (protegida)

### Players & Transactions

- Rotas base presentes (`/players`, `/transactions`) para evolução incremental do domínio

---

## 🛠️ Scripts úteis

### Backend

```bash
npm run dev
npm run build
npm run start
```

### Frontend

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

---

## 🧯 Troubleshooting

- **Erro de conexão com banco** → revise `DATABASE_URL`, credenciais e `sslmode=require`
- **Erro de CORS** → confira `CORS_ORIGIN` no backend e URL do frontend
- **Porta ocupada** → altere `PORT` e ajuste `VITE_API_URL`
- **Falha em migration** → execute novamente `npx prisma generate` e `npx prisma migrate deploy`

---

## 🧭 Roadmap técnico sugerido

- [ ] Implementar regras completas de `players` e `transactions`
- [ ] Adicionar testes automatizados (unitários + integração)
- [ ] Criar pipeline CI (lint, build, testes e migrações)
- [ ] Versionar contrato da API (OpenAPI/Swagger)

---

<p align="center">
  Feito com ♠️ por quem curte produto, engenharia e poker.
</p>
