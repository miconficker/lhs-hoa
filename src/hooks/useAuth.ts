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
  // Derived state (stored as fields; do not use getters with Zustand)
  isAuthenticated: boolean;
  isResident: boolean;
  isGuest: boolean;
  // Actions
  setAuth: (auth: AuthResponse) => void;
  clearAuth: () => void;
  init: () => Promise<void>;
  loginWithGoogle: () => void;
  logoutGuest: () => Promise<void>;
}

function deriveFlags(user: User | null, guest: GuestSession | null) {
  const isResident = !!user;
  const isGuest = !!guest && !user;
  const isAuthenticated = !!(user || guest);
  return { isAuthenticated, isResident, isGuest };
}

export const useAuth = create<AuthState>((set, get) => ({
  // Resident user auth
  user: null,
  token: null,
  // Guest session
  guest: null,
  initialized: false,
  ...deriveFlags(null, null),

  setAuth: (auth) => {
    localStorage.setItem("hoa_token", auth.token);
    localStorage.setItem("hoa_user", JSON.stringify(auth.user));
    set({
      user: auth.user,
      token: auth.token,
      ...deriveFlags(auth.user, get().guest),
    });
  },

  clearAuth: () => {
    localStorage.removeItem("hoa_token");
    localStorage.removeItem("hoa_user");
    set({ user: null, token: null, ...deriveFlags(null, get().guest) });
  },

  init: async () => {
    // Initialize resident user auth
    const token = localStorage.getItem("hoa_token");
    const userStr = localStorage.getItem("hoa_user");
    if (token && userStr) {
      try {
        const parsedUser = JSON.parse(userStr) as User;
        set({
          user: parsedUser,
          token,
          ...deriveFlags(parsedUser, get().guest),
        });
      } catch {
        // If `hoa_user` is corrupted, try to recover from the token instead of
        // immediately logging the user out.
        localStorage.removeItem("hoa_user");
      }
    }

    // If we have a token but no user (or invalid stored user), refresh from API.
    if (token && !get().user) {
      try {
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.user) {
            localStorage.setItem("hoa_user", JSON.stringify(data.user));
            set({
              user: data.user,
              token,
              ...deriveFlags(data.user, get().guest),
            });
          }
        } else {
          // Token is invalid/expired.
          localStorage.removeItem("hoa_user");
          localStorage.removeItem("hoa_token");
          set({ user: null, token: null, ...deriveFlags(null, get().guest) });
        }
      } catch (error) {
        console.error("Failed to refresh resident session:", error);
      }
    }

    // Initialize guest session (check with server)
    try {
      const response = await fetch("/api/guest/auth/session");
      if (response.ok) {
        const data = await response.json();
        if (data.guest) {
          set({ guest: data.guest, ...deriveFlags(get().user, data.guest) });
        }
      }
    } catch (error) {
      console.error("Failed to fetch guest session:", error);
    }

    {
      const { user, guest } = get();
      set({ initialized: true, ...deriveFlags(user, guest) });
    }
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
    set({ guest: null, ...deriveFlags(get().user, null) });
  },
}));
