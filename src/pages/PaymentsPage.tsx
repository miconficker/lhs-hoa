import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Plus, X, QrCode, CreditCard, Banknote, Landmark } from "lucide-react";
import { labels } from "@/lib/content/labels";
import { messages } from "@/lib/content/messages";
import { notify } from "@/lib/toast";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  OutstandingBalance,
} from "@/types";

const statusColors: Record<PaymentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: labels.pending,
  completed: labels.completed,
  failed: labels.failed,
};

const methodIcons: Record<PaymentMethod, React.ReactNode> = {
  gcash: <QrCode className="w-5 h-5" />,
  paymaya: <CreditCard className="w-5 h-5" />,
  instapay: <Landmark className="w-5 h-5" />,
  cash: <Banknote className="w-5 h-5" />,
  "in-person": <Plus className="w-5 h-5" />,
};

const methodLabels: Record<PaymentMethod, string> = {
  gcash: labels.gcash,
  paymaya: labels.paymaya,
  instapay: labels.instapay,
  cash: labels.cash,
  "in-person": labels.inPerson,
};

export function PaymentsPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState<OutstandingBalance | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null,
  );

  // For demo purposes, use a fixed household ID
  // In production, this would come from user's household association
  const householdId = user?.id || "demo-household";

  useEffect(() => {
    loadData();
  }, [householdId]);

  async function loadData() {
    setLoading(true);
    setError("");

    const [balanceResult, paymentsResult] = await Promise.all([
      api.payments.getBalance(householdId),
      api.payments.getMyPayments(householdId),
    ]);

    if (balanceResult.error) {
      setError(balanceResult.error);
    } else if (balanceResult.data) {
      setBalance(balanceResult.data);
    }

    if (paymentsResult.error) {
      setError(paymentsResult.error);
    } else if (paymentsResult.data) {
      setPayments(paymentsResult.data.payments);
    }

    setLoading(false);
  }

  async function handleCreatePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const amount = parseFloat(formData.get("amount") as string);
    const method = formData.get("method") as PaymentMethod;
    const period = formData.get("period") as string;
    const referenceNumber = formData.get("referenceNumber") as string;

    if (!amount || !method || !period) {
      setError(messages.fillAllRequiredFields);
      return;
    }

    const result = await api.payments.create({
      household_id: householdId,
      amount,
      method,
      period,
      reference_number: referenceNumber || undefined,
    });

    if (result.error) {
      setError(result.error);
      notify.error(result.error);
      return;
    }

    setShowNewPayment(false);
    notify.success(messages.paymentSubmitted);

    // Show QR modal for GCash
    if (method === "gcash") {
      setSelectedMethod("gcash");
      setShowQRModal(true);
    }

    loadData();
  }

  function getGcashQRPlaceholder() {
    // Placeholder QR code - in production, this would be a real GCash QR
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card rounded-lg">
        <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center mb-4">
          <QrCode className="w-32 h-32 text-gray-400" />
        </div>
        <p className="text-muted-foreground text-sm">Scan to pay with GCash</p>
        <p className="text-muted-foreground text-xs mt-2">
          Amount: PHP {balance?.total_due.toFixed(2) || "0.00"}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">{labels.payments}</h1>
        <button
          onClick={() => setShowNewPayment(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          {labels.newPayment}
        </button>
      </div>

      {/* Outstanding Balance Card */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg p-6 text-white">
        <h2 className="text-lg font-semibold mb-2">
          {labels.outstandingBalance}
        </h2>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">
            PHP {balance?.total_due.toFixed(2) || "0.00"}
          </span>
        </div>
        {balance && balance.periods_due.length > 0 && (
          <p className="text-primary-100 mt-2 text-sm">
            {labels.periodsDue}: {balance.periods_due.join(", ")}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/10 border border-red-200 text-red-700 p-4 rounded-lg">
          {error}
          <button
            onClick={() => setError("")}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            <X className="w-5 h-5 inline" />
          </button>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-card-foreground">
            {labels.paymentHistory}
          </h3>
        </div>
        {payments && payments.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {payments.map((payment) => (
              <div key={payment.id} className="p-6 hover:bg-muted">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-muted-foreground">
                      {methodIcons[payment.method]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-card-foreground">
                          PHP {payment.amount.toFixed(2)}
                        </span>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[payment.status]}`}
                        >
                          {statusLabels[payment.status]}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {methodLabels[payment.method]} • Period:{" "}
                        {payment.period}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {format(
                          new Date(payment.created_at),
                          "MMM d, yyyy h:mm a",
                        )}
                      </div>
                      {payment.reference_number && (
                        <div className="text-xs text-muted-foreground">
                          Ref: {payment.reference_number}
                        </div>
                      )}
                      {payment.paid_at && (
                        <div className="text-xs text-green-600 mt-1">
                          Paid on{" "}
                          {format(new Date(payment.paid_at), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  </div>
                  {payment.method === "gcash" &&
                    payment.status === "pending" && (
                      <button
                        onClick={() => {
                          setSelectedMethod("gcash");
                          setShowQRModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50"
                      >
                        <QrCode className="w-4 h-4" />
                        {labels.viewQR}
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-muted-foreground">
            {messages.noPaymentHistory}
          </div>
        )}
      </div>

      {/* New Payment Modal */}
      {showNewPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">
                {labels.createPayment}
              </h3>
              <button
                onClick={() => setShowNewPayment(false)}
                className="text-gray-400 hover:text-muted-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreatePayment} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  {labels.amountPHP} *
                </label>
                <input
                  type="number"
                  name="amount"
                  min="0.01"
                  step="0.01"
                  defaultValue={balance?.total_due || 0}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  {labels.paymentMethod} *
                </label>
                <select
                  name="method"
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">{labels.selectMethod}</option>
                  <option value="gcash">{labels.gcash}</option>
                  <option value="paymaya">{labels.paymaya}</option>
                  <option value="instapay">{labels.instapay}</option>
                  <option value="cash">{labels.cash}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  {labels.period} (YYYY-MM) *
                </label>
                <input
                  type="month"
                  name="period"
                  required
                  defaultValue={new Date().toISOString().slice(0, 7)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">
                  {labels.referenceNumber}
                </label>
                <input
                  type="text"
                  name="referenceNumber"
                  placeholder="Optional"
                  className="w-full px-3 py-2 border border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowNewPayment(false)}
                  className="flex-1 px-4 py-2 border border-border text-card-foreground rounded-lg hover:bg-muted"
                >
                  {labels.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {labels.createPayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GCash QR Modal */}
      {showQRModal && selectedMethod === "gcash" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card rounded-lg shadow-xl max-w-sm w-full">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h3 className="text-lg font-semibold text-card-foreground">
                {labels.gcashPayment}
              </h3>
              <button
                onClick={() => {
                  setShowQRModal(false);
                  setSelectedMethod(null);
                }}
                className="text-gray-400 hover:text-muted-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {getGcashQRPlaceholder()}
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                {labels.gcashInstructions.map(
                  (instruction: string, index: number) => (
                    <p key={index}>{`${index + 1}. ${instruction}`}</p>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
