import api from './http';
import type { Table, TableDetailResponse } from '../types/domain';

const normalizeTableStatus = (status: unknown, closedAt: string | null | undefined): 'OPEN' | 'CLOSED' => {
  if (typeof status === 'string') {
    const normalized = status.toUpperCase();
    if (normalized === 'OPEN' || normalized === 'CLOSED') {
      return normalized;
    }
  }

  return closedAt ? 'CLOSED' : 'OPEN';
};

const normalizeTable = <T extends { status?: unknown; closedAt?: string | null }>(table: T): T & { status: 'OPEN' | 'CLOSED' } => {
  return {
    ...table,
    status: normalizeTableStatus(table.status, table.closedAt),
  };
};

export const listTablesRequest = async () => {
  const { data } = await api.get<{ tables: Table[] }>('/tables');
  return data.tables.map((table) => normalizeTable(table));
};

export const createTableRequest = async (payload: {
  name: string;
  blinds: string;
  currency: string;
  valorFichaCents: number;
  buyInMinimoCents: number;
  buyInMaximoCents?: number;
  permitirRebuy: boolean;
  limiteRebuys: number;
}) => {
  const { data } = await api.post<{ table: Table }>('/tables', payload);
  return normalizeTable(data.table);
};

export const getTableRequest = async (tableId: string) => {
  const { data } = await api.get<TableDetailResponse>(`/tables/${tableId}`);
  return {
    ...data,
    table: normalizeTable(data.table),
  };
};

export const updateTableRequest = async (
  tableId: string,
  payload: Partial<
    Pick<
      Table,
      | 'name'
      | 'blinds'
      | 'currency'
      | 'valorFichaCents'
      | 'buyInMinimoCents'
      | 'buyInMaximoCents'
      | 'permitirRebuy'
      | 'limiteRebuys'
    >
  >,
) => {
  const { data } = await api.patch<{ table: Table }>(`/tables/${tableId}`, payload);
  return normalizeTable(data.table);
};

export const applyProportionalAdjustmentRequest = async (tableId: string) => {
  const { data } = await api.patch<{ table: Table }>(`/tables/${tableId}/apply-proportional-adjustment`);
  return normalizeTable(data.table);
};

export const closeTableRequest = async (tableId: string) => {
  const { data } = await api.patch<{ table: Table }>(`/tables/${tableId}/close`);
  return normalizeTable(data.table);
};

export const reopenTableRequest = async (tableId: string) => {
  const { data } = await api.patch<{ table: Table }>(`/tables/${tableId}/reopen`);
  return normalizeTable(data.table);
};
