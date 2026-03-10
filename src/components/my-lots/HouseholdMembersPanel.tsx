import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, X, Loader2 } from "lucide-react";

export interface HouseholdMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_type: "primary_owner" | "secondary";
  can_vote: boolean;
  verified: boolean;
  verified_at?: string;
  notes?: string;
}

interface HouseholdMembersPanelProps {
  householdId: string;
  lotAddress: string;
  isPrimaryOwner: boolean; // Whether current user is primary owner (can manage)
  onMemberChange?: () => void; // Callback after add/remove
}

export function HouseholdMembersPanel({
  householdId,
  lotAddress,
  isPrimaryOwner,
  onMemberChange,
}: HouseholdMembersPanelProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load members on mount and householdId change
  useEffect(() => {
    loadMembers();
  }, [householdId]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.lotMembers.getHouseholdMembers(householdId);
      if (resp.data?.members) {
        setMembers(
          resp.data.members.map(
            (m): HouseholdMember => ({
              ...m,
              member_type: m.member_type as "primary_owner" | "secondary",
            }),
          ),
        );
      }
    } catch (err: any) {
      setError(err.error || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this household?`)) {
      return;
    }

    try {
      await api.lotMembers.removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      onMemberChange?.();
    } catch (err: any) {
      alert(err.error || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={loadMembers}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            Household Members
          </h3>
          <p className="text-xs text-muted-foreground">{lotAddress}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {members.length} {members.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No members assigned</p>
          {isPrimaryOwner && (
            <p className="text-xs text-muted-foreground mt-1">
              Add household members using the button below
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                {member.verified ? (
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
                    <span className="text-yellow-600 text-xs">!</span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    member.member_type === "primary_owner"
                      ? "default"
                      : "secondary"
                  }
                  className="text-xs"
                >
                  {member.member_type === "primary_owner"
                    ? "Primary"
                    : "Secondary"}
                </Badge>
                {isPrimaryOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      handleRemoveMember(
                        member.id,
                        `${member.first_name} ${member.last_name}`,
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
