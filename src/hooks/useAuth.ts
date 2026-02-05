import { create } from "zustand";
import type { User, AuthResponse } from "@/types";

interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  init: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  initialized: false,

  setAuth: (auth) => {
    localStorage.setItem("hoa_token", auth.token);
    localStorage.setItem("hoa_user", JSON.stringify(auth.user));
    set({ user: auth.user, token: auth.token });
  },

  clearAuth: () => {
    localStorage.removeItem("hoa_token");
    localStorage.removeItem("hoa_user");
    set({ user: null, token: null });
  },

  init: () => {
    const token = localStorage.getItem("hoa_token");
    const userStr = localStorage.getItem("hoa_user");
    if (token && userStr) {
      try {
        set({ user: JSON.parse(userStr), token, initialized: true });
      } catch {
        set({ initialized: true });
      }
    } else {
      set({ initialized: true });
    }
  },
}));
