# Primary Navigation Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add desktop navigation to Header.tsx with dropdown menus and reorganize MobileNav.tsx with collapsible grouped navigation

**Architecture:**
- Desktop: Horizontal navigation bar between logo and right-side controls using NavigationMenu component with dropdown triggers
- Mobile: Collapsible accordion-style groups using Collapsible component with chevron icons
- Shared: NavItem interface with optional children array for nested items

**Tech Stack:** React Router v6, shadcn/ui NavigationMenu and Collapsible components, Lucide icons, Tailwind CSS

---

## Task 1: Add NavigationMenu UI Component (shadcn/ui)

**Files:**
- Create: `src/components/ui/navigation-menu.tsx`

**Step 1: Check if navigation-menu component exists**

Run: `ls src/components/ui/navigation-menu.tsx`
Expected: File does not exist (exit code 2)

**Step 2: Add navigation-menu component from shadcn/ui**

Run: `npx shadcn@latest add navigation-menu`
Expected: Component added successfully to src/components/ui/navigation-menu.tsx

**Step 3: Verify component was created**

Run: `cat src/components/ui/navigation-menu.tsx | head -20`
Expected: TypeScript file with NavigationMenu exports

**Step 4: Commit**

```bash
git add src/components/ui/navigation-menu.tsx
git commit -m "feat: add NavigationMenu UI component from shadcn/ui"
```

---

## Task 2: Add Collapsible UI Component (shadcn/ui)

**Files:**
- Create: `src/components/ui/collapsible.tsx`

**Step 1: Check if collapsible component exists**

Run: `ls src/components/ui/collapsible.tsx`
Expected: File does not exist (exit code 2)

**Step 2: Add collapsible component from shadcn/ui**

Run: `npx shadcn@latest add collapsible`
Expected: Component added successfully to src/components/ui/collapsible.tsx

**Step 3: Verify component was created**

Run: `cat src/components/ui/collapsible.tsx | head -20`
Expected: TypeScript file with Collapsible exports

**Step 4: Commit**

```bash
git add src/components/ui/collapsible.tsx
git commit -m "feat: add Collapsible UI component from shadcn/ui"
```

---

## Task 3: Update Header.tsx - Add Desktop Navigation

**Files:**
- Modify: `src/components/layout/Header.tsx`

**Step 1: Write navigation data structure and imports**

Replace existing Header.tsx imports (lines 1-7) with:

```typescript
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
  Settings,
  Megaphone,
  FileText,
  HelpCircle,
  Wrench,
  CarFront,
  IdCard,
  ChevronDown,
} from "lucide-react";
```

**Step 2: Add NavItem interface and navigation data**

After the imports (after line 7), add:

```typescript
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
      { to: "/announcements", label: "Announcements", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/events", label: "Events", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/polls", label: "Polls", roles: ["admin", "resident", "staff", "guest"] },
    ],
  },
  {
    label: "Resources",
    icon: FileText,
    roles: ["admin", "resident", "staff"],
    children: [
      { to: "/documents", label: "Documents", roles: ["admin", "resident", "staff"] },
      { to: "/help", label: "Help", roles: ["admin", "resident", "staff", "guest"] },
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
      { to: "/payments?action=new", label: "Make Payment", roles: ["admin", "resident"] },
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
      { to: "/service-requests", label: "Service Requests", roles: ["admin", "resident", "staff"] },
      { to: "/admin/common-areas", label: "Common Areas", roles: ["admin"] },
    ],
  },
];
```

**Step 3: Add desktop navigation component to Header**

Replace the Header function return statement (lines 12-64) with:

```typescript
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
                    <ChevronDown className="h-3 w-3" />
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
                className="h-10 w-auto"
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
```

