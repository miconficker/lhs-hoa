import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { MyLotsSummary } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export function MyLotsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyLotsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMyLots();
  }, []);

  async function loadMyLots() {
    setLoading(true);
    try {
      const result = await api.households.getMyLots();
      if (result.data) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Error loading my lots:", error);
    }
    setLoading(false);
  }

  if (!user) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
        Please log in to view your lots.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        Failed to load your lots. Please try again.
      </div>
    );
  }

  const { lots, ...summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Lots</h1>
        <p className="text-sm text-gray-500 mt-1">
          View your lots, track dues, and check voting status
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">Total Properties</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.total_properties ?? summary.total_lots}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-gray-500">Total Lots</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.total_lots}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-gray-500">Total Area</p>
            <p className="text-3xl font-bold text-gray-900">
              {summary.total_sqm.toLocaleString()} m²
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-gray-500">Annual Dues</p>
            <p className="text-3xl font-bold text-gray-900">
              ₱{summary.annual_dues_total.toLocaleString()}
            </p>
            <p className="text-xs text-gray-400">
              ₱{summary.rate_per_sqm} per sqm
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-gray-500">Voting Status</p>
            <div className="flex items-center gap-2">
              {summary.voting_status === "eligible" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Eligible
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-700">
                    Suspended
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Unpaid Periods Warning */}
        {summary.unpaid_periods.length > 0 && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="font-semibold text-red-700">
                Unpaid Dues - Voting Suspended
              </span>
            </div>
            <p className="text-sm text-red-600">
              You have unpaid dues for: {summary.unpaid_periods.join(", ")}.
              Please pay to restore your voting rights.
            </p>
            <button
              onClick={() => (window.location.href = "/payments")}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              Pay Now
            </button>
          </div>
        )}
      </div>

      {/* Lots List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Your Lots ({lots.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Block
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Lot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Size (m²)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Annual Dues
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lots.map((lot) => (
                <tr key={lot.lot_id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lot.block || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {lot.lot || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium rounded">
                      {lot.lot_type === "resort"
                        ? "bg-purple-100 text-purple-700"
                        : lot.lot_type === "commercial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-green-100 text-green-700"}
                      {lot.lot_type === "residential"
                        ? "Residential"
                        : lot.lot_type === "resort"
                          ? "Resort"
                          : "Commercial"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        lot.lot_status === "built"
                          ? "bg-green-100 text-green-700"
                          : lot.lot_status === "under_construction"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {lot.lot_status === "built"
                        ? "Built"
                        : lot.lot_status === "under_construction"
                          ? "Under Construction"
                          : "Vacant Lot"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {lot.lot_size_sqm?.toLocaleString() || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ₱{lot.annual_dues.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <InfoIcon className="w-6 h-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900">
              About Your Lots
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              This page shows all lots registered to your account. Annual dues
              are calculated based on lot size (₱{summary.rate_per_sqm} per
              square meter).
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Voting: 1 lot = 1 vote. If you own multiple lots, your single vote
              counts for all your lots.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 16h-1v-4h-1m1-4h-1m1 4v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
