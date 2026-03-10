import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Home, Clock } from "lucide-react";

export function MemberApprovalsPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadPendingMembers();
  }, []);

  async function loadPendingMembers() {
    setLoading(true);
    try {
      const result = await api.lotMembers.getPendingMembers();
      if (result.data?.members) {
        setMembers(result.data.members);
      }
    } catch (error) {
      logger.error("Error loading pending members", error, {
        component: "MemberApprovalsPage",
      });
    }
    setLoading(false);
  }

  const handleApprove = async (memberId: string) => {
    setProcessing(memberId);
    try {
      await api.lotMembers.verifyMember(memberId, "Approved via admin panel");
      await loadPendingMembers();
    } catch (error) {
      logger.error("Error approving member", error, {
        component: "MemberApprovalsPage",
      });
      alert("Failed to approve member");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (memberId: string) => {
    if (!confirm("Are you sure you want to reject this membership request?"))
      return;
    setProcessing(memberId);
    try {
      await api.lotMembers.removeMember(memberId);
      await loadPendingMembers();
    } catch (error) {
      logger.error("Error rejecting member", error, {
        component: "MemberApprovalsPage",
      });
      alert("Failed to reject member");
    } finally {
      setProcessing(null);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
        Admin access required.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Pending Member Approvals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve household member requests
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {members.length} pending request{members.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900">
              About Member Approvals
            </h3>
            <p className="text-sm text-blue-700 mt-1">
              Primary owners can add secondary members to their household, but
              these requests require admin approval before the member is
              verified and can access the system.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Members List */}
      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No pending member approvals
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* User Info */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">
                          {member.first_name || ""} {member.last_name || ""}
                        </h3>
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
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {member.email}
                      </p>
                    </div>

                    {/* Household Info */}
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg mb-4">
                      <Home className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">
                        Block {member.block}, Lot {member.lot} —{" "}
                        {member.address}
                      </span>
                    </div>

                    {/* Notes */}
                    {member.notes && (
                      <div className="text-sm text-muted-foreground mb-4">
                        <span className="font-medium">Notes: </span>
                        {member.notes}
                      </div>
                    )}

                    {/* Requested Date */}
                    <div className="text-xs text-muted-foreground">
                      Requested:{" "}
                      {new Date(member.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(member.id)}
                      disabled={processing === member.id}
                    >
                      {processing === member.id ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(member.id)}
                      disabled={processing === member.id}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