**Step 4: Build to verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 5: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: add desktop navigation with dropdown menus to Header"
```

---

## Task 4: Update MobileNav.tsx - Add Collapsible Groups

**Files:**
- Modify: `src/components/layout/MobileNav.tsx`

**Step 1: Update imports**

Replace existing imports (lines 1-32) with:

```typescript
import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Menu, ChevronRight, ChevronDown } from "lucide-react";
import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Home,
  Map,
  ClipboardList,
  Calendar,
  CreditCard,
  FileText,
  MessageSquare,
  BarChart,
  Bell,
  Building2,
  DollarSign,
  Receipt,
  Badge,
  UserCheck,
  Megaphone,
  Settings,
  HelpCircle,
  CarFront,
  IdCard,
  Wrench,
} from "lucide-react";
```

**Step 2: Replace navItems with grouped structure**

Replace the navItems array (lines 34-157) with:

```typescript
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
      { to: "/announcements", label: "Announcements", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/events", label: "Events", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/polls", label: "Polls", roles: ["admin", "resident", "staff", "guest"] },
    ],
  },
  {
    label: "Resources",
    icon: FileText,
    roles: ["admin", "resident", "staff"],
    children: [
      { to: "/documents", label: "Documents", roles: ["admin", "resident", "staff"] },
      { to: "/help", label: "Help", roles: ["admin", "resident", "staff", "guest"] },
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
      { to: "/payments?action=new", label: "Make Payment", roles: ["admin", "resident"] },
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
      { to: "/service-requests", label: "Service Requests", roles: ["admin", "resident", "staff"] },
      { to: "/admin/common-areas", label: "Common Areas", roles: ["admin"] },
    ],
  },
  {
    to: "/messages",
    icon: MessageSquare,
    label: "Messages",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/notifications",
    icon: Bell,
    label: "Notifications",
    roles: ["admin", "resident", "staff"],
  },
  { separator: true, roles: ["admin"] },
  { sectionHeader: "Admin Panel", roles: ["admin"] },
  {
    to: "/admin/lots",
    icon: Building2,
    label: "Lot Management",
    roles: ["admin"],
  },
  {
    to: "/admin/dues",
    icon: DollarSign,
    label: "Dues Configuration",
    roles: ["admin"],
  },
  {
    to: "/admin/payments/in-person",
    icon: Receipt,
    label: "In-Person Payments",
    roles: ["admin"],
  },
  {
    to: "/admin/pass-management",
    icon: Badge,
    label: "Pass Management",
    roles: ["admin"],
  },
  {
    to: "/admin/whitelist",
    icon: UserCheck,
    label: "Email Whitelist",
    roles: ["admin"],
  },
  {
    to: "/admin",
    icon: Settings,
    label: "Admin Panel",
    roles: ["admin"],
  },
  {
    to: "/account",
    icon: Settings,
    label: "Account Settings",
    roles: ["admin", "resident", "staff", "guest"],
  },
];
```

**Step 3: Update MobileNav component with collapsible rendering**

Replace the MobileNav component function (lines 159-247) with:

```typescript
interface MobileNavProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileNav({ isOpen, onOpenChange }: MobileNavProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const openControlled = isOpen !== undefined;
  const is_open = openControlled ? isOpen : internalOpen;
  const set_open = openControlled ? onOpenChange! : setInternalOpen;

  const visibleItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  const handleLinkClick = () => {
    set_open(false);
  };

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  if (!user || visibleItems.length === 0) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <Sheet open={is_open} onOpenChange={set_open}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10">
            <Menu className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-6 pb-4">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <nav
            className="flex flex-col gap-1 px-4 pb-6"
            aria-label="Mobile navigation"
          >
            {visibleItems.map((item, index) => {
              if (item.separator) {
                return (
                  <div
                    key={`separator-${index}`}
                    className="my-2 border-t border-gray-200 dark:border-gray-700"
                    aria-hidden="true"
                  />
                );
              }
              if (item.sectionHeader) {
                return (
                  <div
                    key={`section-${index}`}
                    className="my-2 px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide"
                    role="presentation"
                  >
                    {item.sectionHeader}
                  </div>
                );
              }

              // Item with children (collapsible group)
              if (item.children) {
                const isOpen = openGroups.has(item.label);
                const visibleChildren = item.children.filter((child) =>
                  child.roles.includes(user.role)
                );
                if (visibleChildren.length === 0) return null;

                return (
                  <Collapsible
                    key={item.label}
                    open={isOpen}
                    onOpenChange={() => toggleGroup(item.label)}
                    className="group"
                  >
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                      <span className="flex items-center gap-3">
                        {item.icon && <item.icon className="w-5 h-5" aria-hidden="true" />}
                        <span className="font-medium">{item.label}</span>
                      </span>
                      {isOpen ? (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-8 pr-2 py-1 space-y-1">
                      {visibleChildren.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to!}
                          onClick={handleLinkClick}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                              isActive
                                ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium"
                                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`
                          }
                        >
                          <span>{child.label}</span>
                        </NavLink>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              }

              // Single link item
              if (!item.to) return null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={handleLinkClick}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                      isActive
                        ? "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                >
                  {item.icon && typeof item.icon !== "string" && (
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
```

**Step 4: Build to verify TypeScript compilation**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 5: Commit**

```bash
git add src/components/layout/MobileNav.tsx
git commit -m "feat: add collapsible grouped navigation to MobileNav"
```

---

## Task 5: Manual Verification Testing

**Files:**
- Test: Manual browser testing

**Step 1: Start development server**

Run: `npm run dev:all`
Expected: Server starts on http://localhost:5173

**Step 2: Test desktop navigation**

1. Login as admin@lagunahills.com / admin123
2. Verify horizontal navigation appears between logo and user controls
3. Test each dropdown:
   - Click "Community" - should show Announcements, Events, Polls
   - Click "Resources" - should show Documents, Help
   - Click "Payments" - should show My Payments, Make Payment
   - Click "Passes & IDs" - should show Vehicle Passes, Employee IDs
   - Click "Services" - should show Service Requests, Common Areas
4. Verify single links work: Dashboard, Map, Reservations

**Step 3: Test mobile navigation**

1. Resize browser to mobile width (< 1024px)
2. Click hamburger menu
3. Verify collapsible groups appear with chevron icons
4. Test each group expands/collapses on click
5. Verify submenu items are indented
6. Verify all links navigate correctly

**Step 4: Test role-based filtering**

1. Login as resident@lagunahills.com / resident123
2. Verify admin-only items (Common Areas, Employee IDs) are hidden
3. Verify all resident-accessible items appear

**Step 5: Test keyboard navigation**

1. Tab through navigation items
2. Verify focus states are visible
3. Press Enter on dropdown triggers
4. Use arrow keys within dropdowns
5. Press Escape to close dropdowns

**Step 6: Commit (if any fixes needed)**

```bash
# If any issues found and fixed:
git add -A
git commit -m "fix: address navigation issues found during testing"
```

---

**End of Implementation Plan**

Total tasks: 5
Estimated time: 60-90 minutes

**Verification Checklist:**
- [ ] Desktop navigation appears on large screens (≥1024px)
- [ ] All dropdowns expand/collapse correctly
- [ ] Mobile navigation uses collapsible groups
- [ ] Role-based filtering works for all user types
- [ ] Keyboard navigation works (Tab, Enter, Escape, Arrow keys)
- [ ] All links navigate to correct routes
- [ ] ARIA labels present for accessibility
- [ ] No TypeScript compilation errors
- [ ] No console errors during runtime
