import api from './http';
import type { Transaction, TransactionType } from '../types/domain';

export const listTransactionsRequest = async (tableId: string) => {
  const { data } = await api.get<{ transactions: Transaction[] }>(`/transactions/table/${tableId}`);
  return data.transactions;
};

export const createTransactionRequest = async (payload: {
  tableId: string;
  tablePlayerId: string;
  type: TransactionType;
  amountCents: number;
  note?: string;
}) => {
  const { data } = await api.post<{ transaction: Transaction }>('/transactions', payload);
  return data.transaction;
};

export const updateTransactionRequest = async (
  transactionId: string,
  payload: {
    type?: TransactionType;
    amountCents?: number;
    note?: string | null;
  },
) => {
  const { data } = await api.patch<{ transaction: Transaction }>(`/transactions/${transactionId}`, payload);
  return data.transaction;
};

export const removeTransactionRequest = async (transactionId: string) => {
  await api.delete(`/transactions/${transactionId}`);
};
