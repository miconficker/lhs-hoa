import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { bottomNavItems, type Role } from "./nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { user } = useAuth();

  const visibleItems = user
    ? bottomNavItems.filter((item) => item.roles.includes(user.role as Role))
    : [];

  if (!user || visibleItems.length === 0) return null;

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-40 border-t bg-background border-border lg:hidden"
      aria-label="Bottom navigation"
    >
      <div className="flex justify-around items-center h-16 safe-area-bottom">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to!}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
            aria-label={item.label}
          >
            {({ isActive }) => (
              <>
                {item.icon && (
                  <item.icon
                    className={cn("w-5 h-5", isActive && "stroke-[2.5]")}
                    aria-hidden="true"
                  />
                )}
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
