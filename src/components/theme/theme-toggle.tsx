import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="w-10 h-10 rounded-lg border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm relative overflow-hidden group"
        aria-label="Toggle theme"
      >
        <span className="sr-only">Toggle theme</span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="w-10 h-10 rounded-lg border-2 border-border bg-background hover:bg-accent hover:text-accent-foreground transition-all shadow-sm relative overflow-hidden group"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Icons */}
      <Sun className="h-[1.3rem] w-[1.3rem] rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0 relative z-10 text-amber-500" />
      <Moon className="absolute h-[1.3rem] w-[1.3rem] rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100 relative z-10 text-indigo-400" />

      {/* Subtle ring on focus/hover */}
      <div className="absolute inset-0 rounded-lg ring-2 ring-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
