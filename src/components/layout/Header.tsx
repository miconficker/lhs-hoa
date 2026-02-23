import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import lhsLogo from "@/assets/lhs-logo.svg";

export function Header() {
  const { user, clearAuth } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={lhsLogo} alt="Laguna Hills HOA" className="h-10 w-auto" />
            <span className="text-xl font-bold text-gray-900">
              Laguna Hills HOA
            </span>
          </Link>

          <nav className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <>
                <NotificationBell />
                <span className="text-sm text-gray-600">
                  {user.email} ({user.role})
                </span>
                <button
                  onClick={clearAuth}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
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
