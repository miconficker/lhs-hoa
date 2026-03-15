import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import lhsLogo from "@/assets/lhs-logo.svg";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export interface PublicPageHeaderProps {
  title?: string;
  showBackButton?: boolean;
  backTo?: string;
}

export function PublicPageHeader({
  title,
  showBackButton = false,
  backTo = "/",
}: PublicPageHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b shadow-sm bg-background border-border">
      <div className="overflow-visible px-4 mx-auto max-w-full sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left: back button + logo */}
          <div className="flex gap-3 items-center min-w-0">
            {showBackButton && (
              <Link to={backTo}>
                <Button variant="ghost" size="icon">
                  <Calendar className="w-5 h-5" />
                </Button>
              </Link>
            )}
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
            {title && (
              <span className="hidden md:inline text-muted-foreground">
                / {title}
              </span>
            )}
          </div>

          {/* Right: theme toggle + login button */}
          <nav
            className="flex gap-2 items-center shrink-0"
            aria-label="Utility menu"
          >
            <ThemeToggle />
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Login
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
