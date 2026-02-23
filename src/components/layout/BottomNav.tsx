import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Home, Map, ClipboardList, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/map",
    icon: Map,
    label: "Map",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/service-requests",
    icon: ClipboardList,
    label: "Requests",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    roles: ["admin", "resident"],
  },
];

export function BottomNav() {
  const { user } = useAuth();

  const visibleItems = user
    ? bottomNavItems.filter((item) => item.roles.includes(user.role))
    : [];

  if (!user || visibleItems.length === 0) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 lg:hidden z-40"
      aria-label="Bottom navigation"
    >
      <div className="flex items-center justify-around h-16 safe-area-bottom">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300",
              )
            }
            aria-label={item.label}
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn("w-5 h-5 mb-1", isActive && "stroke-[2.5]")}
                  aria-hidden="true"
                />
                <span className="text-xs font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
