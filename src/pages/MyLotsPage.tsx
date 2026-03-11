import { useEffect, useState } from "react";
import React from "react";
import { api } from "@/lib/api";
import type { MyLot, MyLotsSummary } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Users,
  Plus,
} from "lucide-react";
import { HouseholdMembersPanel } from "@/components/my-lots/HouseholdMembersPanel";
import { AddMemberDialog } from "@/components/my-lots/AddMemberDialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Callout } from "@/components/ui/callout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
import { logger } from "@/lib/logger";

export function MyLotsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<MyLotsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLot, setEditingLot] = useState<MyLot | null>(null);
  const [newStreet, setNewStreet] = useState("");
  const [saving, setSaving] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedLotForMember, setSelectedLotForMember] =
    useState<MyLot | null>(null);

  useEffect(() => {
    loadMyLots();
  }, []);

  async function loadMyLots() {
    setLoading(true);
    try {
      const result = await api.households.getMyLots();
      if (result.data) {
        setData(result.data);
      }
    } catch (error) {
      logger.error("Error loading my lots", error, { component: "MyLotsPage" });
    }
    setLoading(false);
  }

  function openEditDialog(lot: MyLot) {
    setEditingLot(lot);
    setNewStreet(lot.street || "");
    setShowEditDialog(true);
  }

  function toggleLotExpanded(lotId: string) {
    setExpandedLots((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lotId)) {
        newSet.delete(lotId);
      } else {
        newSet.add(lotId);
      }
      return newSet;
    });
  }

  function openAddMemberDialog(lot: MyLot) {
    setSelectedLotForMember(lot);
    setShowAddMemberDialog(true);
  }

  function handleMemberAdded() {
    // Reload lots data to refresh member counts
    loadMyLots();
  }

  async function saveAddress() {
    if (!editingLot) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/households/${editingLot.lot_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ street: newStreet }),
      });

      if (response.ok) {
        const result = await response.json();
        // Update local state with the new address from server
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            lots: prev.lots.map((lot) =>
              lot.lot_id === editingLot.lot_id
                ? { ...lot, street: newStreet, address: result.address }
                : lot,
            ),
          };
        });
        setShowEditDialog(false);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to update street");
      }
    } catch (error) {
      logger.error("Error updating street", error, {
        component: "MyLotsPage",
      });
      alert("Failed to update street");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <Callout variant="warning" title="Authentication Required">
        Please log in to view your lots.
      </Callout>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <Callout variant="error" title="Error Loading Data">
        Failed to load your lots. Please try again.
      </Callout>
    );
  }

  const { lots, ...summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-card-foreground">My Lots</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your lots, track dues, and check voting status
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">
          Summary
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Properties</p>
            <p className="text-3xl font-bold text-card-foreground">
              {summary.total_properties ?? summary.total_lots}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Lots</p>
            <p className="text-3xl font-bold text-card-foreground">
              {summary.total_lots}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Area</p>
            <p className="text-3xl font-bold text-card-foreground">
              {summary.total_sqm.toLocaleString()} m²
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Annual Dues</p>
            <p className="text-3xl font-bold text-card-foreground">
              ₱{summary.annual_dues_total.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              ₱{summary.rate_per_sqm}/sqm/month
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Voting Status</p>
            <div className="flex items-center gap-2">
              {summary.voting_status === "eligible" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-[hsl(var(--status-success-fg))]" />
                  <span className="text-sm font-medium text-[hsl(var(--status-success-fg))]">
                    Eligible
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-[hsl(var(--status-error-fg))]" />
                  <span className="text-sm font-medium text-[hsl(var(--status-error-fg))]">
                    Suspended
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Unpaid Periods Warning */}
        {summary.unpaid_periods.length > 0 && (
          <Callout
            variant="error"
            title="Unpaid Dues - Voting Suspended"
            action={
              <Button
                size="sm"
                onClick={() => (window.location.href = "/payments")}
              >
                Pay Now
              </Button>
            }
          >
            You have unpaid dues for: {summary.unpaid_periods.join(", ")}.{" "}
            Please pay to restore your voting rights.
          </Callout>
        )}
      </div>

      {/* Lots List */}
      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-card-foreground">
            Your Lots ({lots.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <table className="w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Street
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Block
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Lot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Size (m²)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Annual Dues
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {lots.map((lot) => {
                  const isExpanded = expandedLots.has(lot.lot_id);

                  return (
                    <React.Fragment key={lot.lot_id}>
                      {/* Main Lot Row */}
                      <tr className={isExpanded ? "bg-muted/30" : ""}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                          {lot.street || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                          {lot.block || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
                          {lot.lot || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                          {lot.address}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            variant={
                              lot.lot_type === "resort"
                                ? "info"
                                : lot.lot_type === "commercial"
                                  ? "neutral"
                                  : "success"
                            }
                            srLabel={`Lot type: ${
                              lot.lot_type === "residential"
                                ? "Residential"
                                : lot.lot_type === "resort"
                                  ? "Resort"
                                  : lot.lot_type === "commercial"
                                    ? "Commercial"
                                    : "Unknown"
                            }`}
                          >
                            {lot.lot_type === "residential"
                              ? "Residential"
                              : lot.lot_type === "resort"
                                ? "Resort"
                                : lot.lot_type === "commercial"
                                  ? "Commercial"
                                  : "Unknown"}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusBadge
                            variant={
                              lot.lot_status === "built"
                                ? "success"
                                : lot.lot_status === "under_construction"
                                  ? "warning"
                                  : "neutral"
                            }
                            srLabel={`Lot status: ${
                              lot.lot_status === "built"
                                ? "Built"
                                : lot.lot_status === "under_construction"
                                  ? "Under Construction"
                                  : "Vacant Lot"
                            }`}
                          >
                            {lot.lot_status === "built"
                              ? "Built"
                              : lot.lot_status === "under_construction"
                                ? "Under Construction"
                                : "Vacant Lot"}
                          </StatusBadge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {lot.lot_size_sqm?.toLocaleString() || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground">
                          ₱{lot.annual_dues.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditDialog(lot)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => toggleLotExpanded(lot.lot_id)}
                              className="text-gray-600 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted"
                              title={
                                isExpanded ? "Hide members" : "View members"
                              }
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              <Users className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Members Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="px-6 py-4 bg-muted/20">
                            <div className="max-w-4xl">
                              <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-card-foreground">
                                  Household Members
                                </h4>
                                <Button
                                  size="sm"
                                  onClick={() => openAddMemberDialog(lot)}
                                  className="flex items-center gap-1"
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Member
                                </Button>
                              </div>
                              <HouseholdMembersPanel
                                householdId={lot.lot_id}
                                lotAddress={lot.address}
                                isPrimaryOwner={true} // TODO: Check if current user is primary owner
                                onMemberChange={handleMemberAdded}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <Callout variant="info" title="About Your Lots">
        <p className="text-sm mt-1">
          This page shows all lots registered to your account. Annual dues are
          calculated based on lot size (₱{summary.rate_per_sqm} per square meter
          per month × 12 months).
        </p>
        <p className="text-sm mt-1">
          Voting: 1 lot = 1 vote. If you own multiple lots, your single vote
          counts for all your lots.
        </p>
      </Callout>

      {/* Edit Address Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Street</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                value={newStreet}
                onChange={(e) => setNewStreet(e.target.value)}
                placeholder="e.g., Main Street"
              />
              <p className="text-xs text-muted-foreground">
                Specify which street your entrance faces (for lots facing
                multiple streets)
              </p>
            </div>
            <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/50">
              <p className="font-medium mb-1">Current location:</p>
              <p>Street: {editingLot?.street || "—"}</p>
              <p>Block: {editingLot?.block || "—"}</p>
              <p>Lot: {editingLot?.lot || "—"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={saveAddress} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      {selectedLotForMember && (
        <AddMemberDialog
          open={showAddMemberDialog}
          onOpenChange={setShowAddMemberDialog}
          householdId={selectedLotForMember.lot_id}
          onSuccess={handleMemberAdded}
        />
      )}
    </div>
  );
}
