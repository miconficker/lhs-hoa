import { useState, useEffect } from "react";
import { X, Upload, AlertCircle, CheckCircle2, Landmark } from "lucide-react";
import { api } from "@/lib/api";
import type { PaymentCategory, PaymentMethod } from "@/types";

interface PayNowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  householdId: string;
  defaultType?: PaymentCategory;
  defaultAmount?: number;
}

const paymentTypes: {
  value: PaymentCategory;
  label: string;
  description: string;
}[] = [
  { value: "dues", label: "HOA Dues", description: "Annual association dues" },
  {
    value: "vehicle_pass",
    label: "Vehicle Pass",
    description: "Sticker or RFID pass",
  },
  {
    value: "employee_id",
    label: "Employee ID",
    description: "Household employee pass",
  },
];

const paymentMethods: {
  value: PaymentMethod;
  label: string;
  icon: React.ReactNode;
}[] = [
  { value: "gcash", label: "GCash", icon: <span className="text-sm">GC</span> },
  {
    value: "paymaya",
    label: "PayMaya",
    icon: <span className="text-sm">PM</span>,
  },
  {
    value: "instapay",
    label: "InstaPay",
    icon: <Landmark className="w-4 h-4" />,
  },
  {
    value: "cash",
    label: "Cash (In-Person)",
    icon: <span className="text-sm">💵</span>,
  },
  {
    value: "in-person",
    label: "In-Person (Other)",
    icon: <span className="text-sm">👤</span>,
  },
];

