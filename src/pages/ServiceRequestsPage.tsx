import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, ServiceRequestsResponse } from "@/lib/api";
import { format } from "date-fns";
import { Plus, Filter } from "lucide-react";
import { labels } from "@/lib/content/labels";
import { messages } from "@/lib/content/messages";
import type {
  ServiceRequestStatus,
  ServiceRequestPriority,
  ServiceRequestCategory,
} from "@/types";

const statusColors: Record<ServiceRequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  "in-progress": "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const priorityColors: Record<ServiceRequestPriority, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
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

  const isAdmin = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    loadRequests();
  }, [filters]);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {labels.serviceRequests}
        </h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="w-5 h-5" />
          {labels.newRequest}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-5 h-5" />
          {labels.filter}
        </button>

        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{labels.all}</option>
                <option value="pending">{labels.pending}</option>
                <option value="in-progress">{labels.inProgress}</option>
                <option value="completed">{labels.completed}</option>
                <option value="rejected">{labels.rejected}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">{labels.all}</option>
                <option value="low">{labels.low}</option>
                <option value="normal">{labels.normal}</option>
                <option value="high">{labels.high}</option>
                <option value="urgent">{labels.urgent}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
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
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {requests?.requests && requests.requests.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {requests.requests.map((request) => (
              <div key={request.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[request.status]}`}
                      >
                        {request.status}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[request.priority]}`}
                      >
                        {request.priority}
                      </span>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                        {categoryLabels[request.category]}
                      </span>
                    </div>
                    <p className="text-gray-900 font-medium">
                      {request.description}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Request ID: {request.id.slice(0, 8)}... •{" "}
                      {format(
                        new Date(request.created_at),
                        "MMM d, yyyy h:mm a",
                      )}
                    </p>
                    {request.completed_at && (
                      <p className="text-sm text-green-600 mt-1">
                        Completed on{" "}
                        {format(new Date(request.completed_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  {isAdmin && (
                    <div className="ml-4 flex gap-2">
                      <button className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                        {labels.view}
                      </button>
                      <button className="px-3 py-1 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                        {labels.update}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            {messages.noRequestsFound}
          </div>
        )}
      </div>
    </div>
  );
}
