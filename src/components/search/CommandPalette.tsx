import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "cmdk";
import {
  Search,
  Users,
  Home,
  MapPin,
  FileText,
  Calendar,
  CreditCard,
  Wrench,
  Settings,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface SearchResult {
  id: string;
  type: "user" | "household" | "lot" | "page";
  label: string;
  sublabel?: string;
  route?: string;
}

const pages = [
  { id: "dashboard", label: "Dashboard", icon: Home, route: "/dashboard" },
  { id: "my-lots", label: "My Lots", icon: Home, route: "/my-lots" },
  { id: "map", label: "Map", icon: MapPin, route: "/map" },
  {
    id: "announcements",
    label: "Announcements",
    icon: FileText,
    route: "/announcements",
  },
  { id: "events", label: "Events", icon: Calendar, route: "/events" },
  { id: "polls", label: "Polls", icon: FileText, route: "/polls" },
  { id: "documents", label: "Documents", icon: FileText, route: "/documents" },
  { id: "help", label: "Help", icon: FileText, route: "/help" },
  {
    id: "reservations",
    label: "Reservations",
    icon: Calendar,
    route: "/reservations",
  },
  { id: "payments", label: "Payments", icon: CreditCard, route: "/payments" },
  { id: "passes", label: "Vehicle Passes", icon: Settings, route: "/passes" },
  {
    id: "service-requests",
    label: "Service Requests",
    icon: Wrench,
    route: "/service-requests",
  },
  { id: "messages", label: "Messages", icon: FileText, route: "/messages" },
  {
    id: "notifications",
    label: "Notifications",
    icon: FileText,
    route: "/notifications",
  },
  {
    id: "account",
    label: "Account Settings",
    icon: Settings,
    route: "/account",
  },
];

const adminPages = [
  { id: "admin", label: "Admin Dashboard", icon: Settings, route: "/admin" },
  // Users & Access
  {
    id: "admin-users",
    label: "Users",
    icon: Users,
    route: "/admin/users",
  },
  {
    id: "admin-board-members",
    label: "Board Members",
    icon: Users,
    route: "/admin/users?tab=board-members",
  },
  {
    id: "admin-pre-approved",
    label: "Pre-Approved Users",
    icon: Users,
    route: "/admin/pre-approved",
  },
  {
    id: "admin-member-approvals",
    label: "Household Approvals",
    icon: Users,
    route: "/admin/member-approvals",
  },
  // Properties
  {
    id: "admin-lots",
    label: "Property Map",
    icon: MapPin,
    route: "/admin/lots",
  },
  {
    id: "admin-lot-members",
    label: "Lot Management",
    icon: Home,
    route: "/admin/lot-members",
  },
  {
    id: "admin-common-areas",
    label: "Common Areas",
    icon: MapPin,
    route: "/admin/common-areas",
  },
  // Reservations
  {
    id: "admin-reservations-all",
    label: "All Reservations",
    icon: Calendar,
    route: "/admin/reservations/all-bookings",
  },
  {
    id: "admin-reservations-blocks",
    label: "Time Blocks",
    icon: Calendar,
    route: "/admin/reservations/time-blocks",
  },
  {
    id: "admin-reservations-pricing",
    label: "Reservation Pricing",
    icon: Calendar,
    route: "/admin/reservations/pricing",
  },
  // Communications
  {
    id: "admin-announcements",
    label: "Announcements",
    icon: FileText,
    route: "/admin/announcements",
  },
  {
    id: "admin-notifications",
    label: "Notifications",
    icon: FileText,
    route: "/admin/notifications",
  },
  {
    id: "admin-messages",
    label: "Messages",
    icon: FileText,
    route: "/admin/messages",
  },
  // Financials
  {
    id: "admin-payments",
    label: "Payment Records",
    icon: CreditCard,
    route: "/admin/payments",
  },
  {
    id: "admin-dues-settings",
    label: "Dues Settings",
    icon: CreditCard,
    route: "/admin/dues-settings",
  },
  {
    id: "admin-verification-queue",
    label: "Verification Queue",
    icon: CreditCard,
    route: "/admin/verification-queue",
  },
  // System
  {
    id: "admin-pass-management",
    label: "Pass Management",
    icon: Settings,
    route: "/admin/pass-management",
  },
  {
    id: "admin-settings",
    label: "System Settings",
    icon: Settings,
    route: "/admin/settings",
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  // Detect platform for correct keyboard shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!search.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      const searchResults: SearchResult[] = [];
      const query = search.toLowerCase();

      // Add matching pages
      const allPages =
        user?.role === "admin" ? [...pages, ...adminPages] : pages;
      allPages.forEach((page) => {
        if (page.label.toLowerCase().includes(query)) {
          searchResults.push({
            id: page.id,
            type: "page",
            label: page.label,
            route: page.route,
          });
        }
      });

      // Search for users, households, and lots if user is admin
      if (user?.role === "admin") {
        try {
          // Search users (max 10 results)
          const usersRes = await api.admin.listUsers();
          if (usersRes.data?.users) {
            let userCount = 0;
            const maxResults = 10;
            for (const u of usersRes.data.users) {
              if (userCount >= maxResults) break;
              if (
                u.email.toLowerCase().includes(query) ||
                (u.household_addresses &&
                  u.household_addresses.toLowerCase().includes(query))
              ) {
                searchResults.push({
                  id: u.id,
                  type: "user",
                  label: u.email,
                  sublabel: u.household_addresses || u.role,
                  route: `/admin`,
                });
                userCount++;
              }
            }
          }

          // Search households (max 10 results)
          const householdsRes = await api.admin.listHouseholds();
          if (householdsRes.data?.households) {
            let householdCount = 0;
            const maxResults = 10;
            for (const h of householdsRes.data.households) {
              if (householdCount >= maxResults) break;
              if (
                h.address.toLowerCase().includes(query) ||
                (h.street && h.street.toLowerCase().includes(query)) ||
                (h.lot && h.lot.toLowerCase().includes(query)) ||
                (h.block && h.block.toLowerCase().includes(query))
              ) {
                searchResults.push({
                  id: h.id,
                  type: "household",
                  label: h.address,
                  sublabel: `${h.street ? h.street + ", " : ""}Block ${h.block || "N/A"}, Lot ${h.lot || "N/A"}`,
                  route: `/admin`,
                });
                householdCount++;
              }
            }
          }

          // Search lots (max 10 results)
          const lotsRes = await api.admin.getLotsWithOwnership();
          if (lotsRes.data?.lots) {
            let lotCount = 0;
            const maxResults = 10;
            for (const lot of lotsRes.data.lots) {
              if (lotCount >= maxResults) break;
              if (
                lot.lot_number?.toLowerCase().includes(query) ||
                lot.block_number?.toLowerCase().includes(query) ||
                lot.address?.toLowerCase().includes(query) ||
                (lot.owner_name && lot.owner_name.toLowerCase().includes(query))
              ) {
                searchResults.push({
                  id: lot.lot_id,
                  type: "lot",
                  label:
                    lot.address ||
                    `Block ${lot.block_number}, Lot ${lot.lot_number}`,
                  sublabel: lot.owner_name || "Unassigned",
                  route: `/admin/lots`,
                });
                lotCount++;
              }
            }
          }
        } catch (error) {
          // Silently fail - search errors shouldn't expose information to users
          console.warn("Search functionality temporarily unavailable");
        }
      }

      setResults(searchResults);
      setLoading(false);
    };

    const debounceTimer = setTimeout(performSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [search, user]);

  const handleSelect = (result: SearchResult) => {
    if (result.route) {
      navigate(result.route);
      setOpen(false);
      setSearch("");
      setResults([]);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 rounded-md border border-input hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Search className="h-4 w-4" />
        <span>Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          {shortcutKey}K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        overlayClassName="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        contentClassName="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"
      >
        <CommandInput
          placeholder="Type a command or search..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching..." : "No results found."}
          </CommandEmpty>

          {results.length > 0 && (
            <>
              <CommandGroup heading="Pages">
                {results
                  .filter((r) => r.type === "page")
                  .map((result) => {
                    const page = [
                      ...pages,
                      ...(user?.role === "admin" ? adminPages : []),
                    ].find((p) => p.id === result.id);
                    const Icon = page?.icon || Search;
                    return (
                      <CommandItem
                        key={result.id}
                        value={result.id}
                        onSelect={() => handleSelect(result)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        <span>{result.label}</span>
                      </CommandItem>
                    );
                  })}
              </CommandGroup>

              {user?.role === "admin" && (
                <>
                  <CommandGroup heading="Users">
                    {results
                      .filter((r) => r.type === "user")
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleSelect(result)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.label}</span>
                            {result.sublabel && (
                              <span className="text-xs text-muted-foreground">
                                {result.sublabel}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>

                  <CommandGroup heading="Households">
                    {results
                      .filter((r) => r.type === "household")
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleSelect(result)}
                        >
                          <Home className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.label}</span>
                            {result.sublabel && (
                              <span className="text-xs text-muted-foreground">
                                {result.sublabel}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>

                  <CommandGroup heading="Lots">
                    {results
                      .filter((r) => r.type === "lot")
                      .map((result) => (
                        <CommandItem
                          key={result.id}
                          value={result.id}
                          onSelect={() => handleSelect(result)}
                        >
                          <MapPin className="mr-2 h-4 w-4" />
                          <div className="flex flex-col">
                            <span>{result.label}</span>
                            {result.sublabel && (
                              <span className="text-xs text-muted-foreground">
                                {result.sublabel}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
