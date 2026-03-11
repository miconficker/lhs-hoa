import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { StatusBadge } from "@/components/ui/status-badge";
import { Callout } from "@/components/ui/callout";
import { IconContainer } from "@/components/ui/icon-container";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Home,
  ClipboardList,
  Calendar,
  CreditCard,
  Badge,
  FileText,
  AlertTriangle,
} from "lucide-react";

interface QuickActionProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

function QuickAction({ to, icon: Icon, label, description }: QuickActionProps) {
  // We need to wrap the component to match IconContainer's expected type
  const IconWrapper = Icon as React.ComponentType<{ className?: string }>;
  return (
    <Link
      to={to}
      className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-accent transition-colors"
    >
      <div className="p-2 bg-primary/10 rounded-lg">
        <IconWrapper className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-medium text-card-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [myLots, setMyLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      // Load user's dashboard data
      const [announcementsRes, lotsRes] = await Promise.all([
        api.announcements.list(),
        api.households.getMyLots(),
      ]);

      if (announcementsRes.data?.announcements) {
        setAnnouncements(announcementsRes.data.announcements.slice(0, 3));
      }
      if (lotsRes.data?.lots) {
        setMyLots(lotsRes.data.lots);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Check if user has lots
  const hasLots = myLots && myLots.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome Home</h1>
          <p className="text-muted-foreground mt-1">
            {user?.first_name
              ? `${user.first_name} ${user.last_name || ""}`
              : user?.email}
          </p>
        </div>
      </div>

      {/* My Properties Section */}
      {hasLots ? (
        <div className="bg-card rounded-lg shadow">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                My Properties
              </h2>
              <Link
                to="/my-lots"
                className="text-sm text-primary hover:text-primary/80"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-border">
            {myLots.slice(0, 2).map((lot: any) => (
              <div key={lot.lot_id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <IconContainer icon={Home} variant="info" size="md" />
                    <div>
                      <p className="font-medium text-card-foreground">
                        {lot.address}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Block {lot.block_number}, Lot {lot.lot_number}
                      </p>
                    </div>
                  </div>
                  {lot.payment_status && (
                    <StatusBadge
                      variant={
                        lot.payment_status === "paid"
                          ? "success"
                          : lot.payment_status === "overdue"
                            ? "error"
                            : "warning"
                      }
                      srLabel={`Payment status: ${lot.payment_status}`}
                    >
                      {lot.payment_status}
                    </StatusBadge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Callout variant="info" title="No Properties Linked">
          Contact the HOA office to link your property to your account.
        </Callout>
      )}

      {/* Quick Actions */}
      <div className="bg-card rounded-lg shadow">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">
            Quick Actions
          </h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            to="/service-requests"
            icon={ClipboardList}
            label="Service Request"
            description="Report maintenance issues"
          />
          <QuickAction
            to="/reservations"
            icon={Calendar}
            label="Book Amenity"
            description="Reserve common areas"
          />
          <QuickAction
            to="/payments"
            icon={CreditCard}
            label="Pay Dues"
            description="View and pay HOA fees"
          />
          <QuickAction
            to="/passes"
            icon={Badge}
            label="My Passes"
            description="Manage vehicle & ID passes"
          />
        </div>
      </div>

      {/* Recent Announcements */}
      {announcements.length > 0 && (
        <div className="bg-card rounded-lg shadow">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-card-foreground">
                Recent Announcements
              </h2>
              <Link
                to="/announcements"
                className="text-sm text-primary hover:text-primary/80"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-border">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="p-6">
                <div className="flex items-start gap-3">
                  {announcement.is_pinned && (
                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-card-foreground">
                      {announcement.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {announcement.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {format(new Date(announcement.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Resources */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/documents"
          className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <IconContainer icon={FileText} variant="muted" size="md" />
          <div>
            <p className="font-medium text-card-foreground">Documents</p>
            <p className="text-sm text-muted-foreground">Rules & forms</p>
          </div>
        </Link>
        <Link
          to="/map"
          className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <IconContainer icon={Home} variant="success" size="md" />
          <div>
            <p className="font-medium text-card-foreground">Community Map</p>
            <p className="text-sm text-muted-foreground">View subdivision</p>
          </div>
        </Link>
        <Link
          to="/help"
          className="flex items-center gap-3 p-4 border border-border rounded-lg hover:bg-accent transition-colors"
        >
          <IconContainer icon={FileText} variant="warning" size="md" />
          <div>
            <p className="font-medium text-card-foreground">Help & Support</p>
            <p className="text-sm text-muted-foreground">Get assistance</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
