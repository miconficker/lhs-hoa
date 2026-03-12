// src/pages/admin/financials/WaiveDelinquencyDialog.tsx
import { useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Ban } from "lucide-react";

interface WaiveDelinquencyDialogProps {
  delinquentId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function WaiveDelinquencyDialog({
  delinquentId,
  memberName,
  open,
  onOpenChange,
  onComplete,
}: WaiveDelinquencyDialogProps) {
  const [waiverReason, setWaiverReason] = useState("");
  const [waiving, setWaiving] = useState(false);

  async function handleWaive(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!waiverReason.trim()) {
      toast.error("Please provide a reason for waiving this delinquency");
      return;
    }

    setWaiving(true);

    try {
      const response = await api.delinquency.waiveDelinquency(delinquentId, {
        waiver_reason: waiverReason.trim(),
      });

      if (response.error) {
        toast.error(response.error);
        setWaiving(false);
        return;
      }

      toast.success("Delinquency waived successfully");
      onComplete();
      onOpenChange(false);
      setWaiverReason("");
    } catch (error) {
      console.error("Error waiving delinquency:", error);
      toast.error("Failed to waive delinquency");
    } finally {
      setWaiving(false);
    }
  }

  function handleClose() {
    setWaiverReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-orange-600" />
            Waive Delinquency
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleWaive} className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium">Member: {memberName}</p>
            <p className="text-muted-foreground mt-1">
              This will restore voting rights immediately if all other
              requirements are met.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waiverReason">Waive Reason *</Label>
            <textarea
              id="waiverReason"
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="Explain why this delinquency is being waived..."
              rows={3}
              required
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the audit trail
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={waiving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={waiving} variant="destructive">
              {waiving ? "Waiving..." : "Waive Delinquency"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
