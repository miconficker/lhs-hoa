import { renderHook, act } from "@testing-library/react";
import { useAuth } from "@/hooks/useAuth";
import type { User, AuthResponse } from "@/types";

/**
 * Mock authentication utilities for testing
 */

// Reset auth state between tests
export function resetAuthState() {
  const { result } = renderHook(() => useAuth());
  act(() => {
    if (result.current.user || result.current.token) {
      result.current.clearAuth();
    }
  });
}

// Set authenticated user
export function setMockAuth(auth: AuthResponse) {
  const { result } = renderHook(() => useAuth());
  act(() => {
    result.current.setAuth(auth);
  });
}

// Set mock resident user
export function setMockResident() {
  setMockAuth({
    token: "mock-resident-token",
    user: {
      id: "resident-1",
      email: "resident@example.com",
      role: "resident",
      name: "Resident User",
    },
  });
}

// Set mock admin user
export function setMockAdmin() {
  setMockAuth({
    token: "mock-admin-token",
    user: {
      id: "admin-1",
      email: "admin@example.com",
      role: "admin",
      name: "Admin User",
    },
  });
}

// Set mock staff user
export function setMockStaff() {
  setMockAuth({
    token: "mock-staff-token",
    user: {
      id: "staff-1",
      email: "staff@example.com",
      role: "staff",
      name: "Staff User",
    },
  });
}

// Clear all auth state
export function clearMockAuth() {
  const { result } = renderHook(() => useAuth());
  act(() => {
    result.current.clearAuth();
  });
}

// Mock localStorage helpers
export function mockLocalStorage() {
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };

  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    writable: true,
  });

  return localStorageMock;
}

// Clean up localStorage after tests
export function cleanupLocalStorage() {
  localStorage.clear();
}
