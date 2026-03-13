import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const amenityLabels: Record<string, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
};

const slotLabels: Record<string, string> = {
  AM: "Morning",
  PM: "Afternoon",
  FULL_DAY: "Full Day",
};

export function PendingInquiriesTab() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    inquiryId: string | null;
  }>({
    open: false,
    inquiryId: null,
  });
  const [rejectionReason, setRejectionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, []);

  async function loadInquiries() {
    try {
      setLoading(true);
      const result = await api.adminPublicBookings.getPendingInquiries();
      if (result.data?.inquiries) {
        setInquiries(result.data.inquiries);
      }
    } catch (error) {
      console.error("Error loading inquiries:", error);
      toast.error("Failed to load inquiries");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(inquiryId: string) {
    try {
      setSubmitting(true);
      const result = await api.adminPublicBookings.approveInquiry(inquiryId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inquiry approved. Payment link sent to guest.");
      loadInquiries();
    } catch (error) {
      console.error("Error approving inquiry:", error);
      toast.error("Failed to approve inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  function openRejectDialog(inquiryId: string) {
    setRejectDialog({ open: true, inquiryId: inquiryId });
    setRejectionReason("");
  }

  async function handleReject() {
    if (!rejectDialog.inquiryId || !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      setSubmitting(true);
      const result = await api.adminPublicBookings.rejectInquiry(
        rejectDialog.inquiryId,
        {
          reason: rejectionReason,
        },
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Inquiry rejected. Notification sent to guest.");
      setRejectDialog({ open: false, inquiryId: null });
      setRejectionReason("");
      loadInquiries();
    } catch (error) {
      console.error("Error rejecting inquiry:", error);
      toast.error("Failed to reject inquiry");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No pending inquiries</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Submitted</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inquiries.map((inquiry) => (
              <TableRow key={inquiry.id}>
                <TableCell className="text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div>
                        {new Date(inquiry.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(inquiry.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">{inquiry.guest_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {inquiry.guest_email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {inquiry.guest_phone}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {amenityLabels[inquiry.amenity_type]}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(inquiry.date).toLocaleDateString()} ·{" "}
                      {slotLabels[inquiry.slot]}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {inquiry.guest_notes?.substring(0, 50)}
                      {inquiry.guest_notes?.length > 50 ? "..." : ""}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-medium">
                  ₱{inquiry.amount?.toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleApprove(inquiry.id)}
                      disabled={submitting}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => openRejectDialog(inquiry.id)}
                      disabled={submitting}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog({ open, inquiryId: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Inquiry</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this inquiry. The guest will
              be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason *</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this inquiry is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {rejectionReason.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, inquiryId: null })}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={submitting || !rejectionReason.trim()}
            >
              {submitting ? "Rejecting..." : "Reject Inquiry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
