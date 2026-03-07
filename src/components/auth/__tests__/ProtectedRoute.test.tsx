import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "../ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";
import type { User } from "@/types";

// Helper to reset auth state
function resetAuthState() {
  const { result } = renderHook(() => useAuth());
  act(() => {
    if (result.current.user || result.current.token) {
      result.current.clearAuth();
    }
  });
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    resetAuthState();
  });

  afterEach(() => {
    localStorage.clear();
    resetAuthState();
  });

  describe("when not initialized", () => {
    it("shows loading spinner", () => {
      const { container } = renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.init();
      });
    });

    it("redirects to login", () => {
      renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      // Navigate redirects happen, so we check that protected content is NOT shown
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  describe("when user is authenticated", () => {
    const mockUser: User = {
      id: "user-123",
      email: "user@example.com",
      role: "resident",
      name: "Test User",
    };

    beforeEach(() => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.setAuth({
          token: "test-token",
          user: mockUser,
        });
      });
    });

    it("renders protected content for resident", () => {
      renderWithRouter(
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("renders protected content when allowedRoles includes user role", () => {
      renderWithRouter(
        <ProtectedRoute allowedRoles={["resident", "admin"]}>
          <div>Admin Content</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Admin Content")).toBeInTheDocument();
    });
  });

  describe("role-based access control", () => {
    const residentUser: User = {
      id: "resident-123",
      email: "resident@example.com",
      role: "resident",
      name: "Resident User",
    };

    const adminUser: User = {
      id: "admin-123",
      email: "admin@example.com",
      role: "admin",
      name: "Admin User",
    };

    it("redirects resident away from admin-only routes", () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.setAuth({
          token: "resident-token",
          user: residentUser,
        });
      });

      renderWithRouter(
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Only</div>
        </ProtectedRoute>,
      );

      expect(screen.queryByText("Admin Only")).not.toBeInTheDocument();
    });

    it("allows admin to access admin routes", () => {
      const { result } = renderHook(() => useAuth());
      act(() => {
        result.current.setAuth({
          token: "admin-token",
          user: adminUser,
        });
      });

      renderWithRouter(
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Only</div>
        </ProtectedRoute>,
      );

      expect(screen.getByText("Admin Only")).toBeInTheDocument();
    });
  });
});
