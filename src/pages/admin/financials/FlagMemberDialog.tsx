// src/pages/admin/financials/FlagMemberDialog.tsx
import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Search, UserX, Loader2 } from "lucide-react";
import {
  DELINQUENCY_REASON_LABELS,
  type DelinquencyReasonCode,
  type MemberSearchResult,
} from "@/types";

interface FlagMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "search" | "reason" | "confirm";

export function FlagMemberDialog({
  open,
  onOpenChange,
  onSuccess,
}: FlagMemberDialogProps) {
  const [step, setStep] = useState<Step>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMember, setSelectedMember] =
    useState<MemberSearchResult | null>(null);
  const [reasonCode, setReasonCode] = useState<DelinquencyReasonCode | null>(
    null,
  );
  const [reasonDetail, setReasonDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const response = await api.delinquency.searchMembers(searchQuery);
        if (response.data) {
          setSearchResults(response.data.members || []);
        }
      } catch (error) {
        console.error("Error searching members:", error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  function reset() {
    setStep("search");
    setSearchQuery("");
    setSearchResults([]);
    setSelectedMember(null);
    setReasonCode(null);
    setReasonDetail("");
    setSubmitting(false);
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      reset();
    }
    onOpenChange(newOpen);
  }

  function handleSelectMember(member: MemberSearchResult) {
    setSelectedMember(member);
    setStep("reason");
  }

  function handleSelectReason(code: DelinquencyReasonCode) {
    setReasonCode(code);
    setStep("confirm");
  }

  async function handleSubmit() {
    if (!selectedMember || !reasonCode) return;

    // For repeated_violation, reason_detail is required
    if (reasonCode === "repeated_violation" && !reasonDetail.trim()) {
      toast.error("Please specify which rule was violated");
      setStep("reason");
      return;
    }

    setSubmitting(true);

    try {
      const response = await api.delinquency.markDelinquent({
        lot_member_id: selectedMember.lot_member_id,
        reason_code: reasonCode,
        reason_detail:
          reasonCode === "repeated_violation" ? reasonDetail.trim() : undefined,
      });

      if (response.error) {
        toast.error(response.error);
        setSubmitting(false);
        return;
      }

      toast.success("Member flagged as delinquent");
      onSuccess();
      handleOpenChange(false);
    } catch (error) {
      console.error("Error flagging member:", error);
      toast.error("Failed to flag member as delinquent");
    } finally {
      setSubmitting(false);
    }
  }

  function getReasonDisplayText(): string {
    if (!reasonCode) return "";
    if (reasonCode === "repeated_violation" && reasonDetail.trim()) {
      return `${DELINQUENCY_REASON_LABELS[reasonCode]}: ${reasonDetail.trim()}`;
    }
    return DELINQUENCY_REASON_LABELS[reasonCode];
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600" />
            Flag Member as Delinquent
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Search */}
        {step === "search" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="search">Step 1 of 3: Find Member</Label>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or lot..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
            </div>

            {searching && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && searchQuery.length < 2 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Type to search...
              </p>
            )}

            {!searching &&
              searchQuery.length >= 2 &&
              searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No members found
                </p>
              )}

            {!searching && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {searchResults.map((member) => (
                  <button
                    key={member.lot_member_id}
                    type="button"
                    onClick={() => handleSelectMember(member)}
                    disabled={member.already_flagged === 1}
                    className="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {member.first_name} {member.last_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {member.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Block {member.block}, Lot {member.lot}
                        </p>
                      </div>
                      {member.already_flagged === 1 && (
                        <Badge variant="destructive" className="shrink-0">
                          Already flagged
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Select Reason */}
        {step === "reason" && selectedMember && (
          <div className="space-y-4">
            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">
                {selectedMember.first_name} {selectedMember.last_name}
              </p>
              <p className="text-muted-foreground">
                Block {selectedMember.block}, Lot {selectedMember.lot}
              </p>
            </div>

            <div>
              <Label>Step 2 of 3: Select Grounds</Label>
              <RadioGroup
                value={reasonCode || ""}
                onValueChange={(value) =>
                  handleSelectReason(value as DelinquencyReasonCode)
                }
                className="mt-3"
              >
                <div className="flex items-start space-x-2">
                  <RadioGroupItem
                    value="failure_to_pay"
                    id="failure_to_pay"
                    className="mt-1"
                  />
                  <Label
                    htmlFor="failure_to_pay"
                    className="cursor-pointer font-normal"
                  >
                    {DELINQUENCY_REASON_LABELS.failure_to_pay}
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem
                    value="repeated_violation"
                    id="repeated_violation"
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="repeated_violation"
                      className="cursor-pointer font-normal"
                    >
                      {DELINQUENCY_REASON_LABELS.repeated_violation}
                    </Label>
                    {reasonCode === "repeated_violation" && (
                      <Input
                        placeholder="Which rule was violated?"
                        value={reasonDetail}
                        onChange={(e) => setReasonDetail(e.target.value)}
                        className="mt-2"
                        autoFocus
                      />
                    )}
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem
                    value="detrimental_conduct"
                    id="detrimental_conduct"
                    className="mt-1"
                  />
                  <Label
                    htmlFor="detrimental_conduct"
                    className="cursor-pointer font-normal"
                  >
                    {DELINQUENCY_REASON_LABELS.detrimental_conduct}
                  </Label>
                </div>
                <div className="flex items-start space-x-2">
                  <RadioGroupItem
                    value="failure_to_attend"
                    id="failure_to_attend"
                    className="mt-1"
                  />
                  <Label
                    htmlFor="failure_to_attend"
                    className="cursor-pointer font-normal"
                  >
                    {DELINQUENCY_REASON_LABELS.failure_to_attend}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep("search");
                  setReasonCode(null);
                  setReasonDetail("");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (
                    reasonCode === "repeated_violation" &&
                    !reasonDetail.trim()
                  ) {
                    toast.error("Please specify which rule was violated");
                    return;
                  }
                  if (reasonCode) setStep("confirm");
                }}
                disabled={!reasonCode}
              >
                Next
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && selectedMember && reasonCode && (
          <div className="space-y-4">
            <div>
              <Label>Step 3 of 3: Confirm</Label>
              <div className="mt-3 border rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member:</span>
                  <span className="font-medium">
                    {selectedMember.first_name} {selectedMember.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lot:</span>
                  <span className="font-medium">
                    Block {selectedMember.block}, Lot {selectedMember.lot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Grounds:</span>
                  <span className="font-medium text-right">
                    {getReasonDisplayText()}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">
                  This action suspends voting rights immediately.
                </p>
                <p className="mt-1">
                  This cannot be undone without an explicit waiver.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("reason")}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Flagging...
                  </>
                ) : (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    Flag as Delinquent
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
