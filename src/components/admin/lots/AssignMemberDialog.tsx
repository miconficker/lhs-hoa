import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssignMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  onSuccess: () => void;
}

export function AssignMemberDialog({
  open,
  onOpenChange,
  householdId,
  onSuccess,
}: AssignMemberDialogProps) {
  const [userEmail, setUserEmail] = useState("");
  const [memberType, setMemberType] = useState<"primary_owner" | "secondary">(
    "primary_owner",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.lotMembers.assignMember({
        household_id: householdId,
        email: userEmail,
        member_type: memberType,
        notes,
      });
      onSuccess();
      onOpenChange(false);
      setUserEmail("");
      setNotes("");
    } catch (err: any) {
      setError(err.error || "Failed to assign member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Household Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user_email">User Email</Label>
              <Input
                id="user_email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Member Type</Label>
              <RadioGroup
                value={memberType}
                onValueChange={(value: "primary_owner" | "secondary") =>
                  setMemberType(value)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="primary_owner" id="primary_owner" />
                  <Label htmlFor="primary_owner">
                    Primary Owner (can vote)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="secondary" id="secondary" />
                  <Label htmlFor="secondary">Secondary Member (no vote)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Title deed presented 2026-03-10"
              />
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Assigning..." : "Assign Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
