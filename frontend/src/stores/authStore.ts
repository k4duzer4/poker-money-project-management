import { create } from "zustand";
import api from "../services/http";

interface AuthState {
  token: string | null;
  user: { id: string; email: string } | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  bootstrap: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("token"),
  user: null,
  signIn: async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("token", data.token);
    set({ token: data.token });
    await (useAuthStore.getState().bootstrap());
  },
  signOut: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null });
  },
  bootstrap: async () => {
    try {
      const { data } = await api.get("/auth/me");
      set({ user: data.user });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null });
    }
  },
}));
