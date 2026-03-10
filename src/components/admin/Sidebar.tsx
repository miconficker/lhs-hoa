import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Home,
  Calendar,
  MessageSquare,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Users & Access",
    href: "/admin/users",
    icon: Users,
    children: [
      { title: "Users", href: "/admin/users", icon: Users },
      {
        title: "Board Members",
        href: "/admin/users?tab=board-members",
        icon: Users,
      },
      { title: "Pre-Approved", href: "/admin/pre-approved", icon: Users },
    ],
  },
  {
    title: "Properties",
    href: "/admin/lots",
    icon: Home,
    children: [
      { title: "Lots", href: "/admin/lots", icon: Home },
      { title: "Common Areas", href: "/admin/common-areas", icon: Home },
    ],
  },
  {
    title: "Reservations",
    href: "/admin/reservations",
    icon: Calendar,
    children: [
      {
        title: "All Bookings",
        href: "/admin/reservations/all-bookings",
        icon: Calendar,
      },
      {
        title: "Time Blocks",
        href: "/admin/reservations/time-blocks",
        icon: Calendar,
      },
      { title: "Pricing", href: "/admin/reservations/pricing", icon: Calendar },
    ],
  },
  {
    title: "Communications",
    href: "/admin/communications",
    icon: MessageSquare,
    children: [
      {
        title: "Announcements",
        href: "/admin/announcements",
        icon: MessageSquare,
      },
      {
        title: "Notifications",
        href: "/admin/notifications",
        icon: MessageSquare,
      },
      { title: "Messages", href: "/admin/messages", icon: MessageSquare },
    ],
  },
  {
    title: "Financials",
    href: "/admin/financials",
    icon: DollarSign,
    children: [
      { title: "Payments", href: "/admin/payments", icon: DollarSign },
      {
        title: "Dues Settings",
        href: "/admin/dues-settings",
        icon: DollarSign,
      },
      {
        title: "Verification Queue",
        href: "/admin/verification-queue",
        icon: DollarSign,
      },
    ],
  },
  {
    title: "System",
    href: "/admin/system",
    icon: Settings,
    children: [
      {
        title: "Pass Management",
        href: "/admin/pass-management",
        icon: Settings,
      },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["reservations"]),
  );

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const isActive = (href: string) => {
    return (
      location.pathname === href || location.pathname.startsWith(href + "/")
    );
  };

  const isSectionActive = (item: NavItem) => {
    if (isActive(item.href)) return true;
    if (item.children) {
      return item.children.some((child) => isActive(child.href));
    }
    return false;
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 transform border-r bg-background transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Admin navigation sidebar"
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <Link to="/admin" className="flex items-center space-x-2">
              <Home className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">HOA Admin</span>
            </Link>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-accent lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav
            className="flex-1 overflow-y-auto p-4"
            aria-label="Main navigation"
          >
            <ul className="space-y-1" role="list">
              {navItems.map((item) => (
                <li key={item.href}>
                  {item.children ? (
                    <div>
                      <button
                        onClick={() => toggleSection(item.title)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isSectionActive(item)
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                        aria-expanded={expandedSections.has(item.title)}
                        aria-controls={`submenu-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className="h-4 w-4" aria-hidden="true" />
                          {item.title}
                        </span>
                        {expandedSections.has(item.title) ? (
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <ChevronRight
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                      {expandedSections.has(item.title) && (
                        <ul
                          id={`submenu-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                          className="ml-6 mt-1 space-y-1"
                          role="list"
                        >
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                to={child.href}
                                onClick={() => {
                                  if (window.innerWidth < 1024) {
                                    onClose();
                                  }
                                }}
                                className={cn(
                                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                  isActive(child.href)
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                )}
                                aria-current={
                                  isActive(child.href) ? "page" : undefined
                                }
                              >
                                <child.icon
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                                {child.title}
                                {child.badge !== undefined &&
                                  child.badge > 0 && (
                                    <span
                                      className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                                      aria-label={`${child.badge} items`}
                                    >
                                      {child.badge}
                                    </span>
                                  )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024) {
                          onClose();
                        }
                      }}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive(item.href)
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )}
                      aria-current={isActive(item.href) ? "page" : undefined}
                    >
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      {item.title}
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground"
                          aria-label={`${item.badge} items`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Back to Resident Portal
            </Link>
          </div>
        </div>
      </aside>
    </>
  );
}
