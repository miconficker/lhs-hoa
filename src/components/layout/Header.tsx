import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CommandPalette } from "@/components/search/CommandPalette";
import { MobileNav } from "./MobileNav";
import lhsLogo from "@/assets/lhs-logo.svg";

export function Header() {
  const { user, clearAuth } = useAuth();

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <MobileNav />
            <Link to="/" className="flex items-center gap-2">
              <img
                src={lhsLogo}
                alt="Laguna Hills HOA"
                className="h-10 w-auto"
              />
              <span className="text-xl font-bold text-foreground hidden sm:inline">
                Laguna Hills HOA
              </span>
              <span className="text-xl font-bold text-foreground sm:hidden">
                LHS HOA
              </span>
            </Link>
          </div>

          <nav
            className="flex items-center gap-2 sm:gap-4"
            aria-label="User menu"
          >
            <CommandPalette />
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.email} ({user.role})
                </span>
                <button
                  onClick={clearAuth}
                  className="px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                Login
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
