import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MobileNav } from "./MobileNav";
import lhsLogo from "@/assets/lhs-logo.svg";

export function Header() {
  const { user, clearAuth } = useAuth();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
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
              <span className="text-xl font-bold text-gray-900 dark:text-white hidden sm:inline">
                Laguna Hills HOA
              </span>
              <span className="text-xl font-bold text-gray-900 dark:text-white sm:hidden">
                LHS HOA
              </span>
            </Link>
          </div>

          <nav
            className="flex items-center gap-2 sm:gap-4"
            aria-label="User menu"
          >
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
                  {user.email} ({user.role})
                </span>
                <button
                  onClick={clearAuth}
                  className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
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
