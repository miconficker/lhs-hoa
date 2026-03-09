import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CommandPalette } from "@/components/search/CommandPalette";
import { MobileNav } from "./MobileNav";
import lhsLogo from "@/assets/lhs-logo.svg";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
} from "@/components/ui/navigation-menu";
import {
  Home,
  Map,
  Calendar,
  CreditCard,
  Megaphone,
  FileText,
  Wrench,
  CarFront,
  Settings,
} from "lucide-react";

interface NavItem {
  label: string;
  icon?: any;
  to?: string;
  roles: string[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
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
    label: "Community",
    icon: Megaphone,
    roles: ["admin", "resident", "staff", "guest"],
    children: [
      {
        to: "/announcements",
        label: "Announcements",
        roles: ["admin", "resident", "staff", "guest"],
      },
      {
        to: "/events",
        label: "Events",
        roles: ["admin", "resident", "staff", "guest"],
      },
      {
        to: "/polls",
        label: "Polls",
        roles: ["admin", "resident", "staff", "guest"],
      },
    ],
  },
  {
    label: "Resources",
    icon: FileText,
    roles: ["admin", "resident", "staff"],
    children: [
      {
        to: "/documents",
        label: "Documents",
        roles: ["admin", "resident", "staff"],
      },
      {
        to: "/help",
        label: "Help",
        roles: ["admin", "resident", "staff", "guest"],
      },
    ],
  },
  {
    to: "/reservations",
    icon: Calendar,
    label: "Reservations",
    roles: ["admin", "resident", "guest"],
  },
  {
    label: "Payments",
    icon: CreditCard,
    roles: ["admin", "resident"],
    children: [
      { to: "/payments", label: "My Payments", roles: ["admin", "resident"] },
      {
        to: "/payments?action=new",
        label: "Make Payment",
        roles: ["admin", "resident"],
      },
    ],
  },
  {
    label: "Passes & IDs",
    icon: CarFront,
    roles: ["admin", "resident"],
    children: [
      { to: "/passes", label: "Vehicle Passes", roles: ["admin", "resident"] },
      { to: "/passes?type=employee", label: "Employee IDs", roles: ["admin"] },
    ],
  },
  {
    label: "Services",
    icon: Wrench,
    roles: ["admin", "resident", "staff"],
    children: [
      {
        to: "/service-requests",
        label: "Service Requests",
        roles: ["admin", "resident", "staff"],
      },
      { to: "/admin/common-areas", label: "Common Areas", roles: ["admin"] },
    ],
  },
  {
    to: "/admin",
    icon: Settings,
    label: "Admin Panel",
    roles: ["admin"],
  },
];

export function Header() {
  const { user, clearAuth } = useAuth();

  const visibleNavItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  const renderDesktopNav = () => {
    if (!user) return null;

    return (
      <NavigationMenu className="hidden lg:flex">
        <NavigationMenuList className="flex items-center gap-1">
          {visibleNavItems.map((item) => {
            if (item.children) {
              return (
                <NavigationMenuItem key={item.label}>
                  <NavigationMenuTrigger className="gap-1">
                    {item.icon && <item.icon className="h-4 w-4" />}
                    {item.label}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-1 p-2 min-w-[200px]">
                      {item.children
                        .filter((child) => child.roles.includes(user.role))
                        .map((child) => (
                          <li key={child.to}>
                            <NavigationMenuLink asChild>
                              <Link
                                to={child.to!}
                                className="block select-none rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                              >
                                {child.label}
                              </Link>
                            </NavigationMenuLink>
                          </li>
                        ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              );
            }

            return (
              <NavigationMenuItem key={item.to}>
                <NavigationMenuLink asChild>
                  <Link
                    to={item.to!}
                    className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                    {item.label}
                  </Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    );
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-4">
            <MobileNav />
            <Link to="/" className="flex items-center gap-2">
              <img
                src={lhsLogo}
                alt="Laguna Hills HOA"
                width="40"
                height="40"
                className="h-10"
              />
              <span className="text-xl font-bold text-foreground hidden sm:inline">
                Laguna Hills HOA
              </span>
              <span className="text-xl font-bold text-foreground sm:hidden">
                LHS HOA
              </span>
            </Link>
            {renderDesktopNav()}
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
