// src/pages/admin/financials/DelinquentActions.tsx
import { useState } from "react";
import type { DelinquentMember } from "@/types";
import { MoreVertical, Eye, MessageSquare, Ban } from "lucide-react";
import { WaiveDelinquencyDialog } from "./WaiveDelinquencyDialog";
import { toast } from "sonner";

interface DelinquentActionsProps {
  delinquent: DelinquentMember;
  onRefresh: () => void;
}

export function DelinquentActions({
  delinquent,
  onRefresh,
}: DelinquentActionsProps) {
  const [open, setOpen] = useState(false);
  const [showWaiveDialog, setShowWaiveDialog] = useState(false);

  function handleSendReminder() {
    // TODO: Implement reminder sending
    toast.info("Reminder feature coming soon");
  }

  return (
    <>
      <div className="relative inline-block text-left">
        <button
          onClick={() => setOpen(!open)}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-20 w-48 bg-card border rounded-lg shadow-lg py-1">
              <button
                onClick={() => {
                  setOpen(false);
                  // Show details modal (TODO)
                  toast.info("Details view coming soon");
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  handleSendReminder();
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Send Reminder
              </button>

              {delinquent.delinquency_type === "manual" && delinquent.id && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowWaiveDialog(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent text-orange-600 dark:text-orange-400 flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Waive Delinquency
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showWaiveDialog && delinquent.id && (
        <WaiveDelinquencyDialog
          delinquentId={delinquent.id}
          memberName={delinquent.member.name}
          open={showWaiveDialog}
          onOpenChange={setShowWaiveDialog}
          onComplete={() => {
            onRefresh();
            setShowWaiveDialog(false);
          }}
        />
      )}
    </>
  );
}
