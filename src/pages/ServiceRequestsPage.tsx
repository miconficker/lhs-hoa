import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ServiceRequestsResponse } from "@/lib/api";
import { format } from "date-fns";
import { Plus, Filter } from "lucide-react";
import { labels } from "@/lib/content/labels";
import { messages } from "@/lib/content/messages";
import { StatusBadge } from "@/components/ui/status-badge";
import { Callout } from "@/components/ui/callout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import type {
  ServiceRequestStatus,
  ServiceRequestPriority,
  ServiceRequestCategory,
} from "@/types";

const statusVariant: Record<
  ServiceRequestStatus,
  "success" | "warning" | "error" | "info" | "neutral"
> = {
  pending: "warning",
  "in-progress": "info",
  completed: "success",
  rejected: "error",
};

const priorityVariant: Record<
  ServiceRequestPriority,
  "success" | "warning" | "error" | "info" | "neutral"
> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "error",
};

const categoryLabels: Record<ServiceRequestCategory, string> = {
  plumbing: labels.plumbing,
  electrical: labels.electrical,
  "common-area": labels.commonArea,
  security: labels.security,
  other: labels.other,
};

export function ServiceRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequestsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<{
    status?: string;
    priority?: string;
    category?: string;
  }>({});
  const [showFilters, setShowFilters] = useState(false);
  const [userHouseholdId, setUserHouseholdId] = useState<string>("");

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    loadUserHousehold();
  }, []);

  useEffect(() => {
    if (userHouseholdId) {
      loadRequests();
    }
  }, [filters, userHouseholdId]);

  async function loadUserHousehold() {
    if (!user) return;

    // Get user's household from lot_members
    const membershipsResult = await api.lotMembers.getMyMemberships();
    if (membershipsResult.data && membershipsResult.data.lots.length > 0) {
      setUserHouseholdId(membershipsResult.data.lots[0].household_id);
    }
  }

  async function loadRequests() {
    setLoading(true);
    setError("");

    const result = await api.serviceRequests.list(filters);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setRequests(result.data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Callout variant="error" title="Error">
        {error}
      </Callout>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          {labels.serviceRequests}
        </h1>
        <Button>
          <Plus className="w-5 h-5 mr-2" />
          {labels.newRequest}
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-lg shadow p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-card-foreground hover:text-card-foreground"
        >
          <Filter className="w-5 h-5" />
          {labels.filter}
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                {labels.status}
              </label>
              <select
                value={filters.status || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{labels.all}</option>
                <option value="pending">{labels.pending}</option>
                <option value="in-progress">{labels.inProgress}</option>
                <option value="completed">{labels.completed}</option>
                <option value="rejected">{labels.rejected}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                {labels.priority}
              </label>
              <select
                value={filters.priority || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    priority: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{labels.all}</option>
                <option value="low">{labels.low}</option>
                <option value="normal">{labels.normal}</option>
                <option value="high">{labels.high}</option>
                <option value="urgent">{labels.urgent}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                {labels.category}
              </label>
              <select
                value={filters.category || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    category: e.target.value || undefined,
                  })
                }
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{labels.all}</option>
                <option value="plumbing">{labels.plumbing}</option>
                <option value="electrical">{labels.electrical}</option>
                <option value="common-area">{labels.commonArea}</option>
                <option value="security">{labels.security}</option>
                <option value="other">{labels.other}</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Requests List */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        {requests?.requests && requests.requests.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {requests.requests.map((request) => (
              <div key={request.id} className="p-6 hover:bg-muted">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <StatusBadge
                        variant={statusVariant[request.status]}
                        srLabel={`Status: ${request.status}`}
                      >
                        {request.status}
                      </StatusBadge>
                      <StatusBadge
                        variant={priorityVariant[request.priority]}
                        srLabel={`Priority: ${request.priority}`}
                      >
                        {request.priority}
                      </StatusBadge>
                      <StatusBadge
                        variant="neutral"
                        srLabel={`Category: ${categoryLabels[request.category]}`}
                      >
                        {categoryLabels[request.category]}
                      </StatusBadge>
                    </div>
                    <p className="text-card-foreground font-medium">
                      {request.description}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Request ID: {request.id.slice(0, 8)}... •{" "}
                      {format(
                        new Date(request.created_at),
                        "MMM d, yyyy h:mm a",
                      )}
                    </p>
                    {request.completed_at && (
                      <p className="text-sm text-[hsl(var(--status-success-fg))] mt-1">
                        Completed on{" "}
                        {format(new Date(request.completed_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="ml-4 flex gap-2">
                      <Button variant="outline" size="sm">
                        {labels.view}
                      </Button>
                      <Button size="sm">{labels.update}</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            {messages.noRequestsFound}
          </div>
        )}
      </div>
    </div>
  );
}
