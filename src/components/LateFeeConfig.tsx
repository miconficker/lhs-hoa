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
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Late Fee Configuration</h3>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-[hsl(var(--status-error-bg))] border border-[hsl(var(--status-error-fg))] rounded-lg text-[hsl(var(--status-error-fg))] text-sm dark:bg-opacity-20 dark:border-opacity-30">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-3 bg-[hsl(var(--status-success-bg))] border border-[hsl(var(--status-success-fg))] rounded-lg text-[hsl(var(--status-success-fg))] text-sm dark:bg-opacity-20 dark:border-opacity-30">
          {success}
        </div>
      )}

      {/* Bank Details Display */}
      <div className="bg-[hsl(var(--status-info-bg))] p-4 rounded-lg">
        <h4 className="font-medium text-[hsl(var(--status-info-fg))] mb-3">
          Bank Transfer Details
        </h4>
        <div className="text-sm text-[hsl(var(--status-info-fg))] space-y-1">
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
      <div className="bg-[hsl(var(--status-info-bg))] p-4 rounded-lg">
        <h4 className="font-medium text-[hsl(var(--status-info-fg))] mb-3">
          GCash Details
        </h4>
        <div className="text-sm text-[hsl(var(--status-info-fg))] space-y-1">
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
        <div className="bg-card border border-border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Late Fee Rules</h4>

          {/* Rate Percent */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
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
                className="w-32 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
              <span className="text-sm text-muted-foreground">
                % of amount per month late
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Example: 1% means PHP 10 late fee per month for a PHP 1,000
              payment
            </p>
          </div>

          {/* Grace Period */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
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
                className="w-32 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
              <span className="text-sm text-muted-foreground">
                days before late fees apply
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Payments made within this period after due date incur no late fees
            </p>
          </div>

          {/* Max Months */}
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">
              Maximum Late Fee Months
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="120"
                value={maxMonths}
                onChange={(e) => setMaxMonths(parseInt(e.target.value) || 0)}
                className="w-32 px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                required
              />
              <span className="text-sm text-muted-foreground">
                months maximum
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Late fees won't accumulate beyond this many months
            </p>
          </div>

          {/* Example Calculation */}
          <div className="bg-muted p-3 rounded-lg border border-border">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="text-sm text-card-foreground">
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
            className="px-4 py-2 border border-input text-card-foreground rounded-lg hover:bg-muted flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
