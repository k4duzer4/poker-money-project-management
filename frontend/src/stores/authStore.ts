import { create } from 'zustand';

import { meRequest } from '../services/auth';
import type { User } from '../types/domain';

const TOKEN_KEY = 'token';
const EMAIL_KEY = 'userEmail';

type AuthState = {
  token: string | null;
  user: User | null;
  bootstrapped: boolean;
  bootstrapLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => void;
  bootstrap: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  bootstrapped: false,
  bootstrapLoading: false,
  signIn: async (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ token });
    await get().bootstrap();
  },
  signOut: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    set({ token: null, user: null, bootstrapped: true, bootstrapLoading: false });
  },
  bootstrap: async () => {
    const token = get().token;

    if (!token) {
      set({ user: null, bootstrapped: true, bootstrapLoading: false });
      return;
    }

    set({ bootstrapLoading: true });

    try {
      const user = await meRequest();
      localStorage.setItem(EMAIL_KEY, user.email);
      set({ user, bootstrapped: true, bootstrapLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(EMAIL_KEY);
      set({ token: null, user: null, bootstrapped: true, bootstrapLoading: false });
    }
  },
}));
