import { Link } from "react-router-dom";
import { Home, Moon, Sun, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

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
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Left: Logo/Back button */}
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Link to={backTo}>
              <Button variant="ghost" size="icon">
                <Calendar className="w-5 h-5" />
              </Button>
            </Link>
          )}
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Home className="w-5 h-5" />
            <span className="hidden sm:inline">Laguna Hills HOA</span>
          </Link>
          {title && (
            <span className="hidden md:inline text-muted-foreground">
              / {title}
            </span>
          )}
        </div>

        {/* Right: Theme toggle */}
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-10 h-10 rounded-lg border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm"
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        >
          {mounted && (
            <>
              <Sun className="h-[1.3rem] w-[1.3rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
              <Moon className="absolute h-[1.3rem] w-[1.3rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 text-indigo-400" />
            </>
          )}
        </button>
      </div>
    </header>
  );
}
