import { useState, useEffect } from "react";
import { Settings, Save, RefreshCw, Info } from "lucide-react";
import { api } from "@/lib/api";
import type { PaymentSettings } from "@/types";

interface LateFeeConfigProps {
  onSettingsChange?: (settings: PaymentSettings) => void;
}

export function LateFeeConfig({ onSettingsChange }: LateFeeConfigProps) {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [ratePercent, setRatePercent] = useState(1);
  const [gracePeriodDays, setGracePeriodDays] = useState(30);
  const [maxMonths, setMaxMonths] = useState(12);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError("");
    try {
      const response = await api.admin.getPaymentSettings();
      if (response.data) {
        setSettings(response.data);
        setRatePercent(response.data.late_fee_config.rate_percent);
        setGracePeriodDays(response.data.late_fee_config.grace_period_days);
        setMaxMonths(response.data.late_fee_config.max_months);
      }
    } catch (err: any) {
      setError(err.error || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.admin.updatePaymentSettings({
        bank_details: settings?.bank_details || {
          bank_name: "BPI",
          account_name: "Laguna Hills HOA",
          account_number: "1234-5678-90",
        },
        gcash_details: settings?.gcash_details || {
          name: "Laguna Hills HOA",
          number: "",
        },
        late_fee_config: {
          rate_percent: ratePercent,
          grace_period_days: gracePeriodDays,
          max_months: maxMonths,
        },
      });

      if (response.data) {
        setSettings(response.data.settings);
        setSuccess("Settings updated successfully!");
        onSettingsChange?.(response.data.settings);
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err: any) {
      setError(err.error || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-gray-600" />
        <h3 className="text-lg font-semibold">Late Fee Configuration</h3>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Bank Details Display */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">
          Bank Transfer Details
        </h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <span className="font-medium">Bank:</span>{" "}
            {settings?.bank_details?.bank_name}
          </p>
          <p>
            <span className="font-medium">Account Name:</span>{" "}
            {settings?.bank_details?.account_name}
          </p>
          <p>
            <span className="font-medium">Account Number:</span>{" "}
            {settings?.bank_details?.account_number}
          </p>
        </div>
      </div>

      {/* GCash Details Display */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">GCash Details</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>
            <span className="font-medium">Name:</span>{" "}
            {settings?.gcash_details?.name}
          </p>
          <p>
            <span className="font-medium">Number:</span>{" "}
            {settings?.gcash_details?.number}
          </p>
        </div>
      </div>

      {/* Late Fee Configuration Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Late Fee Rules</h4>

          {/* Rate Percent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Late Fee Rate (% per month)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={ratePercent}
                onChange={(e) =>
                  setRatePercent(parseFloat(e.target.value) || 0)
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <span className="text-sm text-gray-600">
                % of amount per month late
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Example: 1% means PHP 10 late fee per month for a PHP 1,000
              payment
            </p>
          </div>

          {/* Grace Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grace Period (days)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={gracePeriodDays}
                onChange={(e) =>
                  setGracePeriodDays(parseInt(e.target.value) || 0)
                }
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <span className="text-sm text-gray-600">
                days before late fees apply
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Payments made within this period after due date incur no late fees
            </p>
          </div>

          {/* Max Months */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Late Fee Months
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="120"
                value={maxMonths}
                onChange={(e) => setMaxMonths(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <span className="text-sm text-gray-600">months maximum</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Late fees won't accumulate beyond this many months
            </p>
          </div>

          {/* Example Calculation */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-600">
                <p className="font-medium mb-1">Example Calculation:</p>
                <p>
                  For a PHP 1,000 payment that's 3 months late (past grace
                  period):
                </p>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Base amount: PHP 1,000</li>
                  <li>• Rate: {ratePercent}% per month</li>
                  <li>• Months late: 3</li>
                  <li>
                    • Late fee: PHP{" "}
                    {(1000 * (ratePercent / 100) * 3).toFixed(2)}
                  </li>
                  <li>
                    • Total due: PHP{" "}
                    {(1000 + 1000 * (ratePercent / 100) * 3).toFixed(2)}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadSettings}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
