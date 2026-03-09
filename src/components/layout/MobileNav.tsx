import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Menu, ChevronRight, ChevronDown } from "lucide-react";
import { useState } from "react";
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
  Calendar,
  CreditCard,
  FileText,
  MessageSquare,
  Bell,
  Building2,
  DollarSign,
  Receipt,
  Badge,
  UserCheck,
  Megaphone,
  Settings,
  CarFront,
  Wrench,
} from "lucide-react";

interface NavItem {
  label?: string;
  icon?: any;
  to?: string;
  roles: string[];
  children?: NavItem[];
  separator?: boolean;
  sectionHeader?: string;
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
                if (!item.label) return null;
                const isOpen = openGroups.has(item.label);
                const visibleChildren = item.children.filter((child) =>
                  child.roles.includes(user.role),
                );
                if (visibleChildren.length === 0) return null;

                return (
                  <Collapsible
                    key={item.label}
                    open={isOpen}
                    onOpenChange={() => toggleGroup(item.label!)}
                    className="group"
                  >
                    <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:bg-gray-100 dark:hover:bg-gray-800">
                      <span className="flex items-center gap-3">
                        {item.icon && (
                          <item.icon className="w-5 h-5" aria-hidden="true" />
                        )}
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
