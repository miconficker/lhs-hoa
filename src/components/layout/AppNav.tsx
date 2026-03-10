/**
 * AppNav — single component that drives both nav contexts:
 *
 *   mode="bar"   → horizontal NavigationMenu (used in Header at xl+)
 *   mode="sheet" → hamburger button that opens a Sheet with the same items
 *
 * Both modes read from the same navItems config and apply the same
 * role-based filter, so they are always in sync.
 */

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { navItems, type NavItem, type Role } from "./nav-items";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

// ─── helpers ────────────────────────────────────────────────────────────────

function filterItems(items: NavItem[], role: Role): NavItem[] {
  return items.filter((item) => item.roles.includes(role));
}

// ─── shared sub-components ──────────────────────────────────────────────────

/** A single child link used inside both the dropdown and the sheet indent */
function ChildLink({
  item,
  onClick,
  sheet,
}: {
  item: NavItem;
  onClick?: () => void;
  sheet?: boolean;
}) {
  if (sheet) {
    return (
      <NavLink
        to={item.to!}
        onClick={onClick}
        className={({ isActive }) =>
          `block rounded-md px-3 py-2 text-sm transition-colors ${
            isActive
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          }`
        }
      >
        {item.label}
      </NavLink>
    );
  }

  return (
    <NavigationMenuLink asChild>
      <Link
        to={item.to!}
        className="block px-3 py-2 text-sm rounded-md transition-colors outline-none select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      >
        {item.label}
      </Link>
    </NavigationMenuLink>
  );
}

// ─── Bar mode ───────────────────────────────────────────────────────────────

function NavBar({ items, role }: { items: NavItem[]; role: Role }) {
  return (
    <NavigationMenu>
      <NavigationMenuList className="flex items-center gap-0.5">
        {items.map((item) => {
          if (item.children) {
            const children = filterItems(item.children, role);
            if (children.length === 0) return null;

            return (
              <NavigationMenuItem key={item.label}>
                <NavigationMenuTrigger className="gap-1 h-9 text-sm">
                  {item.icon && <item.icon className="w-4 h-4" />}
                  {item.label}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid gap-0.5 p-2 min-w-[180px]">
                    {children.map((child) => (
                      <li key={child.to}>
                        <ChildLink item={child} />
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
                  className="inline-flex h-9 w-max items-center justify-center gap-1.5 rounded-md bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                >
                  {item.icon && <item.icon className="w-4 h-4" />}
                  {item.label}
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

// ─── Sheet mode ─────────────────────────────────────────────────────────────

function NavSheetContent({
  items,
  role,
  onClose,
}: {
  items: NavItem[];
  role: Role;
  onClose: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      {items.map((item) => {
        if (item.children) {
          const children = filterItems(item.children, role);
          if (children.length === 0) return null;
          const isOpen = openGroups.has(item.label);

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleGroup(item.label)}
                className="flex justify-between items-center px-3 py-2 w-full text-sm font-medium rounded-md transition-colors text-foreground hover:bg-accent"
              >
                <span className="flex gap-2 items-center">
                  {item.icon && <item.icon className="w-4 h-4" />}
                  {item.label}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform duration-150 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                  {children.map((child) => (
                    <ChildLink
                      key={child.to}
                      item={child}
                      onClick={onClose}
                      sheet
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to!}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-accent"
              }`
            }
          >
            {item.icon && <item.icon className="w-4 h-4" />}
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

// ─── Public component ────────────────────────────────────────────────────────

interface AppNavProps {
  mode: "bar" | "sheet";
  className?: string;
}

export function AppNav({ mode, className }: AppNavProps) {
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!user) return null;

  const role = user.role as Role;
  const visibleItems = filterItems(navItems, role);

  if (mode === "bar") {
    return (
      <div className={className}>
        <NavBar items={visibleItems} role={role} />
      </div>
    );
  }

  // mode === "sheet"
  return (
    <div className={className}>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>

        <SheetContent side="left" className="flex flex-col p-0 w-64">
          <SheetHeader className="px-4 py-3 border-b border-border">
            <SheetTitle className="text-sm font-semibold text-left">
              Menu
            </SheetTitle>
          </SheetHeader>
          <NavSheetContent
            items={visibleItems}
            role={role}
            onClose={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
