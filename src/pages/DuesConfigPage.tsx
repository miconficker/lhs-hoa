import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DuesRate } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import {
  DollarSign,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";

export function DuesConfigPage() {
  const { user } = useAuth();
  const [rates, setRates] = useState<DuesRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<DuesRate | null>(null);
  const [formData, setFormData] = useState({
    rate_per_sqm: "",
    year: new Date().getFullYear().toString(),
    effective_date: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    loadDuesRates();
  }, []);

  async function loadDuesRates() {
    setLoading(true);
    try {
      const result = await api.admin.getDuesRates();
      if (result.data) {
        setRates(result.data.dues_rates);
      }
    } catch (error) {
      logger.error("Error loading dues rates", error, {
        component: "DuesConfigPage",
      });
      showMessage("error", "Failed to load dues rates");
    }
    setLoading(false);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }

  function handleEdit(rate: DuesRate) {
    setEditingRate(rate);
    setFormData({
      rate_per_sqm: rate.rate_per_sqm.toString(),
      year: rate.year.toString(),
      effective_date: rate.effective_date.split("T")[0],
    });
    setShowForm(true);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingRate(null);
    setFormData({
      rate_per_sqm: "",
      year: new Date().getFullYear().toString(),
      effective_date: new Date().toISOString().split("T")[0],
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const ratePerSqm = parseFloat(formData.rate_per_sqm);
      const year = parseInt(formData.year);

      if (isNaN(ratePerSqm) || ratePerSqm <= 0) {
        showMessage("error", "Rate per sqm must be a positive number");
        setSaving(false);
        return;
      }

      if (isNaN(year) || year < 2000 || year > 2100) {
        showMessage("error", "Please enter a valid year");
        setSaving(false);
        return;
      }

      if (editingRate) {
        // Update existing rate
        const result = await api.admin.updateDuesRate(editingRate.id, {
          rate_per_sqm: ratePerSqm,
          year,
          effective_date: formData.effective_date,
        });
        if (result.data?.dues_rate) {
          showMessage("success", "Dues rate updated successfully");
          const updatedRate = result.data.dues_rate;
          const updatedRates = rates.map((r) =>
            r.id === editingRate.id ? updatedRate : r,
          );
          setRates(updatedRates);
        }
      } else {
        // Create new rate
        const result = await api.admin.createDuesRate({
          rate_per_sqm: ratePerSqm,
          year,
          effective_date: formData.effective_date,
        });
        if (result.data) {
          showMessage("success", "Dues rate created successfully");
          setRates([result.data.dues_rate, ...rates]);
        }
      }

      handleCancel();
    } catch (error: any) {
      logger.error("Error saving dues rate", error, {
        component: "DuesConfigPage",
      });
      showMessage("error", error.message || "Failed to save dues rate");
    }

    setSaving(false);
  }

  async function handleDelete(rate: DuesRate) {
    if (
      !confirm(
        `Are you sure you want to delete the dues rate for ${rate.year}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api.admin.deleteDuesRate(rate.id);
      showMessage("success", "Dues rate deleted successfully");
      setRates(rates.filter((r) => r.id !== rate.id));
    } catch (error: any) {
      logger.error("Error deleting dues rate", error, {
        component: "DuesConfigPage",
      });
      showMessage("error", error.message || "Failed to delete dues rate");
    }
  }

  // Get current active rate (most recent effective date)
  const currentRate = rates
    .filter((r) => new Date(r.effective_date) <= new Date())
    .sort(
      (a, b) =>
        new Date(b.effective_date).getTime() -
        new Date(a.effective_date).getTime(),
    )[0];

  if (!user || user.role !== "admin") {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
        Admin access required.
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Dues Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage monthly HOA dues rates per square meter
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add New Rate
          </button>
        )}
      </div>

      {/* Message Alert */}
      {message && (
        <div
          className={`p-4 rounded-lg border ${
            message.type === "success"
              ? "bg-green-50/50 border-green-200 text-green-700"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* Current Active Rate Card */}
      {currentRate && (
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Current Active Rate</h2>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              ₱{currentRate.rate_per_sqm.toLocaleString()}
            </span>
            <span className="text-blue-100">per sqm/month</span>
          </div>
          <p className="text-sm text-blue-100 mt-2">
            Effective since{" "}
            {new Date(currentRate.effective_date).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-card-foreground mb-4">
            {editingRate ? "Edit Dues Rate" : "Add New Dues Rate"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Year
              </label>
              <input
                type="number"
                min="2000"
                max="2100"
                required
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Monthly Rate per Square Meter (₱)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.rate_per_sqm}
                onChange={(e) =>
                  setFormData({ ...formData, rate_per_sqm: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., 5.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Effective Date
              </label>
              <input
                type="date"
                required
                value={formData.effective_date}
                onChange={(e) =>
                  setFormData({ ...formData, effective_date: e.target.value })
                }
                className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This rate will apply to all dues calculations from this date
                forward.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving
                  ? "Saving..."
                  : editingRate
                    ? "Update Rate"
                    : "Create Rate"}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2 border border-border text-card-foreground rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rates History Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-card-foreground">
            Rates History ({rates.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Monthly Rate (₱/sqm)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Effective Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-gray-200 dark:divide-gray-700">
              {rates.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm text-muted-foreground"
                  >
                    No dues rates configured yet. Click "Add New Rate" to get
                    started.
                  </td>
                </tr>
              ) : (
                rates.map((rate) => {
                  const isActive =
                    currentRate?.id === rate.id &&
                    new Date(rate.effective_date) <= new Date();
                  const isFuture = new Date(rate.effective_date) > new Date();

                  return (
                    <tr key={rate.id} className={isActive ? "bg-blue-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                        {rate.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground">
                        ₱{rate.rate_per_sqm.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(rate.effective_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            Active
                          </span>
                        ) : isFuture ? (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                            Future
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-card-foreground">
                            Historical
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={() => handleEdit(rate)}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDelete(rate)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-blue-900">
              About Dues Rates
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              The annual dues for each lot is calculated as:
              <code className="ml-1 px-1 py-0.5 bg-blue-100 rounded">
                lot_size_sqm × monthly_rate × 12
              </code>
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Only one rate is "active" at any time - the most recent rate with
              an effective date on or before today. Future rates will become
              active automatically on their effective date.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
