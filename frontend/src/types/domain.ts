export type TableStatus = 'OPEN' | 'CLOSED';
export type PlayerStatus = 'ACTIVE' | 'CASHOUT';
export type TransactionType = 'BUY_IN' | 'REBUY' | 'CASH_OUT' | 'ADJUSTMENT';

export type User = {
  id: string;
  email: string;
};

export type Table = {
  id: string;
  ownerUserId: string;
  name: string;
  blinds: string;
  currency: string;
  valorFichaCents: number;
  buyInMinimoCents: number;
  buyInMaximoCents: number | null;
  permitirRebuy: boolean;
  limiteRebuys: number;
  totalMesaCents: number;
  ajusteProporcionalAplicado: boolean;
  status: TableStatus;
  createdAt: string;
  closedAt: string | null;
};

export type Player = {
  id: string;
  tableId: string;
  name: string;
  status: PlayerStatus;
  buyInInicialCents: number;
  totalInvestidoCents: number;
  valorFinalCents: number | null;
  resultadoCents: number | null;
  cashoutAt: string | null;
  createdAt: string;
};

export type Transaction = {
  id: string;
  tableId: string;
  tablePlayerId: string;
  type: TransactionType;
  amountCents: number;
  createdAt: string;
  note: string | null;
  tablePlayer: {
    id: string;
    name: string;
    status: PlayerStatus;
  };
};

export type TableSummary = {
  totalPlayers: number;
  activePlayers: number;
  totalTransactions: number;
  totalInvestidoCents: number;
  totalFinalCents: number;
  totalMesaCents: number;
  players: Array<{
    playerId: string;
    name: string;
    status: PlayerStatus;
    buyInInicialCents: number;
    totalInvestidoCents: number;
    valorFinalCents: number | null;
    resultadoCents: number | null;
    rebuysCount: number;
  }>;
};

export type Transfer = {
  from: string;
  to: string;
  amountCents: number;
};

export type ClosureInfo = {
  canClose: boolean;
  hasActivePlayers: boolean;
  differenceCents: number;
  needsProportionalAdjustment: boolean;
};

export type TableDetailResponse = {
  table: Table & {
    players: Player[];
    transactions: Transaction[];
  };
  summary: TableSummary;
  transfers: Transfer[];
  closure: ClosureInfo;
};
