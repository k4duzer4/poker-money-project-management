import { create } from "zustand";
import api from "../services/http";

interface Table {
  id: string;
  name: string;
  blinds: string;
  currency: string;
  status: string;
  createdAt: string;
}

interface TablesState {
  tables: Table[];
  tableDetail: Table | null;
  fetchTables: () => Promise<void>;
  fetchTableDetail: (id: string) => Promise<void>;
}

export const useTablesStore = create<TablesState>((set) => ({
  tables: [],
  tableDetail: null,
  fetchTables: async () => {
    const { data } = await api.get("/tables");
    set({ tables: data.tables });
  },
  fetchTableDetail: async (id: string) => {
    const { data } = await api.get(`/tables/${id}`);
    set({ tableDetail: data.table });
  },
}));
