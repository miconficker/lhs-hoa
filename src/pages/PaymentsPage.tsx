import { useEffect, useState } from "react";
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { Plus, X, QrCode, CreditCard, Banknote, Landmark } from "lucide-react";
import { labels } from "@/lib/content/labels";
import { messages } from "@/lib/content/messages";
import { notify } from "@/lib/toast";
import { StatusBadge } from "@/components/ui/status-badge";
import { Callout } from "@/components/ui/callout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Payment,
  PaymentMethod,
  PaymentStatus,
  OutstandingBalance,
} from "@/types";

const statusVariant: Record<
  PaymentStatus,
  "success" | "warning" | "error" | "info" | "neutral"
> = {
  pending: "warning",
  completed: "success",
  failed: "error",
};

const statusLabels: Record<PaymentStatus, string> = {
  pending: labels.pending,
  completed: labels.completed,
  failed: labels.failed,
};

const methodIcons: Record<
  PaymentMethod,
  React.ComponentType<{ className?: string }>
> = {
  gcash: ({ className }) => <QrCode className={className} />,
  paymaya: ({ className }) => <CreditCard className={className} />,
  instapay: ({ className }) => <Landmark className={className} />,
  cash: ({ className }) => <Banknote className={className} />,
  "in-person": ({ className }) => <Plus className={className} />,
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
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          {labels.payments}
        </h1>
        <Button onClick={() => setShowNewPayment(true)}>
          <Plus className="w-5 h-5 mr-2" />
          {labels.newPayment}
        </Button>
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
        <Callout
          variant="error"
          title="Error"
          action={
            <button
              onClick={() => setError("")}
              className="text-[hsl(var(--status-error-fg))] hover:opacity-70"
            >
              <X className="w-5 h-5" />
            </button>
          }
        >
          {error}
        </Callout>
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
                    <div className="p-2 bg-muted rounded-lg">
                      {React.createElement(methodIcons[payment.method], {
                        className: "w-5 h-5 text-muted-foreground",
                      })}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-card-foreground">
                          PHP {payment.amount.toFixed(2)}
                        </span>
                        <StatusBadge
                          variant={statusVariant[payment.status]}
                          srLabel={`Status: ${statusLabels[payment.status]}`}
                        >
                          {statusLabels[payment.status]}
                        </StatusBadge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {methodLabels[payment.method]} • Period:{" "}
                        {payment.period}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
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
                        <div className="text-xs text-[hsl(var(--status-success-fg))] mt-1">
                          Paid on{" "}
                          {format(new Date(payment.paid_at), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                  </div>
                  {payment.method === "gcash" &&
                    payment.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedMethod("gcash");
                          setShowQRModal(true);
                        }}
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        {labels.viewQR}
                      </Button>
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
      <Dialog open={showNewPayment} onOpenChange={setShowNewPayment}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{labels.createPayment}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreatePayment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">{labels.amountPHP} *</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={balance?.total_due || 0}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="method">{labels.paymentMethod} *</Label>
              <select
                id="method"
                name="method"
                required
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">{labels.selectMethod}</option>
                <option value="gcash">{labels.gcash}</option>
                <option value="paymaya">{labels.paymaya}</option>
                <option value="instapay">{labels.instapay}</option>
                <option value="cash">{labels.cash}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">{labels.period} (YYYY-MM) *</Label>
              <Input
                id="period"
                name="period"
                type="month"
                required
                defaultValue={new Date().toISOString().slice(0, 7)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referenceNumber">{labels.referenceNumber}</Label>
              <Input
                id="referenceNumber"
                name="referenceNumber"
                type="text"
                placeholder="Optional"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowNewPayment(false)}
              >
                {labels.cancel}
              </Button>
              <Button type="submit" className="flex-1">
                {labels.createPayment}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* GCash QR Modal */}
      <Dialog
        open={showQRModal && selectedMethod === "gcash"}
        onOpenChange={(open) => {
          setShowQRModal(open);
          if (!open) setSelectedMethod(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{labels.gcashPayment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {getGcashQRPlaceholder()}
            <div className="space-y-3 text-sm text-muted-foreground">
              {labels.gcashInstructions.map(
                (instruction: string, index: number) => (
                  <p key={index}>{`${index + 1}. ${instruction}`}</p>
                ),
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
