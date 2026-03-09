import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Download,
  Receipt,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ExternalRental,
  AmenityType,
  TimeBlockSlot,
  CreateExternalRentalInput,
  RecordPaymentInput,
  RentalPaymentStatus,
} from "@/types";

interface ExternalRentalsTabProps {
  amenityTypes: AmenityType[];
}

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

const paymentStatusLabels: Record<RentalPaymentStatus, string> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
};

const paymentStatusBadgeVariant: Record<
  RentalPaymentStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  unpaid: "secondary",
  partial: "outline",
  paid: "default",
  overdue: "destructive",
};

interface FormData {
  amenity_type: AmenityType | "";
  date: string;
  slot: TimeBlockSlot | "";
  renter_name: string;
  renter_contact: string;
  amount: string;
  notes: string;
}

const emptyForm: FormData = {
  amenity_type: "",
  date: "",
  slot: "",
  renter_name: "",
  renter_contact: "",
  amount: "",
  notes: "",
};

interface PaymentFormData {
  amount: string;
  payment_method: string;
  receipt_number: string;
}

const emptyPaymentForm: PaymentFormData = {
  amount: "",
  payment_method: "",
  receipt_number: "",
};

export function ExternalRentalsTab({ amenityTypes }: ExternalRentalsTabProps) {
  const [rentals, setRentals] = useState<ExternalRental[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<ExternalRental | null>(
    null,
  );
  const [paymentRental, setPaymentRental] = useState<ExternalRental | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [paymentForm, setPaymentForm] =
    useState<PaymentFormData>(emptyPaymentForm);

  useEffect(() => {
    loadRentals();
  }, []);

  const loadRentals = async () => {
    try {
      setIsLoading(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch("/api/admin/external-rentals", {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load external rentals");
      }

      const data = await response.json();
      setRentals(data.rentals || []);
    } catch (error) {
      console.error("Error loading external rentals:", error);
      toast.error("Failed to load external rentals");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingRental(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (rental: ExternalRental) => {
    setEditingRental(rental);
    setFormData({
      amenity_type: rental.amenity_type,
      date: rental.date,
      slot: rental.slot,
      renter_name: rental.renter_name,
      renter_contact: rental.renter_contact || "",
      amount: rental.amount.toString(),
      notes: rental.notes || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRental(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.amenity_type ||
      !formData.date ||
      !formData.slot ||
      !formData.renter_name.trim() ||
      !formData.amount ||
      isNaN(parseFloat(formData.amount))
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const input: CreateExternalRentalInput = {
        amenity_type: formData.amenity_type as AmenityType,
        date: formData.date,
        slot: formData.slot as TimeBlockSlot,
        renter_name: formData.renter_name.trim(),
        renter_contact: formData.renter_contact.trim() || undefined,
        amount: parseFloat(formData.amount),
        notes: formData.notes.trim() || undefined,
      };

      const url = editingRental
        ? `/api/admin/external-rentals/${editingRental.id}`
        : "/api/admin/external-rentals";

      const response = await fetch(url, {
        method: editingRental ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hoa_token}`,
        },
        body: JSON.stringify(
          editingRental ? { ...input, id: editingRental.id } : input,
        ),
      });

      if (!response.ok) {
        throw new Error("Failed to save external rental");
      }

      await loadRentals();
      closeDialog();
      toast.success(
        editingRental ? "External rental updated" : "External rental created",
      );
    } catch (error) {
      console.error("Error saving external rental:", error);
      toast.error("Failed to save external rental");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (rentalId: string) => {
    if (!confirm("Are you sure you want to delete this external rental?")) {
      return;
    }

    try {
      setIsDeleting(rentalId);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(`/api/admin/external-rentals/${rentalId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete external rental");
      }

      setRentals((prev) => prev.filter((r) => r.id !== rentalId));
      toast.success("External rental deleted");
    } catch (error) {
      console.error("Error deleting external rental:", error);
      toast.error("Failed to delete external rental");
    } finally {
      setIsDeleting(null);
    }
  };

  const openPaymentDialog = (rental: ExternalRental) => {
    setPaymentRental(rental);
    const remainingBalance = rental.amount - rental.amount_paid;
    setPaymentForm({
      amount: remainingBalance > 0 ? remainingBalance.toString() : "",
      payment_method: rental.payment_method || "",
      receipt_number: rental.receipt_number || "",
    });
    setIsPaymentDialogOpen(true);
  };

  const closePaymentDialog = () => {
    setIsPaymentDialogOpen(false);
    setPaymentRental(null);
    setPaymentForm(emptyPaymentForm);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentRental) return;

    if (!paymentForm.amount || isNaN(parseFloat(paymentForm.amount))) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    try {
      setIsSubmitting(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const input: RecordPaymentInput = {
        amount: parseFloat(paymentForm.amount),
        payment_method: paymentForm.payment_method || undefined,
        receipt_number: paymentForm.receipt_number || undefined,
      };

      const response = await fetch(
        `/api/admin/external-rentals/${paymentRental.id}/payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${hoa_token}`,
          },
          body: JSON.stringify(input),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to record payment");
      }

      await loadRentals();
      closePaymentDialog();
      toast.success("Payment recorded successfully");
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    if (rentals.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Date",
      "Amenity",
      "Time Slot",
      "Renter Name",
      "Contact",
      "Total Amount",
      "Amount Paid",
      "Balance",
      "Status",
      "Payment Method",
      "Receipt #",
      "Notes",
    ];

    const rows = rentals.map((r) => [
      r.date,
      amenityLabels[r.amenity_type],
      slotLabels[r.slot],
      r.renter_name,
      r.renter_contact || "",
      r.amount.toFixed(2),
      r.amount_paid.toFixed(2),
      (r.amount - r.amount_paid).toFixed(2),
      paymentStatusLabels[r.payment_status],
      r.payment_method || "",
      r.receipt_number || "",
      r.notes || "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `external-rentals-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Exported to CSV");
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updatePaymentForm = (field: keyof PaymentFormData, value: string) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading external rentals...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            External Rentals
          </h2>
          <p className="text-muted-foreground">
            Manage rentals of amenities to non-residents with payment tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rental
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold">
                ₱{rentals.reduce((sum, r) => sum + r.amount_paid, 0).toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">
                {
                  rentals.filter(
                    (r) =>
                      r.payment_status === "unpaid" ||
                      r.payment_status === "partial",
                  ).length
                }
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-500 opacity-50" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold">
                ₱
                {rentals
                  .reduce((sum, r) => sum + (r.amount - r.amount_paid), 0)
                  .toFixed(2)}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-red-500 opacity-50" />
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Rentals</p>
              <p className="text-2xl font-bold">{rentals.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-primary opacity-50" />
          </div>
        </div>
      </div>

      {/* Rentals Table */}
      {rentals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No external rentals</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Create rentals for non-residents who want to use HOA amenities.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Amenity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Renter
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rentals
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((rental) => (
                    <tr key={rental.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(rental.date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {slotLabels[rental.slot]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {amenityLabels[rental.amenity_type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">
                            {rental.renter_name}
                          </p>
                          {rental.renter_contact && (
                            <p className="text-xs text-muted-foreground">
                              {rental.renter_contact}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">
                            ₱{rental.amount.toFixed(2)}
                          </p>
                          {rental.amount_paid > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Paid: ₱{rental.amount_paid.toFixed(2)}
                            </p>
                          )}
                          {rental.amount - rental.amount_paid > 0 && (
                            <p className="text-xs text-destructive">
                              Balance: ₱
                              {(rental.amount - rental.amount_paid).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            paymentStatusBadgeVariant[rental.payment_status]
                          }
                        >
                          {paymentStatusLabels[rental.payment_status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {(rental.payment_status === "unpaid" ||
                            rental.payment_status === "partial") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openPaymentDialog(rental)}
                              title="Record payment"
                            >
                              <Receipt className="h-4 w-4 text-green-500" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(rental)}
                            aria-label="Edit rental"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(rental.id)}
                            disabled={isDeleting === rental.id}
                            aria-label="Delete rental"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRental
                ? "Edit External Rental"
                : "Create External Rental"}
            </DialogTitle>
            <DialogDescription>
              {editingRental
                ? "Update the rental details below."
                : "Create a new rental for a non-resident."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amenity">Amenity *</Label>
                <Select
                  value={formData.amenity_type}
                  onValueChange={(v) => updateForm("amenity_type", v)}
                >
                  <SelectTrigger id="amenity">
                    <SelectValue placeholder="Select amenity" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {amenityLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateForm("date", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slot">Time Slot *</Label>
                <Select
                  value={formData.slot}
                  onValueChange={(v) => updateForm("slot", v)}
                >
                  <SelectTrigger id="slot">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">Morning (8AM - 12PM)</SelectItem>
                    <SelectItem value="PM">Afternoon (1PM - 5PM)</SelectItem>
                    <SelectItem value="FULL_DAY">
                      Full Day (8AM - 5PM)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="renter_name">Renter Name *</Label>
                <Input
                  id="renter_name"
                  placeholder="Full name"
                  value={formData.renter_name}
                  onChange={(e) => updateForm("renter_name", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="renter_contact">Contact Number</Label>
                <Input
                  id="renter_contact"
                  placeholder="Phone or email"
                  value={formData.renter_contact}
                  onChange={(e) => updateForm("renter_contact", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Rental Fee (₱) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => updateForm("amount", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingRental
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentRental && (
                <>
                  Record payment for {paymentRental.renter_name} -{" "}
                  {amenityLabels[paymentRental.amenity_type]} on{" "}
                  {new Date(paymentRental.date).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePaymentSubmit}>
            <div className="space-y-4 py-4">
              {paymentRental && (
                <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="font-medium">
                      ₱{paymentRental.amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Previously Paid:
                    </span>
                    <span className="font-medium">
                      ₱{paymentRental.amount_paid.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span>Balance Due:</span>
                    <span className="text-destructive">
                      ₱
                      {(
                        paymentRental.amount - paymentRental.amount_paid
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Payment Amount (₱) *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => updatePaymentForm("amount", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Input
                  id="payment_method"
                  placeholder="e.g., Cash, GCash, Bank Transfer"
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    updatePaymentForm("payment_method", e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="receipt_number">Receipt Number</Label>
                <Input
                  id="receipt_number"
                  placeholder="Official receipt number..."
                  value={paymentForm.receipt_number}
                  onChange={(e) =>
                    updatePaymentForm("receipt_number", e.target.value)
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closePaymentDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Recording..." : "Record Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
