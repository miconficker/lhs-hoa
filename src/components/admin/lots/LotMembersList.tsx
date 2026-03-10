import { useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";
import type { LotMemberDetail } from "./types";
import { VerifyMemberDialog } from "./VerifyMemberDialog";

interface LotMembersListProps {
  members: LotMemberDetail[];
  onRefresh: () => void;
}

export function LotMembersList({ members, onRefresh }: LotMembersListProps) {
  const [selectedMember, setSelectedMember] = useState<LotMemberDetail | null>(
    null,
  );
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleVerify = (member: LotMemberDetail) => {
    setSelectedMember(member);
    setVerifyDialogOpen(true);
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    setLoading(memberId);
    try {
      await api.lotMembers.removeMember(memberId);
      onRefresh();
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove member");
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Household Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members assigned</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {member.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
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
                    >
                      {member.member_type === "primary_owner"
                        ? "Primary Owner"
                        : "Secondary"}
                    </Badge>
                    {!member.verified && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerify(member)}
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(member.id)}
                      disabled={loading === member.id}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedMember && (
        <VerifyMemberDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          member={selectedMember}
          onSuccess={onRefresh}
        />
      )}
    </>
  );
}
