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
import { Search, Home } from "lucide-react";
import type { UnassignedLot, LotMemberDetail } from "./types";
import { AssignMemberDialog } from "./AssignMemberDialog";
import { LotMembersList } from "./LotMembersList";

export function LotsManagementPage() {
  const [unassignedLots, setUnassignedLots] = useState<UnassignedLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<UnassignedLot | null>(null);
  const [members, setMembers] = useState<LotMemberDetail[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnassignedLots();
  }, []);

  const loadUnassignedLots = async () => {
    setLoading(true);
    try {
      const resp = await api.lotMembers.getUnassignedLots();
      setUnassignedLots(resp.data?.lots || []);
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

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

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
          <TabsTrigger value="assigned">Assigned Lots</TabsTrigger>
          <TabsTrigger value="all">All Lots</TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address or lot number..."
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

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUnassigned.map((lot) => (
              <Card key={lot.id} className="cursor-pointer hover:bg-accent/50">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {lot.block}-{lot.lot}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {lot.address}
                      </p>
                    </div>
                    <Home className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="outline">{lot.lot_type}</Badge>
                    <Badge variant="secondary">{lot.lot_status}</Badge>
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={() => {
                      setSelectedLot(lot);
                      setAssignDialogOpen(true);
                    }}
                  >
                    Assign Owner
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUnassigned.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No unassigned lots match your filters
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assigned">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Assigned lots view - to be implemented with full lots list
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              All lots view - to be implemented
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedLot && (
        <>
          <LotMembersList
            members={members}
            onRefresh={() => {
              loadUnassignedLots();
              if (selectedLot) loadMembers(selectedLot.id);
            }}
          />
          <AssignMemberDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            householdId={selectedLot.id}
            onSuccess={() => {
              loadUnassignedLots();
              if (selectedLot) loadMembers(selectedLot.id);
            }}
          />
        </>
      )}
    </div>
  );
}
