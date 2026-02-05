import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  HomeIcon,
  MapIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  CreditCardIcon,
  DocumentIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CogIcon,
} from "@heroicons/react/24/outline";

const navItems = [
  {
    to: "/dashboard",
    icon: HomeIcon,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/map",
    icon: MapIcon,
    label: "Subdivision Map",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/service-requests",
    icon: ClipboardDocumentListIcon,
    label: "Service Requests",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/reservations",
    icon: CalendarIcon,
    label: "Amenity Reservations",
    roles: ["admin", "resident", "guest"],
  },
  {
    to: "/payments",
    icon: CreditCardIcon,
    label: "Payments",
    roles: ["admin", "resident"],
  },
  {
    to: "/documents",
    icon: DocumentIcon,
    label: "Documents",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/announcements",
    icon: ChatBubbleLeftRightIcon,
    label: "Announcements",
    roles: ["admin", "resident", "staff", "guest"],
  },
  {
    to: "/polls",
    icon: ChartBarIcon,
    label: "Polls",
    roles: ["admin", "resident", "staff", "guest"],
  },
  { to: "/admin", icon: CogIcon, label: "Admin Panel", roles: ["admin"] },
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
