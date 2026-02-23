import { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
  Image,
  FileText,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import type { PaymentVerificationQueue } from "@/types";

interface PaymentVerificationQueueProps {
  status?: "pending" | "approved" | "rejected";
  onRefresh?: () => void;
}

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const paymentTypeLabels = {
  dues: "HOA Dues",
  vehicle_pass: "Vehicle Pass",
  employee_id: "Employee ID",
};

export function PaymentVerificationQueue({
  status = "pending",
  onRefresh,
}: PaymentVerificationQueueProps) {
  const [verifications, setVerifications] = useState<
    PaymentVerificationQueue[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] =
    useState<PaymentVerificationQueue | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadVerifications();
  }, [status]);

  async function loadVerifications() {
    setLoading(true);
    setError("");
    try {
      const response = await api.admin.getVerificationQueue({
        status,
        limit: 50,
      });
      if (response.data) {
        setVerifications(response.data.verifications);
      }
    } catch (err: any) {
      setError(err.error || "Failed to load verification queue");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(item: PaymentVerificationQueue) {
    setProcessing(item.payment_id);
    setError("");
    try {
      await api.admin.verifyPayment(item.payment_id, { action: "approve" });
      setVerifications((prev) =>
        prev.filter((v) => v.payment_id !== item.payment_id),
      );
      onRefresh?.();
    } catch (err: any) {
      setError(err.error || "Failed to approve payment");
    } finally {
      setProcessing(null);
    }
  }

  function handleRejectClick(item: PaymentVerificationQueue) {
    setSelectedItem(item);
    setShowRejectModal(true);
  }

  async function handleReject() {
    if (!selectedItem || !rejectionReason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setProcessing(selectedItem.payment_id);
    setError("");
    try {
      await api.admin.verifyPayment(selectedItem.payment_id, {
        action: "reject",
        rejection_reason: rejectionReason,
      });
      setVerifications((prev) =>
        prev.filter((v) => v.payment_id !== selectedItem.payment_id),
      );
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedItem(null);
      onRefresh?.();
    } catch (err: any) {
      setError(err.error || "Failed to reject payment");
    } finally {
      setProcessing(null);
    }
  }

  function getFileIcon(fileName: string) {
    const ext = fileName?.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif"].includes(ext || "")) {
      return <Image className="w-5 h-5" />;
    }
    return <FileText className="w-5 h-5" />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Empty State */}
      {verifications.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-muted rounded-lg">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No {status} verifications</p>
        </div>
      )}

      {/* Verification List */}
      <div className="space-y-3">
        {verifications.map((item) => (
          <div
            key={item.id}
            className="bg-white dark:bg-card border border-gray-200 dark:border-border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left: Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                    {paymentTypeLabels[item.payment_type]}
                  </span>
                  <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="font-medium text-gray-900">
                    {item.user_email || item.first_name + " " + item.last_name}
                  </p>
                  <p className="text-gray-600">{item.household_address}</p>
                  <p className="text-lg font-semibold text-gray-900">
                    PHP {item.amount.toFixed(2)}
                  </p>
                  {item.reference_number && (
                    <p className="text-xs text-gray-500">
                      Ref: {item.reference_number}
                    </p>
                  )}
                  {item.rejection_reason && status === "rejected" && (
                    <p className="text-sm text-red-600">
                      Rejected: {item.rejection_reason}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex flex-col items-end gap-2">
                {/* View Proof Button */}
                {item.file_url && (
                  <a
                    href={item.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    View Proof
                  </a>
                )}

                {/* Action Buttons (for pending items) */}
                {status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(item)}
                      disabled={processing === item.payment_id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing === item.payment_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleRejectClick(item)}
                      disabled={processing === item.payment_id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing === item.payment_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Reject
                    </button>
                  </div>
                )}

                {/* Status Badge (for approved/rejected) */}
                {status !== "pending" && (
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg ${statusColors[status]}`}
                  >
                    {status === "approved" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                )}
              </div>
            </div>

            {/* File Info */}
            {item.file_name && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {getFileIcon(item.file_name)}
                  <span>{item.file_name}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reject Confirmation Modal */}
      {showRejectModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-card rounded-lg shadow-xl max-w-md w-full">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold">Reject Payment</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="text-sm text-gray-600">
                <p className="mb-2">
                  <strong>Amount:</strong> PHP {selectedItem.amount.toFixed(2)}
                </p>
                <p className="mb-2">
                  <strong>Type:</strong>{" "}
                  {paymentTypeLabels[selectedItem.payment_type]}
                </p>
                <p>
                  <strong>User:</strong> {selectedItem.user_email}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Reason for Rejection *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please explain why this payment is being rejected..."
                  required
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setError("");
                }}
                className="px-4 py-2 border border-gray-300 dark:border-border text-gray-700 dark:text-card-foreground rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
                disabled={processing === selectedItem.payment_id}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={
                  processing === selectedItem.payment_id ||
                  !rejectionReason.trim()
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing === selectedItem.payment_id ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Reject Payment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
