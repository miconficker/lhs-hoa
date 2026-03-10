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
import { Search, Home, UserCheck } from "lucide-react";
import type { UnassignedLot, LotMemberDetail } from "./types";
import type { LotOwnership } from "@/types";
import { AssignMemberDialog } from "./AssignMemberDialog";
import { LotMembersList } from "./LotMembersList";

export function LotsManagementPage() {
  const [allLots, setAllLots] = useState<LotOwnership[]>([]);
  const [unassignedLots, setUnassignedLots] = useState<UnassignedLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<
    LotOwnership | UnassignedLot | null
  >(null);
  const [members, setMembers] = useState<LotMemberDetail[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
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
            id: m.user_id,
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

  const renderLotCard = (
    lot: LotOwnership | UnassignedLot,
    showAssignButton = false,
  ) => {
    const info = getLotDisplayInfo(lot);
    return (
      <Card
        key={info.id}
        className="cursor-pointer hover:bg-accent/50"
        onClick={() => handleLotClick(lot)}
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
            <Home className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-2" />
          </div>
          <div className="flex gap-2 mb-3">
            <Badge variant="outline">{info.lotType}</Badge>
            <Badge variant="secondary">{info.lotStatus}</Badge>
          </div>
          {showAssignButton && (
            <Button
              className="w-full"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLot(lot);
                setAssignDialogOpen(true);
              }}
            >
              Assign Owner
            </Button>
          )}
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
            {filteredUnassigned.map((lot) => renderLotCard(lot, true))}
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

      {/* Members List and Assign Dialog */}
      {selectedLot && (
        <>
          <LotMembersList
            members={members}
            onRefresh={() => {
              loadData();
              if (selectedLot) {
                const lotId =
                  "lot_id" in selectedLot ? selectedLot.lot_id : selectedLot.id;
                loadMembers(lotId);
              }
            }}
          />
          {"lot_id" in selectedLot && (
            <AssignMemberDialog
              open={assignDialogOpen}
              onOpenChange={setAssignDialogOpen}
              householdId={selectedLot.lot_id}
              onSuccess={() => {
                loadData();
                if (selectedLot) loadMembers(selectedLot.lot_id);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
