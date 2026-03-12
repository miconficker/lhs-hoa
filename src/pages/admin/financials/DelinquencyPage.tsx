// src/pages/admin/financials/DelinquencyPage.tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DelinquentMember, DelinquencySummary } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { Receipt, UserCheck, AlertCircle } from "lucide-react";
import { DemandGenerationModal } from "./DemandGenerationModal";
import { DelinquentTable } from "./DelinquentTable";
import { Button } from "@/components/ui/button";

export function DelinquencyPage() {
  const { user } = useAuth();
  const [delinquents, setDelinquents] = useState<DelinquentMember[]>([]);
  const [summary, setSummary] = useState<DelinquencySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDemandModal, setShowDemandModal] = useState(false);

  useEffect(() => {
    loadDelinquents();
  }, []);

  async function loadDelinquents() {
    setLoading(true);
    try {
      const response = await api.delinquency.getDelinquents();
      if (response.data) {
        setDelinquents((response.data as any).delinquents || []);
        setSummary((response.data as any).summary);
      }
    } catch (error) {
      console.error("Error loading delinquents:", error);
    }
    setLoading(false);
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Delinquency Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage delinquent homeowners and payment demands
          </p>
        </div>
        <Button onClick={() => setShowDemandModal(true)}>
          <Receipt className="w-4 h-4 mr-2" />
          Generate Demands
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total Delinquent
                </p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <UserCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manual Override</p>
                <p className="text-2xl font-bold">{summary.manual}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-2xl font-bold">
                  ₱{summary.total_amount_due.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delinquent Table */}
      <DelinquentTable
        delinquents={delinquents}
        loading={loading}
        onRefresh={loadDelinquents}
      />

      {/* Demand Generation Modal */}
      <DemandGenerationModal
        open={showDemandModal}
        onOpenChange={setShowDemandModal}
        onComplete={loadDelinquents}
      />
    </div>
  );
}
