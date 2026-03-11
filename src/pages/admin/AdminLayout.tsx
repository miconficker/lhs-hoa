import { useState } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { useAuth } from "@/hooks/useAuth";

/**
 * Admin layout component that wraps all admin pages.
 * Provides the persistent sidebar and manages its state.
 * Security: Enforces admin-only access as defense-in-depth.
 */
export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Security: Ensure only admins can access admin pages
  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="bg-[hsl(var(--status-error-bg))] border border-[hsl(var(--status-error-fg))] text-[hsl(var(--status-error-fg))] p-6 rounded-lg max-w-md">
          <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
          <p className="text-sm">
            Admin privileges required to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 p-6">{children}</div>
    </div>
  );
}
