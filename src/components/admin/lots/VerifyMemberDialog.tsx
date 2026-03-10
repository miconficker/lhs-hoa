import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LotMemberDetail } from "./types";

interface VerifyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: LotMemberDetail | null;
  onSuccess: () => void;
}

export function VerifyMemberDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: VerifyMemberDialogProps) {
  const [notes, setNotes] = useState(member?.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!member) return;
    setLoading(true);
    setError(null);

    try {
      await api.lotMembers.verifyMember(member.id, notes);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.error || "Failed to verify member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify Ownership</DialogTitle>
        </DialogHeader>
        {member && (
          <div className="py-4">
            <div className="space-y-2 mb-4">
              <p>
                <strong>Name:</strong> {member.first_name} {member.last_name}
              </p>
              <p>
                <strong>Email:</strong> {member.email}
              </p>
              <p>
                <strong>Type:</strong>{" "}
                {member.member_type === "primary_owner"
                  ? "Primary Owner"
                  : "Secondary"}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Verification Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Title deed verified 2026-03-10"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleVerify} disabled={loading}>
            {loading ? "Verifying..." : "Verify Ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
