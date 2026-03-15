import { useState, useEffect } from "react";
import {
  Calendar,
  DollarSign,
  FileText,
  Users,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { UserSearchAndCreate } from "./UserSearchAndCreate";
import type { AdminBookingRequest, AmenityType, TimeBlockSlot } from "@/types";

const amenityOptions: {
  value: AmenityType;
  label: string;
  capacity: number;
}[] = [
  { value: "clubhouse", label: "Clubhouse", capacity: 100 },
  { value: "pool", label: "Swimming Pool", capacity: 50 },
  { value: "basketball-court", label: "Basketball Court", capacity: 20 },
  { value: "tennis-court", label: "Tennis Court", capacity: 4 },
];

const slotOptions: { value: TimeBlockSlot; label: string }[] = [
  { value: "AM", label: "Morning (8AM - 12PM)" },
  { value: "PM", label: "Afternoon (1PM - 5PM)" },
  { value: "FULL_DAY", label: "Full Day (8AM - 5PM)" },
];

const eventTypeOptions = [
  { value: "wedding", label: "Wedding" },
  { value: "birthday", label: "Birthday" },
  { value: "meeting", label: "Meeting" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
];

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "gcash", label: "GCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
];

interface AdminBookingFormProps {
  onSubmit: (data: AdminBookingRequest) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function AdminBookingForm({
  onSubmit,
  onCancel,
  isSubmitting,
}: AdminBookingFormProps) {
  // Customer selection
  const [customer, setCustomer] = useState<{
    type: "resident" | "guest" | "new_resident" | "new_guest";
    user_id?: string;
    customer_id?: string;
    new_customer?: {
      first_name: string;
      last_name: string;
      email: string;
      phone?: string;
    };
  } | null>(null);

  // Booking details
  const [amenityType, setAmenityType] = useState<AmenityType>("clubhouse");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState<TimeBlockSlot>("AM");
  const [eventType, setEventType] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [attendeeCount, setAttendeeCount] = useState<number | undefined>();

  // Admin options
  const [overridePrice, setOverridePrice] = useState<boolean>(false);
  const [customPrice, setCustomPrice] = useState<number | undefined>();
  const [skipApproval, setSkipApproval] = useState<boolean>(false);
  const [recordPayment, setRecordPayment] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<number | undefined>();
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [receiptNumber, setReceiptNumber] = useState<string>("");

  // Notes
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [customerNotes, setCustomerNotes] = useState<string>("");

  // Calculated pricing
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Error handling
  const [error, setError] = useState<string>("");

  // Calculate pricing when date/slot/amenity changes
  useEffect(() => {
    if (!date || !slot || !amenityType) {
      setCalculatedPrice(null);
      return;
    }

    const calculatePrice = async () => {
      setIsCalculating(true);
      try {
        const result = await api.public.getPricing(amenityType, date, slot);
        if (result.data && !result.error) {
          // Apply resident discount if applicable
          const isResident = customer?.type === "resident";
          const price = isResident
            ? result.data.final_price * 0.5 // 50% discount
            : result.data.final_price;
          setCalculatedPrice(price);
        }
      } catch (err) {
        console.error("Price calculation error:", err);
      } finally {
        setIsCalculating(false);
      }
    };

    calculatePrice();
  }, [date, slot, amenityType, customer]);

  const displayPrice = overridePrice ? customPrice : calculatedPrice;
  const remainingBalance =
    displayPrice && paymentAmount ? displayPrice - paymentAmount : displayPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!customer) {
      setError("Please select a customer");
      return;
    }

    if (!date || !slot || !amenityType) {
      setError("Please select amenity, date, and time slot");
      return;
    }

    const requestData: AdminBookingRequest = {
      user_type: customer.type,
      user_id: customer.user_id,
      customer_id: customer.customer_id,
      new_customer: customer.new_customer,
      amenity_type: amenityType,
      date,
      slot,
      event_type: (eventType as any) || undefined,
      purpose: purpose || undefined,
      attendee_count: attendeeCount,
      override_price: overridePrice ? customPrice : undefined,
      skip_approval: skipApproval,
      record_payment: recordPayment,
      payment_amount: recordPayment ? paymentAmount : undefined,
      payment_method: recordPayment ? paymentMethod : undefined,
      receipt_number: recordPayment ? receiptNumber : undefined,
      admin_notes_internal: adminNotes || undefined,
      customer_notes: customerNotes || undefined,
    };

    await onSubmit(requestData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Callout variant="error" icon={AlertCircle}>
          {error}
        </Callout>
      )}

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Customer
          </CardTitle>
          <CardDescription>
            Select a resident or create a new guest
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserSearchAndCreate
            value={customer}
            onChange={setCustomer}
            onError={setError}
          />
        </CardContent>
      </Card>

      {/* Booking Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Booking Details
          </CardTitle>
          <CardDescription>Select amenity, date, and time slot</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amenity">Amenity *</Label>
              <Select
                value={amenityType}
                onValueChange={(v) => setAmenityType(v as AmenityType)}
              >
                <SelectTrigger id="amenity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {amenityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slot">Time Slot *</Label>
              <Select
                value={slot}
                onValueChange={(v) => setSlot(v as TimeBlockSlot)}
              >
                <SelectTrigger id="slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slotOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="eventType">Event Type</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger id="eventType">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attendeeCount">Attendee Count</Label>
              <Input
                id="attendeeCount"
                type="number"
                min="1"
                value={attendeeCount || ""}
                onChange={(e) =>
                  setAttendeeCount(
                    e.target.value ? parseInt(e.target.value) : undefined,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Textarea
              id="purpose"
              placeholder="Describe the purpose of this booking..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Pricing
          </CardTitle>
          <CardDescription>
            {isCalculating
              ? "Calculating..."
              : calculatedPrice !== null
                ? `Calculated price: ₱${calculatedPrice.toLocaleString()}`
                : "Select amenity, date, and slot to calculate price"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="overridePrice"
              checked={overridePrice}
              onCheckedChange={(checked) =>
                setOverridePrice(checked as boolean)
              }
            />
            <Label htmlFor="overridePrice" className="cursor-pointer">
              Override price
            </Label>
          </div>

          {overridePrice && (
            <div className="space-y-2">
              <Label htmlFor="customPrice">Custom Price</Label>
              <Input
                id="customPrice"
                type="number"
                min="0"
                value={customPrice || ""}
                onChange={(e) =>
                  setCustomPrice(
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                placeholder="Enter custom price"
              />
            </div>
          )}

          {displayPrice !== null &&
            displayPrice !== undefined &&
            displayPrice > 0 && (
              <div className="p-4 rounded-lg bg-muted">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Amount:</span>
                  <span className="text-xl font-bold">
                    ₱{(displayPrice as number).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Admin Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Admin Options
          </CardTitle>
          <CardDescription>
            Additional booking options for admins
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="skipApproval"
              checked={skipApproval}
              onCheckedChange={(checked) => setSkipApproval(checked as boolean)}
            />
            <Label htmlFor="skipApproval" className="cursor-pointer">
              Skip approval (confirms booking immediately)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="recordPayment"
              checked={recordPayment}
              onCheckedChange={(checked) =>
                setRecordPayment(checked as boolean)
              }
            />
            <Label htmlFor="recordPayment" className="cursor-pointer">
              Record payment now
            </Label>
          </div>

          {recordPayment && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentAmount">Payment Amount</Label>
                  <Input
                    id="paymentAmount"
                    type="number"
                    min="0"
                    value={paymentAmount || ""}
                    onChange={(e) =>
                      setPaymentAmount(
                        e.target.value ? parseFloat(e.target.value) : undefined,
                      )
                    }
                    placeholder="Enter payment amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger id="paymentMethod">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethodOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="receiptNumber">Receipt Number</Label>
                <Input
                  id="receiptNumber"
                  value={receiptNumber}
                  onChange={(e) => setReceiptNumber(e.target.value)}
                  placeholder="Enter receipt number"
                />
              </div>

              {remainingBalance !== null &&
                remainingBalance !== undefined &&
                remainingBalance > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Remaining balance: ₱
                      {(remainingBalance as number).toLocaleString()}
                    </p>
                  </div>
                )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>
            Additional information for the booking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="adminNotes">Internal Admin Notes</Label>
            <Textarea
              id="adminNotes"
              placeholder="Notes visible only to admins..."
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerNotes">Customer Notes</Label>
            <Textarea
              id="customerNotes"
              placeholder="Notes visible to the customer..."
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !customer || !date || !slot}
        >
          {isSubmitting ? "Creating..." : "Create Booking"}
        </Button>
      </div>
    </form>
  );
}
