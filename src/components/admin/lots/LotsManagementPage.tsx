import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Search, Home, UserCheck, Pencil, Users, X } from "lucide-react";
import type { UnassignedLot, LotMemberDetail } from "./types";
import type { LotOwnership } from "@/types";
import { AssignMemberDialog } from "./AssignMemberDialog";
import { EditLotDialog } from "./EditLotDialog";

export function LotsManagementPage() {
  const [allLots, setAllLots] = useState<LotOwnership[]>([]);
  const [unassignedLots, setUnassignedLots] = useState<UnassignedLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<
    LotOwnership | UnassignedLot | null
  >(null);
  const [members, setMembers] = useState<LotMemberDetail[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [lotsResp, unassignedResp] = await Promise.all([
        api.admin.getLotsWithOwnership(),
        api.lotMembers.getUnassignedLots(),
      ]);

      if (lotsResp.data) {
        setAllLots(lotsResp.data.lots || []);
      }
      if (unassignedResp.data) {
        setUnassignedLots(unassignedResp.data.lots || []);
      }
    } catch (err) {
      console.error("Failed to load lots:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (householdId: string) => {
    try {
      const resp = await api.lotMembers.getHouseholdMembers(householdId);
      setMembers(
        (resp.data?.members || []).map(
          (m): LotMemberDetail => ({
            ...m,
            id: m.id, // Use lot_members.id for delete operations
            user_id: m.user_id, // Keep user_id separate
            member_type: m.member_type as "primary_owner" | "secondary",
          }),
        ),
      );
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  };

  // Filter lots for "All Lots" tab
  const filteredAllLots = allLots.filter((lot) => {
    const matchesSearch =
      !searchTerm ||
      lot.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${lot.block_number}-${lot.lot_number}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      lot.lot_label?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || lot.lot_type === filterType;
    const matchesStatus =
      filterStatus === "all" || lot.lot_status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Filter lots for "Assigned Lots" tab (has owner_user_id)
  const assignedLots = allLots.filter((lot) => lot.owner_user_id);
  const filteredAssignedLots = assignedLots.filter((lot) => {
    const matchesSearch =
      !searchTerm ||
      lot.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${lot.block_number}-${lot.lot_number}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      lot.lot_label?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || lot.lot_type === filterType;
    const matchesStatus =
      filterStatus === "all" || lot.lot_status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  // Filter unassigned lots
  const filteredUnassigned = unassignedLots.filter((lot) => {
    const matchesSearch =
      !searchTerm ||
      lot.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${lot.block}-${lot.lot}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || lot.lot_type === filterType;
    const matchesStatus =
      filterStatus === "all" || lot.lot_status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleLotClick = async (lot: LotOwnership | UnassignedLot) => {
    setSelectedLot(lot);
    setSheetOpen(true);
    // Load members for this household
    if ("lot_id" in lot) {
      await loadMembers(lot.lot_id);
    } else {
      await loadMembers(lot.id);
    }
  };

  const getLotDisplayInfo = (lot: LotOwnership | UnassignedLot) => {
    if ("lot_id" in lot) {
      return {
        id: lot.lot_id,
        block: lot.block_number,
        lot: lot.lot_number,
        address:
          lot.address ||
          `${lot.street || ""} Block ${lot.block_number}, Lot ${lot.lot_number}`,
        lotType: lot.lot_type || "residential",
        lotStatus: lot.lot_status,
        lotLabel: lot.lot_label,
        hasOwner: !!lot.owner_user_id,
        ownerEmail: lot.owner_email,
        ownerName: lot.owner_name,
      };
    }
    return {
      id: lot.id,
      block: lot.block,
      lot: lot.lot,
      address: lot.address,
      lotType: lot.lot_type,
      lotStatus: lot.lot_status,
      lotLabel: undefined, // UnassignedLot doesn't have lot_label
      hasOwner: false,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const renderLotCard = (lot: LotOwnership | UnassignedLot) => {
    const info = getLotDisplayInfo(lot);
    const hasOwnerId = "owner_user_id" in lot && lot.owner_user_id;

    return (
      <Card
        key={info.id}
        className="hover:bg-accent/50 hover:shadow-md transition-all"
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold">
                  {info.block}-{info.lot}
                </h3>
                {info.lotLabel && (
                  <Badge variant="outline" className="text-xs">
                    {info.lotLabel}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{info.address}</p>
              {info.hasOwner && (
                <div className="flex items-center gap-1 mt-2">
                  <UserCheck className="h-3 w-3 text-green-600" />
                  <span className="text-xs text-green-600">
                    {info.ownerName || info.ownerEmail || "Assigned"}
                  </span>
                </div>
              )}
            </div>
            <Home className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
          <div className="flex gap-2 mb-3">
            <Badge variant="outline">{info.lotType}</Badge>
            <Badge variant="secondary">{info.lotStatus}</Badge>
          </div>
          <div className="flex gap-2">
            {"lot_id" in lot && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLot(lot);
                    setEditDialogOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLot(lot);
                    setAssignDialogOpen(true);
                  }}
                >
                  {hasOwnerId ? "Add Member" : "Assign Owner"}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={hasOwnerId ? "outline" : "default"}
              className="flex-1"
              onClick={() => handleLotClick(lot)}
            >
              <Users className="h-3 w-3 mr-1" />
              {hasOwnerId ? "View Members" : "Manage"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lots Management</h1>
        <p className="text-muted-foreground">
          Manage lot ownership and household members
        </p>
      </div>

      <Tabs defaultValue="unassigned">
        <TabsList>
          <TabsTrigger value="unassigned">
            Unassigned ({unassignedLots.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned ({allLots.filter((l) => l.owner_user_id).length})
          </TabsTrigger>
          <TabsTrigger value="all">All Lots ({allLots.length})</TabsTrigger>
        </TabsList>

        {/* Filters - shown on all tabs */}
        <div className="flex gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address, lot number, or label..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Lot type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="resort">Resort</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="community">Community</SelectItem>
              <SelectItem value="utility">Utility</SelectItem>
              <SelectItem value="open_space">Open Space</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="built">Built</SelectItem>
              <SelectItem value="vacant_lot">Vacant Lot</SelectItem>
              <SelectItem value="under_construction">
                Under Construction
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Unassigned Lots Tab */}
        <TabsContent value="unassigned" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUnassigned.map((lot) => renderLotCard(lot))}
          </div>

          {filteredUnassigned.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No unassigned lots match your filters
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Assigned Lots Tab */}
        <TabsContent value="assigned" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssignedLots.map((lot) => renderLotCard(lot))}
          </div>

          {filteredAssignedLots.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No assigned lots match your filters
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Lots Tab */}
        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAllLots.map((lot) => renderLotCard(lot))}
          </div>

          {filteredAllLots.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No lots match your filters
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Members Sheet - slides in from right */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md overflow-y-auto"
        >
          {selectedLot && (
            <>
              <SheetHeader>
                <SheetTitle>Household Members</SheetTitle>
                <SheetDescription>
                  {getLotDisplayInfo(selectedLot).address} • Block{" "}
                  {getLotDisplayInfo(selectedLot).block}, Lot{" "}
                  {getLotDisplayInfo(selectedLot).lot}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Members List */}
                <div className="space-y-3">
                  {members.length === 0 ? (
                    <div className="text-center py-8 border rounded-lg bg-muted/30">
                      <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No members assigned
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use the button below to assign household members
                      </p>
                    </div>
                  ) : (
                    members.map((member) => (
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={async () => {
                              if (!confirm("Remove this member?")) return;
                              try {
                                await api.lotMembers.removeMember(member.id);
                                const lotId =
                                  "lot_id" in selectedLot
                                    ? selectedLot.lot_id
                                    : selectedLot.id;
                                await loadMembers(lotId);
                              } catch {
                                alert("Failed to remove member");
                              }
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Member Button */}
                {"lot_id" in selectedLot && (
                  <Button
                    className="w-full"
                    onClick={() => setAssignDialogOpen(true)}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Add Household Member
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialogs */}
      {selectedLot && "lot_id" in selectedLot && (
        <>
          <AssignMemberDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            householdId={selectedLot.lot_id}
            onSuccess={async () => {
              await loadData();
              await loadMembers(selectedLot.lot_id);
            }}
          />
          <EditLotDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            lot={selectedLot as LotOwnership}
            onSuccess={() => {
              loadData();
            }}
          />
        </>
      )}
    </div>
  );
}
