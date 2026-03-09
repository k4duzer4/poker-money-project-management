import { create } from "zustand";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface UIState {
  toasts: Toast[];
  addToast: (message: string, type: "success" | "error" | "info") => void;
  removeToast: (id: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  addToast: (message, type) =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now(), message, type }],
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));
