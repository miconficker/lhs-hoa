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
  MessageSquare,
  Bell,
  Building2,
  type LucideIcon,
} from "lucide-react";

export type Role = "admin" | "resident" | "staff" | "guest";

export interface NavItem {
  label: string;
  to?: string;
  icon?: LucideIcon;
  roles: Role[];
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/my-lots",
    icon: Building2,
    label: "My Lots",
    roles: ["admin", "resident"],
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
      {
        to: "/passes",
        label: "Vehicle Passes",
        roles: ["admin", "resident"],
      },
      {
        to: "/passes?type=employee",
        label: "Employee IDs",
        roles: ["admin"],
      },
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
      {
        to: "/admin/common-areas",
        label: "Common Areas",
        roles: ["admin"],
      },
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
  {
    to: "/admin",
    icon: Settings,
    label: "Admin Panel",
    roles: ["admin"],
  },
];

/** The 4 items pinned in BottomNav */
export const bottomNavItems: NavItem[] = [
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
    icon: Wrench,
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
