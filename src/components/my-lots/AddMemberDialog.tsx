import { useState, useEffect } from "react";
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

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  onSuccess: () => void;
}

interface SuggestedUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  householdId,
  onSuccess,
}: AddMemberDialogProps) {
  const [userEmail, setUserEmail] = useState("");
  const [memberType, setMemberType] = useState<"primary_owner" | "secondary">(
    "secondary",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch user suggestions when email changes
  useEffect(() => {
    if (userEmail.length >= 2) {
      const fetchSuggestions = async () => {
        try {
          const resp = await api.admin.searchUsers(userEmail);
          if (resp.data?.users) {
            setSuggestions(resp.data.users);
            setShowSuggestions(true);
          }
        } catch {
          setSuggestions([]);
        }
      };
      fetchSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [userEmail]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setUserEmail("");
      setMemberType("secondary");
      setNotes("");
      setError(null);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.lotMembers.assignMember({
        household_id: householdId,
        email: userEmail,
        member_type: memberType,
        notes: notes || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.error || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Household Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2 relative">
              <Label htmlFor="user_email">User Email</Label>
              <Input
                id="user_email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="user@example.com"
                required
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setUserEmail(user.email);
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user.email}
                        </div>
                        {(user.first_name || user.last_name) && (
                          <div className="text-xs text-muted-foreground">
                            {user.first_name} {user.last_name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {user.role}
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
                placeholder="e.g., Family member, Spouse, etc."
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
