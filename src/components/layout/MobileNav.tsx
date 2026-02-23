import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  Trees,
  Badge,
  UserCheck,
  Home as HomeIcon,
} from "lucide-react";

const navItems = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/map",
    icon: Map,
    label: "Subdivision Map",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/service-requests",
    icon: ClipboardList,
    label: "Service Requests",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/reservations",
    icon: Calendar,
    label: "Amenity Reservations",
    roles: ["admin", "resident", "guest"],
  },
  {
    to: "/my-lots",
    icon: HomeIcon,
    label: "My Lots",
    roles: ["admin", "resident"],
  },
  {
    to: "/passes",
    icon: Badge,
    label: "Passes",
    roles: ["admin", "resident"],
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    roles: ["admin", "resident"],
  },
  {
    to: "/documents",
    icon: FileText,
    label: "Documents",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/announcements",
    icon: MessageSquare,
    label: "Announcements",
    roles: ["admin", "resident", "staff", "guest"],
  },
  {
    to: "/polls",
    icon: BarChart,
    label: "Polls",
    roles: ["admin", "resident", "staff", "guest"],
  },
  {
    to: "/notifications",
    icon: Bell,
    label: "Notifications",
    roles: ["admin", "resident", "staff"],
  },
  { separator: true, roles: ["admin", "resident", "staff"] },
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
    to: "/admin/common-areas",
    icon: Trees,
    label: "Common Areas",
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
    icon: "Settings" as any,
    label: "Admin Panel",
    roles: ["admin"],
  },
];

interface MobileNavProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MobileNav({ isOpen, onOpenChange }: MobileNavProps) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const openControlled = isOpen !== undefined;
  const is_open = openControlled ? isOpen : internalOpen;
  const set_open = openControlled ? onOpenChange! : setInternalOpen;

  const visibleItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  const handleLinkClick = () => {
    set_open(false);
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
