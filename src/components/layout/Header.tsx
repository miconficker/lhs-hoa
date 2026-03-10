import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CommandPalette } from "@/components/search/CommandPalette";
import { AppNav } from "./AppNav";
import lhsLogo from "@/assets/lhs-logo.svg";

export function Header() {
  const { user, clearAuth } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b shadow-sm bg-background border-border">
      <div className="overflow-visible px-4 mx-auto max-w-full sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: sheet trigger + logo + bar nav */}
          <div className="flex gap-3 items-center min-w-0">
            {/* Sheet hamburger — always present as the fallback */}
            <AppNav mode="sheet" />

            <Link to="/" className="flex gap-2 items-center shrink-0">
              <img
                src={lhsLogo}
                alt="Laguna Hills HOA"
                width="40"
                height="40"
                className="w-auto h-10"
              />
              <span className="hidden text-xl font-bold text-foreground sm:inline">
                Laguna Hills HOA
              </span>
              <span className="text-xl font-bold text-foreground sm:hidden">
                LHS HOA
              </span>
            </Link>

            {/* Horizontal bar — only at xl+ */}
            <AppNav mode="bar" className="hidden xl:flex" />
          </div>

          {/* Right: utility controls */}
          <nav
            className="flex gap-1 items-center sm:gap-2 shrink-0"
            aria-label="User menu"
          >
            <CommandPalette />
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <span className="text-sm text-muted-foreground hidden lg:inline max-w-[180px] truncate">
                  {user.email}
                </span>
                <button
                  onClick={clearAuth}
                  className="px-3 py-2 text-sm font-medium transition-colors text-foreground hover:text-primary"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
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
