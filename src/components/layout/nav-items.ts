import {
  Home,
  Map,
  CreditCard,
  Megaphone,
  FileText,
  Wrench,
  Settings,
  MessageSquare,
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
  badgeKey?: keyof UserNotificationCounts;
}

// Import type for badge keys
interface UserNotificationCounts {
  unreadNotifications: number;
  unreadMessages: number;
}

export const navItems: NavItem[] = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    label: "My Property",
    icon: Building2,
    roles: ["admin", "resident"],
    children: [
      {
        to: "/my-lots",
        label: "My Lots",
        roles: ["admin", "resident"],
      },
      {
        to: "/map",
        label: "Map",
        roles: ["admin", "resident", "staff"],
      },
    ],
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
    label: "Services",
    icon: Wrench,
    roles: ["admin", "resident", "staff", "guest"],
    children: [
      {
        to: "/reservations",
        label: "Reservations",
        roles: ["admin", "resident", "guest"],
      },
      {
        to: "/service-requests",
        label: "Service Requests",
        roles: ["admin", "resident", "staff"],
      },
      {
        label: "Passes & IDs",
        to: "/passes",
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
    ],
  },
  {
    to: "/payments",
    icon: CreditCard,
    label: "Payments",
    roles: ["admin", "resident"],
  },
  {
    label: "Communications",
    icon: MessageSquare,
    roles: ["admin", "resident", "staff"],
    children: [
      {
        to: "/messages",
        label: "Messages",
        roles: ["admin", "resident", "staff"],
        badgeKey: "unreadMessages",
      },
      {
        to: "/notifications",
        label: "Notifications",
        roles: ["admin", "resident", "staff"],
        badgeKey: "unreadNotifications",
      },
    ],
  },
  {
    label: "Resources",
    icon: FileText,
    roles: ["admin", "resident", "staff", "guest"],
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
    to: "/account",
    icon: Settings,
    label: "Account",
    roles: ["admin", "resident", "staff", "guest"],
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
