import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  Map,
  ClipboardList,
  Calendar,
  CreditCard,
  FileText,
  MessageSquare,
  BarChart,
  Settings,
  Edit3,
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
    to: "/annotate",
    icon: Edit3,
    label: "Annotate Lots",
    roles: ["admin"],
  },
  { to: "/admin", icon: Settings, label: "Admin Panel", roles: ["admin"] },
];

export function Sidebar() {
  const { user } = useAuth();

  const visibleItems = user
    ? navItems.filter((item) => item.roles.includes(user.role))
    : [];

  if (!user || visibleItems.length === 0) {
    return null;
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary-50 text-primary-700 font-medium"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
