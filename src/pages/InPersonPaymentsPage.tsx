import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api, type AdminUser } from "@/lib/api";
import { format } from "date-fns";
import {
  X,
  DollarSign,
  Calendar,
  User,
  FileText,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import type { Payment } from "@/types";

export function InPersonPaymentsPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    user_id: "",
    amount: "",
    period: "",
    payment_date: new Date().toISOString().split("T")[0],
    reference_number: "",
    witness: "",
  });

  // Calculated late fees
  const [lateFees, setLateFees] = useState(0);

  useEffect(() => {
    loadUsers();
    loadRecentPayments();
  }, []);

  async function loadUsers() {
    const result = await api.admin.getHomeowners();
    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setUsers(result.data.homeowners);
    }
  }

  async function loadRecentPayments() {
    const result = await api.payments.list({ method: "in-person" });
    if (result.data) {
      setRecentPayments(result.data.payments.slice(0, 10));
    }
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError("");
    setSuccess("");
  }

  async function handleCalculateFees() {
    if (!formData.user_id || !formData.amount || !formData.period) {
      setError("Please fill in user, amount, and period first");
      return;
    }

    // Try to get balance to calculate late fees
    const result = await api.payments.getBalance(formData.user_id);
    if (result.data) {
      // Check if period is in periods_due
      const isLate = result.data.periods_due.includes(formData.period);
      if (isLate) {
        // Calculate late fees (1% per month from due date)
        // This is a simple calculation - backend will do the actual calculation
        const amount = parseFloat(formData.amount);
        setLateFees(amount * 0.01); // Placeholder - backend calculates actual
      } else {
        setLateFees(0);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.user_id || !formData.amount || !formData.period) {
      setError("Please fill in all required fields");
      return;
    }

    if (!showConfirm) {
      setShowConfirm(true);
      return;
    }

    const result = await api.admin.recordInPersonPayment({
      user_id: formData.user_id,
      amount: parseFloat(formData.amount),
      method: "cash",
      period: formData.period,
      check_number: formData.reference_number || undefined,
    });

    if (result.error) {
      setError(result.error);
      setShowConfirm(false);
      return;
    }

    setSuccess(
      `Payment recorded successfully! Late fees: PHP ${result.data?.late_fees.toFixed(2) || "0.00"}`,
    );
    setShowConfirm(false);

    // Reset form
    setFormData({
      user_id: "",
      amount: "",
      period: "",
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      witness: "",
    });
    setLateFees(0);

    // Reload recent payments
    await loadRecentPayments();
  }

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-2">
            Access Denied
          </h2>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          Record In-Person Payments
        </h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError("")}
            className="text-red-500 hover:text-destructive"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50/50 border border-green-200 text-green-700 p-4 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Success</p>
            <p className="text-sm">{success}</p>
          </div>
          <button
            onClick={() => setSuccess("")}
            className="text-green-500 hover:text-green-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Form */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Record Payment</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Selection */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Homeowner *
              </label>
              <select
                name="user_id"
                value={formData.user_id}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select homeowner</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}{" "}
                    {u.household_count ? `(${u.household_count} lots)` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Amount (PHP) *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  onBlur={handleCalculateFees}
                  min="0.01"
                  step="0.01"
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Period */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Period (Year) *
              </label>
              <select
                name="period"
                value={formData.period}
                onChange={handleInputChange}
                onBlur={handleCalculateFees}
                className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select period</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
              </select>
            </div>

            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Payment Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  name="payment_date"
                  value={formData.payment_date}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                />
              </div>
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Reference Number / Check Number
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="reference_number"
                  value={formData.reference_number}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Witness */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">
                Witness
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="witness"
                  value={formData.witness}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Late Fees Display */}
            {lateFees > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm font-medium text-orange-800">
                  Late Fees: PHP {lateFees.toFixed(2)}
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  (1% per month from due date)
                </p>
              </div>
            )}

            {/* Total Display */}
            {formData.amount && (
              <div className="bg-muted border border-border rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-card-foreground">
                    Total to Record:
                  </span>
                  <span className="text-lg font-bold text-card-foreground">
                    PHP{" "}
                    {(parseFloat(formData.amount || "0") + lateFees).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    user_id: "",
                    amount: "",
                    period: "",
                    payment_date: new Date().toISOString().split("T")[0],
                    reference_number: "",
                    witness: "",
                  });
                  setLateFees(0);
                  setError("");
                  setShowConfirm(false);
                }}
                className="flex-1 px-4 py-2 border border-border text-card-foreground rounded-lg hover:bg-muted"
              >
                Clear
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {showConfirm ? "Confirm Recording" : "Record Payment"}
              </button>
            </div>

            {showConfirm && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800">
                  Please confirm the payment details before recording.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="mt-2 text-sm text-yellow-700 underline"
                >
                  Cancel
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Recent Payments */}
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            Recent In-Person Payments
          </h2>
          {recentPayments.length > 0 ? (
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="border border-border rounded-lg p-4 hover:bg-muted"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-card-foreground">
                        PHP {payment.amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Period: {payment.period}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(
                          new Date(payment.created_at),
                          "MMM d, yyyy h:mm a",
                        )}
                      </p>
                      {payment.reference_number && (
                        <p className="text-xs text-muted-foreground">
                          Ref: {payment.reference_number}
                        </p>
                      )}
                      {payment.received_by && (
                        <p className="text-xs text-blue-600">
                          Received by: {payment.received_by}
                        </p>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        payment.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : payment.status === "pending"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-destructive"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </div>
                  {payment.late_fee_amount && payment.late_fee_amount > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-orange-600">
                        Late fees: PHP {payment.late_fee_amount.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No recent in-person payments found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
