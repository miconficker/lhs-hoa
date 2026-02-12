import { useState } from "react";
import { api } from "@/lib/api";
import {
  paymentsToCSV,
  downloadCSV,
  generateExportFilename,
} from "@/lib/paymentExport";
import { Download, FileText } from "lucide-react";
import { logger } from "@/lib/logger";

interface ExportFilters {
  start_date?: string;
  end_date?: string;
  payment_type?: string;
  status?: string;
  method?: string;
}

export function PaymentExport() {
  const [filters, setFilters] = useState<ExportFilters>({});
  const [isExporting, setIsExporting] = useState(false);
  const [exportCount, setExportCount] = useState<number | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportCount(null);

    try {
      const response = await api.admin.exportPayments(filters);

      if (response.error || !response.data) {
        alert(response.error || "Failed to export payments");
        return;
      }

      const payments = response.data.payments;
      setExportCount(payments.length);

      if (payments.length === 0) {
        alert("No payments found matching the selected filters");
        return;
      }

      // Convert to CSV and download
      const csvContent = paymentsToCSV(payments);
      const filename = generateExportFilename("payments");
      downloadCSV(csvContent, filename);
    } catch (error) {
      logger.error("Export error", error, { component: "PaymentExport" });
      alert("Failed to export payments");
    } finally {
      setIsExporting(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({});
    setExportCount(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold text-gray-900">
          Export Payment History
        </h3>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={filters.start_date || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  start_date: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={filters.end_date || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  end_date: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Type
            </label>
            <select
              value={filters.payment_type || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  payment_type: e.target.value || undefined,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="dues">HOA Dues</option>
              <option value="vehicle_pass">Vehicle Pass</option>
              <option value="employee_id">Employee ID</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || ""}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value || undefined })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={filters.method || ""}
              onChange={(e) =>
                setFilters({ ...filters, method: e.target.value || undefined })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="gcash">GCash</option>
              <option value="paymaya">PayMaya</option>
              <option value="instapay">InstaPay</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        {/* Active Filters Display */}
        {Object.keys(filters).length > 0 &&
          Object.values(filters).some((v) => v !== undefined && v !== "") && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Active filters:</span>
              <div className="flex flex-wrap gap-1">
                {filters.start_date && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    From {filters.start_date}
                  </span>
                )}
                {filters.end_date && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    To {filters.end_date}
                  </span>
                )}
                {filters.payment_type && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    {filters.payment_type === "dues"
                      ? "HOA Dues"
                      : filters.payment_type === "vehicle_pass"
                        ? "Vehicle Pass"
                        : "Employee ID"}
                  </span>
                )}
                {filters.status && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                    {filters.status}
                  </span>
                )}
                {filters.method && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs capitalize">
                    {filters.method.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </button>
        <button
          onClick={handleClearFilters}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Clear Filters
        </button>
        {exportCount !== null && (
          <span className="text-sm text-gray-600">
            Exported {exportCount} payment{exportCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          Export Details
        </h4>
        <p className="text-sm text-blue-800 mb-2">
          The CSV file will include the following columns:
        </p>
        <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
          <li>Payment ID, Household ID, Amount, Currency</li>
          <li>Method, Status, Reference Number, Period</li>
          <li>Payment Type, Late Fee Amount, Late Fee Months</li>
          <li>Received By, Created At, Paid At</li>
        </ul>
      </div>
    </div>
  );
}