export function PayNowModal({
  isOpen,
  onClose,
  onSuccess,
  householdId,
  defaultType = "dues",
  defaultAmount,
}: PayNowModalProps) {
  const [paymentType, setPaymentType] = useState<PaymentCategory>(defaultType);
  const [amount, setAmount] = useState(defaultAmount?.toString() || "");
  const [method, setMethod] = useState<PaymentMethod>("gcash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "review" | "success">("form");

  // Fetch payment settings on mount
  const [bankDetails, setBankDetails] = useState({
    bank_name: "",
    account_name: "",
    account_number: "",
  });
  const [gcashDetails, setGcashDetails] = useState({ name: "", number: "" });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.admin.getPaymentSettings();
        if (response.data) {
          setBankDetails(response.data.bank_details);
          setGcashDetails(response.data.gcash_details);
        }
      } catch {
        // Use defaults if API fails
        setBankDetails({
          bank_name: "BPI",
          account_name: "Laguna Hills HOA",
          account_number: "1234-5678-90",
        });
        setGcashDetails({ name: "Laguna Hills HOA", number: "" });
      }
    };
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // householdId is used for future features like fetching pending amounts
  void householdId;

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/jpg",
      "application/pdf",
    ];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, PNG, and PDF files are allowed");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    setProofFile(file);
    setError("");

    // Create preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!proofFile) {
      setError("Please upload a payment proof");
      return;
    }

    if (
      method !== "cash" &&
      method !== "in-person" &&
      !referenceNumber.trim()
    ) {
      setError("Please enter a reference number");
      return;
    }

    if (step === "form") {
      setStep("review");
      return;
    }

    setLoading(true);

    try {
      await api.payments.initiatePayment({
        payment_type: paymentType,
        amount: parseFloat(amount),
        method,
        reference_number: referenceNumber || undefined,
        proof: proofFile,
      });

      setStep("success");
      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.error || "Failed to initiate payment. Please try again.");
      setStep("form");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("form");
    setAmount(defaultAmount?.toString() || "");
    setReferenceNumber("");
    setProofFile(null);
    setPreview(null);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Pay Now</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-muted rounded"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success State */}
        {step === "success" && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold text-green-700 mb-2">
              Payment Submitted!
            </h3>
            <p className="text-gray-600">
              Your payment is pending verification. You'll receive a
              notification once it's approved.
            </p>
          </div>
        )}

        {/* Form & Review */}
        {step !== "success" && (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Payment Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-2">
                Payment Type
              </label>
              <div className="space-y-2">
                {paymentTypes.map((type) => (
                  <label
                    key={type.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                      paymentType === type.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 dark:border-border hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentType"
                      value={type.value}
                      checked={paymentType === type.value}
                      onChange={(e) =>
                        setPaymentType(e.target.value as PaymentCategory)
                      }
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-gray-500">
                        {type.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                Amount (PHP)
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                required
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {paymentMethods.map((pm) => (
                  <label
                    key={pm.value}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors text-center ${
                      method === pm.value
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 dark:border-border hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={pm.value}
                      checked={method === pm.value}
                      onChange={(e) =>
                        setMethod(e.target.value as PaymentMethod)
                      }
                      className="sr-only"
                    />
                    <div className="flex flex-col items-center gap-1">
                      {pm.icon}
                      <span className="text-xs">{pm.label}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* InstaPay Details (shown when instapay is selected) */}
            {method === "instapay" && step === "form" && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  InstaPay Details
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    <span className="font-medium">Bank:</span>{" "}
                    {bankDetails.bank_name}
                  </p>
                  <p>
                    <span className="font-medium">Account Name:</span>{" "}
                    {bankDetails.account_name}
                  </p>
                  <p>
                    <span className="font-medium">Account Number:</span>{" "}
                    {bankDetails.account_number}
                  </p>
                </div>
              </div>
            )}

            {/* GCash Details (shown when gcash is selected) */}
            {method === "gcash" && step === "form" && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">
                  GCash Details
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>
                    <span className="font-medium">Name:</span>{" "}
                    {gcashDetails.name}
                  </p>
                  <p>
                    <span className="font-medium">Number:</span>{" "}
                    {gcashDetails.number}
                  </p>
                </div>
              </div>
            )}

            {/* Reference Number */}
            {method !== "cash" && method !== "in-person" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Last 4 digits of transaction"
                />
              </div>
            )}

            {/* Proof Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                Upload Payment Proof *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-border border-dashed rounded-lg hover:border-gray-400 transition-colors">
                <div className="space-y-1 text-center">
                  {preview ? (
                    <div className="relative">
                      {proofFile?.type.startsWith("image/") ? (
                        <img
                          src={preview}
                          alt="Preview"
                          className="max-h-40 mx-auto rounded"
                        />
                      ) : (
                        <div className="py-8">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-600">
                            {proofFile?.name}
                          </p>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          setPreview(null);
                        }}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="proof-upload"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"
                        >
                          <span>Upload a file</span>
                          <input
                            id="proof-upload"
                            type="file"
                            className="sr-only"
                            accept="image/jpeg,image/png,application/pdf"
                            onChange={handleFileChange}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        JPG, PNG, PDF up to 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Review Step */}
            {step === "review" && (
              <div className="bg-gray-50 dark:bg-muted p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Review Payment Details</h4>
                <div className="text-sm space-y-1">
                  <p>
                    <span className="text-gray-600">Type:</span>{" "}
                    {paymentTypes.find((t) => t.value === paymentType)?.label}
                  </p>
                  <p>
                    <span className="text-gray-600">Amount:</span> PHP{" "}
                    {parseFloat(amount).toFixed(2)}
                  </p>
                  <p>
                    <span className="text-gray-600">Method:</span>{" "}
                    {paymentMethods.find((m) => m.value === method)?.label}
                  </p>
                  {referenceNumber && (
                    <p>
                      <span className="text-gray-600">Reference:</span>{" "}
                      {referenceNumber}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={
                  step === "review" ? () => setStep("form") : handleClose
                }
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-border text-gray-700 dark:text-card-foreground rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
                disabled={loading}
              >
                {step === "review" ? "Back" : "Cancel"}
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : step === "review"
                    ? "Confirm"
                    : "Review"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
