import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../useAuth";
import type { User, AuthResponse } from "@/types";

// Helper function to reset auth state between tests
function resetAuthState() {
  const { result } = renderHook(() => useAuth());
  act(() => {
    if (result.current.user || result.current.token) {
      result.current.clearAuth();
    }
  });
}

describe("useAuth", () => {
  // Clear localStorage before each test
  beforeEach(() => {
    localStorage.clear();
  });

  // Clean up after each test
  afterEach(() => {
    localStorage.clear();
    resetAuthState();
  });

  describe("setAuth", () => {
    it("stores token and user in localStorage", () => {
      const { result } = renderHook(() => useAuth());

      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        role: "resident",
        name: "Test User",
      };

      const mockAuth: AuthResponse = {
        token: "test-token-abc123",
        user: mockUser,
      };

      act(() => {
        result.current.setAuth(mockAuth);
      });

      expect(localStorage.getItem("hoa_token")).toBe(mockAuth.token);
      expect(localStorage.getItem("hoa_user")).toBe(JSON.stringify(mockUser));
    });

    it("updates zustand state with user and token", () => {
      const { result } = renderHook(() => useAuth());

      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        role: "admin",
        name: "Admin User",
      };

      const mockAuth: AuthResponse = {
        token: "admin-token-xyz789",
        user: mockUser,
      };

      act(() => {
        result.current.setAuth(mockAuth);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockAuth.token);
    });
  });

  describe("clearAuth", () => {
    it("removes token and user from localStorage", () => {
      const { result } = renderHook(() => useAuth());

      // First set auth
      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        role: "resident",
        name: "Test User",
      };

      const mockAuth: AuthResponse = {
        token: "test-token-abc123",
        user: mockUser,
      };

      act(() => {
        result.current.setAuth(mockAuth);
      });

      // Verify it's set
      expect(localStorage.getItem("hoa_token")).toBe(mockAuth.token);

      // Now clear it
      act(() => {
        result.current.clearAuth();
      });

      expect(localStorage.getItem("hoa_token")).toBeNull();
      expect(localStorage.getItem("hoa_user")).toBeNull();
    });

    it("resets zustand state to null", () => {
      const { result } = renderHook(() => useAuth());

      // First set auth
      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        role: "admin",
        name: "Admin User",
      };

      const mockAuth: AuthResponse = {
        token: "admin-token-xyz789",
        user: mockUser,
      };

      act(() => {
        result.current.setAuth(mockAuth);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockAuth.token);

      // Now clear it
      act(() => {
        result.current.clearAuth();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
    });
  });

  describe("init", () => {
    it("loads valid auth data from localStorage", () => {
      const mockUser: User = {
        id: "user-456",
        email: "existing@example.com",
        role: "resident",
        name: "Existing User",
      };

      const mockToken = "existing-token-xyz";

      // Pre-populate localStorage
      localStorage.setItem("hoa_token", mockToken);
      localStorage.setItem("hoa_user", JSON.stringify(mockUser));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.init();
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.token).toBe(mockToken);
      expect(result.current.initialized).toBe(true);
    });

    it("handles corrupted localStorage data gracefully", () => {
      // Set invalid JSON
      localStorage.setItem("hoa_token", "some-token");
      localStorage.setItem("hoa_user", "invalid-json{");

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.init();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.initialized).toBe(true);
    });

    it("handles empty localStorage", () => {
      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.init();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.initialized).toBe(true);
    });

    it("handles missing token in localStorage", () => {
      const mockUser: User = {
        id: "user-789",
        email: "user@example.com",
        role: "resident",
        name: "User",
      };

      localStorage.setItem("hoa_user", JSON.stringify(mockUser));

      const { result } = renderHook(() => useAuth());

      act(() => {
        result.current.init();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.initialized).toBe(true);
    });
  });
});
