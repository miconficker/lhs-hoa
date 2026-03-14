import { create } from "zustand";
import type { User, AuthResponse, GuestSession } from "@/types";

interface AuthState {
  // Resident user auth
  user: User | null;
  token: string | null;
  // Guest session (external visitors)
  guest: GuestSession | null;
  // Initialization state
  initialized: boolean;
  // Actions
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  init: () => Promise<void>;
  loginWithGoogle: () => void;
  logoutGuest: () => Promise<void>;
  // Computed properties
  isAuthenticated: boolean;
  isResident: boolean;
  isGuest: boolean;
}

export const useAuth = create<AuthState>((set, get) => ({
  // Resident user auth
  user: null,
  token: null,
  // Guest session
  guest: null,
  initialized: false,

  // Computed properties
  get isAuthenticated() {
    const { user, guest } = get();
    return !!(user || guest);
  },
  get isResident() {
    return !!get().user;
  },
  get isGuest() {
    const { guest, user } = get();
    return !!guest && !user;
  },

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

  init: async () => {
    // Initialize resident user auth
    const token = localStorage.getItem("hoa_token");
    const userStr = localStorage.getItem("hoa_user");
    if (token && userStr) {
      try {
        set({ user: JSON.parse(userStr), token });
      } catch {
        // Invalid user data, clear it
        localStorage.removeItem("hoa_user");
        localStorage.removeItem("hoa_token");
      }
    }

    // Initialize guest session (check with server)
    try {
      const response = await fetch("/api/guest/auth/session");
      if (response.ok) {
        const data = await response.json();
        if (data.guest) {
          set({ guest: data.guest });
        }
      }
    } catch (error) {
      console.error("Failed to fetch guest session:", error);
    }

    set({ initialized: true });
  },

  loginWithGoogle: () => {
    // Redirect to Google OAuth for guest authentication
    window.location.href = "/api/guest/auth/google";
  },

  logoutGuest: async () => {
    try {
      await fetch("/api/guest/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Failed to logout guest:", error);
    }
    set({ guest: null });
  },
}));
