# Chipz

Plataforma fullstack para gestao de mesas de poker cash game, com foco em operacao rapida, clareza financeira e UX moderna.

## O que esta atualizado nesta versao

- Frontend com layout moderno (sidebar com icones, cards, estados vazios e tema dark consistente)
- Loading states com skeletons nas telas principais
- Toasts globais com `react-toastify`
- Fluxo completo de mesa/jogadores:
  - criar mesa
  - adicionar jogador com buy-in inicial
  - rebuy
  - cash out (incluindo cash out zero)
  - encerrar e reabrir mesa
- Ranking por jogador atualizado durante cash out
- API documentada via Swagger (`/docs`)

## Stack

### Backend
- Node.js + Fastify
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod (validacao)
- JWT + bcrypt

### Frontend
- React 19 + TypeScript
- Vite
- React Router
- Zustand
- Bootstrap
- Lucide React
- React Toastify

## Estrutura

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
      ├─ components/
      ├─ layouts/
      ├─ pages/
      ├─ services/
      ├─ stores/
      ├─ styles/
      └─ types/
```

## Modelo de dados (resumo)

Entidades principais:
- `User`
- `Table`
- `TablePlayer`
- `Transaction`
- `Ranking`

Enums:
- `TableStatus`: `OPEN`, `CLOSED`
- `PlayerStatus`: `ACTIVE`, `CASHOUT`
- `TxType`: `BUY_IN`, `REBUY`, `CASH_OUT`, `ADJUSTMENT`

## Regras de dominio atuais

- Mesa so aceita entrada/rebuy/cash out quando `OPEN`
- Buy-in inicial respeita minimo da mesa
- Rebuy depende de `permitirRebuy`
- Cash out aceita valor `0`
- Encerramento de mesa depende apenas de nao haver jogadores ativos
- Ajuste proporcional esta legado/obsoleto no fluxo atual de UI

## API (estado atual)

### Health
- `GET /health`

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Tables
- `GET /tables`
- `POST /tables`
- `GET /tables/:tableId`
- `PATCH /tables/:tableId`
- `PATCH /tables/:tableId/close`
- `PATCH /tables/:tableId/reopen`
- `PATCH /tables/:tableId/apply-proportional-adjustment` (legado)

### Players
- `GET /players/table/:tableId`
- `POST /players/table/:tableId`
- `PATCH /players/:playerId/rebuy`
- `PATCH /players/:playerId/cashout`
- `PATCH /players/:playerId/cashout/edit`
- `PATCH /players/:playerId`
- `DELETE /players/:playerId`

### Transactions
- `GET /transactions/table/:tableId`
- `POST /transactions` (lancamento manual desabilitado; retorna 409)
- `PATCH /transactions/:transactionId` (edicao manual desabilitada; retorna 409)
- `DELETE /transactions/:transactionId` (exclusao manual desabilitada; retorna 409)

Swagger UI:
- `GET /docs`

## Como rodar local

## 1) Requisitos
- Node.js 20+
- npm 10+
- PostgreSQL

## 2) Instalar dependencias

```bash
cd backend
npm install
cd ../frontend
npm install
```

## 3) Variaveis de ambiente

### `backend/.env`

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@HOST:5432/postgres?sslmode=require
JWT_SECRET=troque-por-um-segredo-forte
PORT=3333
CORS_ORIGIN=http://localhost:5173
ADMIN_EMAIL=admin@chipz.local
ADMIN_PASSWORD=troque-por-uma-senha-forte
```

### `frontend/.env`

```env
VITE_API_URL=http://localhost:3333
VITE_APP_NAME=Chipz
```

## 4) Prisma (backend)

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

Opcional:

```bash
npx prisma studio
```

## 5) Subir backend

```bash
cd backend
npm run dev
```

API: `http://localhost:3333`

## 6) Subir frontend

```bash
cd frontend
npm run dev
```

App: `http://localhost:5173`

## Scripts

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

## Troubleshooting rapido

- Erro de CORS: confira `CORS_ORIGIN` no backend
- Frontend nao conecta API: confira `VITE_API_URL`
- Erro de banco/migration: rode `npx prisma generate` e `npx prisma migrate deploy`
- Porta ocupada: ajuste `PORT` e `VITE_API_URL`

## Roadmap tecnico sugerido

- Testes automatizados (unit + integracao)
- CI para lint/build/test/migrate
- Auditoria de schemas Swagger para manter 100% alinhado ao dominio
- Feature flag para reativar ajuste proporcional quando necessario

---

Feito para operacao real de mesas, com base tecnica pronta para evolucao.
