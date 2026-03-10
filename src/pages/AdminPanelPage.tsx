import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api, type AdminUser, type AdminHousehold } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import type { LotOwnership, LotStatus, LotType, User, UserRole } from "@/types";
import { PaymentVerificationQueue } from "@/components/PaymentVerificationQueue";
import { LateFeeConfig } from "@/components/LateFeeConfig";
import { PaymentExport } from "@/components/PaymentExport";
import { logger } from "@/lib/logger";
import { TableWithSelection } from "@/components/admin/TableWithSelection";
import { BulkActionToolbar } from "@/components/admin/BulkActionToolbar";
import { AssignOwnerDialog } from "@/components/admin/AssignOwnerDialog";
import { BulkConfirmationDialog } from "@/components/admin/BulkConfirmationDialog";
import { toast } from "sonner";
import { Sidebar } from "@/components/admin/Sidebar";
import { Menu } from "lucide-react";
import AdminReservationsPage from "./admin/reservations/index";
import { AdminLotsPage } from "./AdminLotsPage";
import { DuesConfigPage } from "./DuesConfigPage";
import { InPersonPaymentsPage } from "./InPersonPaymentsPage";
import { CommonAreasPage } from "./CommonAreasPage";
import { PassManagementPage } from "./PassManagementPage";
import { WhitelistManagementPage } from "./WhitelistManagementPage";
import { AnnouncementsPage } from "./AnnouncementsPage";
import { NotificationsPage } from "./NotificationsPage";
import { MessagesPage } from "./MessagesPage";
import { PaymentsPage } from "./PaymentsPage";
import { UsersSection } from "./admin/users/index";

type Tab = "users" | "households" | "lots" | "import" | "payments" | "settings";

interface AdminLotsTabProps {
  lots: LotOwnership[];
  homeowners: User[];
  onRefresh: () => void;
}

function AdminLotsTab({ lots, homeowners, onRefresh }: AdminLotsTabProps) {
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBlock, setFilterBlock] = useState<string>("");
  const [editingLot, setEditingLot] = useState<LotOwnership | null>(null);

  // Bulk operations state
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const filteredLots = lots.filter((lot) => {
    if (filterOwner && lot.owner_user_id !== filterOwner) return false;
    if (filterStatus && lot.lot_status !== filterStatus) return false;
    if (filterBlock && lot.block_number !== filterBlock) return false;
    return true;
  });

  async function handleSave() {
    if (!editingLot) return;

    try {
      await Promise.all([
        api.admin.assignLotOwner(editingLot.lot_id, editingLot.owner_user_id),
        api.admin.updateLotStatus(editingLot.lot_id, editingLot.lot_status),
        editingLot.lot_type &&
          api.admin.updateLotType(editingLot.lot_id, editingLot.lot_type),
        editingLot.lot_size_sqm !== undefined &&
          api.admin.updateLotSize(editingLot.lot_id, editingLot.lot_size_sqm),
        editingLot.street !== undefined &&
          api.admin.updateLotStreet(editingLot.lot_id, editingLot.street),
      ]);

      setEditingLot(null);
      onRefresh();
    } catch (error) {
      logger.error("Error saving lot", error, { component: "AdminPanelPage" });
      alert("Failed to save");
    }
  }

  async function handleAssignOwner() {
    if (selectedLotIds.length === 0) {
      toast.error("Please select at least one lot");
      return;
    }

    if (!selectedOwnerId) {
      toast.error("Please select an owner");
      return;
    }

    setIsProcessing(true);
    try {
      await api.admin.batchAssignOwner(selectedLotIds, selectedOwnerId);
      toast.success(
        `Successfully assigned owner to ${selectedLotIds.length} lot${selectedLotIds.length > 1 ? "s" : ""}`,
      );
      onRefresh();
      setSelectedLotIds([]);
    } catch (error) {
      logger.error("Error assigning owner", error, {
        component: "AdminPanelPage",
      });
      toast.error("Failed to assign owner. Please try again.");
    } finally {
      setIsProcessing(false);
      setIsConfirmDialogOpen(false);
    }
  }

  const blocks = Array.from(
    new Set(lots.map((l) => l.block_number).filter(Boolean)),
  ).sort((a, b) => parseInt(a || "0") - parseInt(b || "0"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={filterBlock}
          onChange={(e) => setFilterBlock(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Blocks</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              Block {b}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="built">Built</option>
          <option value="vacant_lot">Vacant Lot</option>
          <option value="under_construction">Under Construction</option>
        </select>

        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Owners</option>
          {homeowners.map((h) => (
            <option key={h.id} value={h.id}>
              {h.email}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-600">
          Showing {filteredLots.length} of {lots.length} lots
        </span>
      </div>

      {selectedLotIds.length > 0 && (
        <BulkActionToolbar
          selectedCount={selectedLotIds.length}
          onClear={() => setSelectedLotIds([])}
          actions={[
            {
              label: "Assign Owner",
              onClick: () => setIsAssignDialogOpen(true),
            },
          ]}
        />
      )}

      <TableWithSelection
        data={filteredLots}
        idField="lot_id"
        onSelectionChange={setSelectedLotIds}
      >
        {({
          selectedIds,
          handleCheckboxChange,
          handleSelectAll,
          isAllSelected,
        }) => (
          <div className="bg-white dark:bg-card rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate =
                            !isAllSelected && selectedIds.size > 0;
                        }
                      }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      aria-label="Select all visible lots"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Block
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Lot
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Size (m²)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLots.map((lot) => (
                  <tr key={lot.lot_id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lot.lot_id)}
                        onChange={(e) =>
                          handleCheckboxChange(lot.lot_id, e.target.checked)
                        }
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        aria-label={`Select ${lot.lot_id}`}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.block_number || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.lot_number || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          lot.lot_status === "built"
                            ? "bg-green-100 text-green-700"
                            : lot.lot_status === "under_construction"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {lot.lot_status === "built"
                          ? "Built"
                          : lot.lot_status === "under_construction"
                            ? "Under Construction"
                            : "Vacant Lot"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lot.owner_name || "Unknown"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lot.lot_size_sqm || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setEditingLot(lot)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableWithSelection>

      {editingLot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Lot - {editingLot.block_number}, {editingLot.lot_number}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Owner
                </label>
                <select
                  value={editingLot.owner_user_id}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      owner_user_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border dark:border-border rounded-lg"
                >
                  {homeowners.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Street
                </label>
                <input
                  type="text"
                  value={editingLot.street || ""}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      street: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border dark:border-border rounded-lg"
                  placeholder="e.g., Mahogany Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Status
                </label>
                <select
                  value={editingLot.lot_status}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      lot_status: e.target.value as LotStatus,
                    })
                  }
                  className="w-full px-3 py-2 border dark:border-border rounded-lg"
                >
                  <option value="built">Built</option>
                  <option value="vacant_lot">Vacant Lot</option>
                  <option value="under_construction">Under Construction</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Lot Type
                </label>
                <select
                  value={editingLot.lot_type || "residential"}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      lot_type: e.target.value as LotType,
                    })
                  }
                  className="w-full px-3 py-2 border dark:border-border rounded-lg"
                >
                  <option value="residential">Residential</option>
                  <option value="resort">Resort</option>
                  <option value="commercial">Commercial</option>
                  <option value="community">Community</option>
                  <option value="utility">Utility</option>
                  <option value="open_space">Open Space</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                  Size (m²)
                </label>
                <input
                  type="number"
                  value={editingLot.lot_size_sqm || ""}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      lot_size_sqm: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border dark:border-border rounded-lg"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingLot(null)}
                  className="px-4 py-2 border dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAssignDialogOpen && (
        <AssignOwnerDialog
          homeowners={homeowners}
          lotCount={selectedLotIds.length}
          onConfirm={(ownerId) => {
            setSelectedOwnerId(ownerId);
            setIsAssignDialogOpen(false);
            setIsConfirmDialogOpen(true);
          }}
          onCancel={() => setIsAssignDialogOpen(false)}
        />
      )}

      {isConfirmDialogOpen && (
        <BulkConfirmationDialog
          operationType="Assign Owner"
          itemCount={selectedLotIds.length}
          details={
            homeowners.find((h) => h.id === selectedOwnerId)?.email || "Unknown"
          }
          onConfirm={handleAssignOwner}
          onCancel={() => setIsConfirmDialogOpen(false)}
        />
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-card rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="text-sm">Assigning owner...</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPanelPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Parse the current path to determine which section to show
  const getPathSection = () => {
    const path = location.pathname;
    if (path === "/admin") return { section: "dashboard", tab: null };
    if (path.startsWith("/admin/")) {
      const parts = path.replace("/admin/", "").split("/");
      return {
        section: parts[0],
        tab: parts[1] || null,
      };
    }
    return { section: "dashboard", tab: null };
  };

  const pathInfo = getPathSection();

  // Users state
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Households state
  const [households, setHouseholds] = useState<AdminHousehold[]>([]);
  const [showHouseholdModal, setShowHouseholdModal] = useState(false);
  const [editingHousehold, setEditingHousehold] =
    useState<AdminHousehold | null>(null);

  // Lots state
  const [lots, setLots] = useState<LotOwnership[]>([]);
  const [homeowners, setHomeowners] = useState<User[]>([]);

  // Import state
  const [importData, setImportData] = useState("");
  const [importResult, setImportResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  // Stats state
  const [stats, setStats] = useState<any>(null);

  // Payments state
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [paymentSubTab, setPaymentSubTab] = useState<
    "verifications" | "settings" | "export"
  >("verifications");

  useEffect(() => {
    if (activeTab === "users") loadUsers();
    if (activeTab === "households") loadHouseholds();
    if (activeTab === "lots") loadLots();
    if (activeTab === "settings") loadStats();
  }, [activeTab]);

  const loadLots = async () => {
    setLoading(true);
    try {
      const [lotsResult, homeownersResult] = await Promise.all([
        api.admin.getLotsWithOwnership(),
        api.admin.getHomeowners(),
      ]);

      if (lotsResult.data) {
        setLots(lotsResult.data.lots);
      }

      if (homeownersResult.data) {
        setHomeowners(homeownersResult.data.homeowners);
      }
    } catch (error) {
      logger.error("Error loading lots", error, {
        component: "AdminPanelPage",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    const response = await api.admin.listUsers();
    if (response.data) {
      setUsers(response.data.users);
    }
    setLoading(false);
  };

  const loadHouseholds = async () => {
    setLoading(true);
    const response = await api.admin.listHouseholds();
    if (response.data) {
      setHouseholds(response.data.households);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    setLoading(true);
    const response = await api.admin.getStats();
    if (response.data) {
      setStats(response.data.stats);
    }
    setLoading(false);
  };

  const handleCreateUser = async (data: any) => {
    const response = await api.admin.createUser(data);
    if (response.error) {
      alert(response.error);
      return;
    }
    setShowUserModal(false);
    loadUsers();
  };

  const handleUpdateUser = async (id: string, data: any) => {
    const response = await api.admin.updateUser(id, data);
    if (response.error) {
      alert(response.error);
      return;
    }
    setShowUserModal(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleCreateHousehold = async (data: any) => {
    const response = await api.admin.createHousehold(data);
    if (response.error) {
      alert(response.error);
      return;
    }
    setShowHouseholdModal(false);
    loadHouseholds();
  };

  const handleUpdateHousehold = async (id: string, data: any) => {
    console.log("[AdminPanel] Updating household:", id, "with data:", data);
    const response = await api.admin.updateHousehold(id, data);
    console.log("[AdminPanel] Update response:", response);
    if (response.error) {
      alert(response.error);
      return;
    }
    setShowHouseholdModal(false);
    setEditingHousehold(null);
    loadHouseholds();
  };

  const handleDeleteHousehold = async (id: string) => {
    if (!confirm("Are you sure you want to delete this household?")) return;
    const response = await api.admin.deleteHousehold(id);
    if (response.error) {
      alert(response.error);
      return;
    }
    loadHouseholds();
  };

  const handleImport = async () => {
    try {
      const data = JSON.parse(importData);
      const response = await api.admin.importHouseholds({ households: data });
      if (response.data) {
        setImportResult(response.data.results);
        if (response.data.results.success > 0) {
          loadHouseholds();
        }
      }
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  const tabs = [
    { id: "users" as Tab, label: "Users", icon: "👥" },
    { id: "households" as Tab, label: "Households", icon: "🏠" },
    { id: "lots" as Tab, label: "Lots", icon: "🏘️" },
    { id: "import" as Tab, label: "Import", icon: "📥" },
    { id: "payments" as Tab, label: "Payments", icon: "💳" },
    { id: "settings" as Tab, label: "Stats", icon: "📊" },
  ];

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Handle reservations section
  if (pathInfo.section === "reservations") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <AdminReservationsPage />
        </div>
      </div>
    );
  }

  // Handle lots section
  if (pathInfo.section === "lots") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <AdminLotsPage />
        </div>
      </div>
    );
  }

  // Handle dues section
  if (pathInfo.section === "dues") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <DuesConfigPage />
        </div>
      </div>
    );
  }

  // Handle payments/in-person section
  if (
    pathInfo.section === "payments" &&
    location.pathname.includes("in-person")
  ) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <InPersonPaymentsPage />
        </div>
      </div>
    );
  }

  // Handle common-areas section
  if (pathInfo.section === "common-areas") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <CommonAreasPage />
        </div>
      </div>
    );
  }

  // Handle pass-management section
  if (pathInfo.section === "pass-management") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <PassManagementPage />
        </div>
      </div>
    );
  }

  // Handle whitelist section
  if (pathInfo.section === "whitelist") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <WhitelistManagementPage />
        </div>
      </div>
    );
  }

  // Handle pre-approved section (same as whitelist)
  if (pathInfo.section === "pre-approved") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <WhitelistManagementPage />
        </div>
      </div>
    );
  }

  // Handle residents section (use users tab)
  if (pathInfo.section === "residents") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <h1 className="text-2xl font-bold">Residents Management</h1>
            <div className="bg-white dark:bg-card rounded-lg shadow p-6">
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">User Management</h2>
                </div>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-muted">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Phone
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  user.role === "admin"
                                    ? "bg-purple-100 text-purple-800"
                                    : user.role === "staff"
                                      ? "bg-blue-100 text-blue-800"
                                      : user.role === "resident"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {user.phone || "-"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowUserModal(true);
                                }}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle announcements section
  if (pathInfo.section === "announcements") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <AnnouncementsPage />
        </div>
      </div>
    );
  }

  // Handle notifications section
  if (pathInfo.section === "notifications") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <NotificationsPage />
        </div>
      </div>
    );
  }

  // Handle messages section
  if (pathInfo.section === "messages") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <MessagesPage />
        </div>
      </div>
    );
  }

  // Handle payments section (main page)
  if (
    pathInfo.section === "payments" &&
    !location.pathname.includes("in-person")
  ) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <PaymentsPage />
        </div>
      </div>
    );
  }

  // Handle dues-settings section (same as dues)
  if (pathInfo.section === "dues-settings") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <DuesConfigPage />
        </div>
      </div>
    );
  }

  // Handle verification-queue section
  if (pathInfo.section === "verification-queue") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <h1 className="text-2xl font-bold">Payment Verification Queue</h1>
            <PaymentVerificationQueue status="pending" onRefresh={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  // Handle settings section
  if (pathInfo.section === "settings") {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64">
          <div className="container mx-auto px-4 py-6 space-y-6">
            <h1 className="text-2xl font-bold">System Settings</h1>
            <div className="bg-white dark:bg-card rounded-lg shadow p-6">
              <p className="text-muted-foreground">
                System settings coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:ml-64">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-accent"
                aria-label="Open sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-border">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-1 py-4 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? "border-primary-500 text-primary-600"
                      : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-card rounded-lg shadow p-6">
            {activeTab === "users" && <UsersSection />}

            {activeTab === "households" && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    Household Management
                  </h2>
                  <button
                    onClick={() => {
                      setEditingHousehold(null);
                      setShowHouseholdModal(true);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Add Household
                  </button>
                </div>

                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : (
                  <div className="space-y-4">
                    {households.map((household) => (
                      <div key={household.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">
                              {household.address}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {household.street && `${household.street}, `}
                              {household.block && `Block ${household.block}`}
                              {household.block && household.lot && " - "}
                              {household.lot && `Lot ${household.lot}`}
                            </p>
                            {household.owner_email && (
                              <p className="text-sm text-gray-600">
                                Owner: {household.owner_email}
                              </p>
                            )}
                          </div>
                          <div className="space-x-2">
                            <button
                              onClick={() => {
                                setEditingHousehold(household);
                                setShowHouseholdModal(true);
                              }}
                              className="text-primary-600 hover:text-primary-900 text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteHousehold(household.id)
                              }
                              className="text-red-600 hover:text-red-900 text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        {household.residents &&
                          household.residents.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-gray-600 mb-2">
                                Residents:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {household.residents.map((resident) => (
                                  <span
                                    key={resident.id}
                                    className={`px-2 py-1 text-xs rounded ${
                                      resident.is_primary
                                        ? "bg-primary-100 text-primary-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {resident.first_name} {resident.last_name}
                                    {resident.is_primary && " (Primary)"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === "lots" && (
              <AdminLotsTab
                lots={lots}
                homeowners={homeowners}
                onRefresh={loadLots}
              />
            )}

            {activeTab === "import" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  Bulk Import Households
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-2">
                      Paste JSON data or enter manually
                    </label>
                    <textarea
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                      placeholder={`[
  {
    "address": "123 Main St",
    "block": "1",
    "lot": "1",
    "latitude": 14.1234,
    "longitude": 121.5678,
    "owner_email": "owner@example.com",
    "residents": [
      { "first_name": "John", "last_name": "Doe", "is_primary": true },
      { "first_name": "Jane", "last_name": "Doe", "is_primary": false }
    ]
  }
]`}
                    />
                  </div>

                  <button
                    onClick={handleImport}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Import Households
                  </button>

                  {importResult && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-muted rounded-lg">
                      <h3 className="font-semibold mb-2">Import Results</h3>
                      <p className="text-green-600">
                        ✓ {importResult.success} households imported
                      </p>
                      <p className="text-red-600">
                        ✗ {importResult.failed} households failed
                      </p>
                      {importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Errors:</p>
                          <ul className="list-disc list-inside text-sm text-red-600">
                            {importResult.errors.map((error, i) => (
                              <li key={i}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "payments" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  Payment Management
                </h2>

                {/* Sub-tabs */}
                <div className="mb-4 border-b border-gray-200 dark:border-border">
                  <nav
                    className="-mb-px flex space-x-8"
                    aria-label="Payment tabs"
                  >
                    <button
                      onClick={() => setPaymentSubTab("verifications")}
                      className={`${
                        paymentSubTab === "verifications"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Verification Queue
                    </button>
                    <button
                      onClick={() => setPaymentSubTab("settings")}
                      className={`${
                        paymentSubTab === "settings"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Settings
                    </button>
                    <button
                      onClick={() => setPaymentSubTab("export")}
                      className={`${
                        paymentSubTab === "export"
                          ? "border-blue-500 text-blue-600"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      Export
                    </button>
                  </nav>
                </div>

                {/* Verification Queue Sub-tab */}
                {paymentSubTab === "verifications" && (
                  <div className="bg-white dark:bg-card rounded-lg shadow">
                    <div className="border-b border-gray-200 dark:border-border">
                      <nav
                        className="-mb-px flex space-x-8"
                        aria-label="Status tabs"
                      >
                        {[
                          { id: "pending", label: "Pending" },
                          { id: "approved", label: "Approved" },
                          { id: "rejected", label: "Rejected" },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setPaymentStatus(tab.id as any)}
                            className={`${
                              paymentStatus === tab.id
                                ? "border-blue-500 text-blue-600"
                                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </nav>
                    </div>

                    <div className="p-6">
                      <PaymentVerificationQueue
                        status={paymentStatus}
                        onRefresh={() => {
                          // Optional: refresh logic
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Settings Sub-tab */}
                {paymentSubTab === "settings" && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <LateFeeConfig />
                  </div>
                )}

                {/* Export Sub-tab */}
                {paymentSubTab === "export" && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <PaymentExport />
                  </div>
                )}
              </div>
            )}

            {activeTab === "settings" && (
              <div>
                <h2 className="text-xl font-semibold mb-6">
                  System Statistics
                </h2>

                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : stats ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Users Stats */}
                    <div className="bg-purple-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-purple-900 mb-4">
                        Users
                      </h3>
                      <p className="text-3xl font-bold text-purple-600">
                        {stats.users.total}
                      </p>
                      <div className="mt-4 space-y-2">
                        {stats.users.byRole.map((item: any) => (
                          <div
                            key={item.role}
                            className="flex justify-between text-sm"
                          >
                            <span className="capitalize">{item.role}</span>
                            <span className="font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Households Stats */}
                    <div className="bg-blue-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-blue-900 mb-4">
                        Households
                      </h3>
                      <p className="text-3xl font-bold text-blue-600">
                        {stats.households.total}
                      </p>
                      <div className="mt-4 space-y-2">
                        {stats.households.byBlock.map((item: any) => (
                          <div
                            key={item.block}
                            className="flex justify-between text-sm"
                          >
                            <span>Block {item.block}</span>
                            <span className="font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Residents Stats */}
                    <div className="bg-green-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-green-900 mb-4">
                        Residents
                      </h3>
                      <p className="text-3xl font-bold text-green-600">
                        {stats.residents}
                      </p>
                    </div>

                    {/* Service Requests Stats */}
                    <div className="bg-yellow-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-yellow-900 mb-4">
                        Pending Requests
                      </h3>
                      <p className="text-3xl font-bold text-yellow-600">
                        {stats.serviceRequests.pending}
                      </p>
                    </div>

                    {/* Reservations Stats */}
                    <div className="bg-indigo-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-indigo-900 mb-4">
                        Upcoming Reservations
                      </h3>
                      <p className="text-3xl font-bold text-indigo-600">
                        {stats.reservations.upcoming}
                      </p>
                    </div>

                    {/* Payments Stats */}
                    <div className="bg-red-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-red-900 mb-4">
                        Unpaid Payments
                      </h3>
                      <p className="text-3xl font-bold text-red-600">
                        {stats.payments.unpaid}
                      </p>
                      <p className="text-sm text-red-700 mt-2">
                        PHP {stats.payments.unpaidAmount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* User Modal */}
          {showUserModal && (
            <UserModal
              user={editingUser}
              onSave={
                editingUser
                  ? (data) => handleUpdateUser(editingUser.id, data)
                  : handleCreateUser
              }
              onClose={() => {
                setShowUserModal(false);
                setEditingUser(null);
              }}
            />
          )}

          {/* Household Modal */}
          {showHouseholdModal && (
            <HouseholdModal
              household={editingHousehold}
              onSave={
                editingHousehold
                  ? (data) => handleUpdateHousehold(editingHousehold.id, data)
                  : handleCreateHousehold
              }
              onClose={() => {
                setShowHouseholdModal(false);
                setEditingHousehold(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function UserModal({
  user,
  onSave,
  onClose,
}: {
  user: AdminUser | null;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role || "resident");
  const [phone, setPhone] = useState(user?.phone || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { email, role, phone };
    if (password) data.password = password;
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-card rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">
          {user ? "Edit User" : "Create User"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required={!user}
              />
            </div>
          )}
          {user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password (optional)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="resident">Resident</option>
              <option value="guest">Guest</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {user ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HouseholdModal({
  household,
  onSave,
  onClose,
}: {
  household: AdminHousehold | null;
  onSave: (data: any) => void;
  onClose: () => void;
}) {
  const [street, setStreet] = useState(household?.street || "");
  const [block, setBlock] = useState(household?.block || "");
  const [lot, setLot] = useState(household?.lot || "");

  // Generate address from street, block, lot
  const generatedAddress = `${street || ""}${street ? ", " : ""}Block ${block || "?"}, Lot ${lot || "?"}`;
  const [latitude, setLatitude] = useState(
    household?.latitude?.toString() || "",
  );
  const [longitude, setLongitude] = useState(
    household?.longitude?.toString() || "",
  );
  const [mapMarkerX, setMapMarkerX] = useState(
    household?.map_marker_x?.toString() || "",
  );
  const [mapMarkerY, setMapMarkerY] = useState(
    household?.map_marker_y?.toString() || "",
  );
  const [ownerEmail, setOwnerEmail] = useState(household?.owner_email || "");
  const [residents, setResidents] = useState(
    household?.residents.map((r) => ({
      first_name: r.first_name,
      last_name: r.last_name,
      is_primary: Boolean(r.is_primary),
    })) || [],
  );

  const addResident = () => {
    setResidents([
      ...residents,
      { first_name: "", last_name: "", is_primary: false },
    ]);
  };

  const updateResident = (index: number, field: string, value: any) => {
    const newResidents = [...residents];
    (newResidents as any)[index][field] = value;
    setResidents(newResidents);
  };

  const removeResident = (index: number) => {
    setResidents(residents.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = {
      // address is auto-generated on backend from street, block, lot
      street: street || undefined,
      block: block || undefined,
      lot: lot || undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      map_marker_x: mapMarkerX ? parseFloat(mapMarkerX) : undefined,
      map_marker_y: mapMarkerY ? parseFloat(mapMarkerY) : undefined,
      owner_email: ownerEmail || undefined,
      residents,
    };
    console.log("[HouseholdModal] Submitting household data:", data);
    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-card rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">
          {household ? "Edit Household" : "Create Household"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Mahogany Street"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Block
              </label>
              <input
                type="text"
                value={block}
                onChange={(e) => setBlock(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lot
              </label>
              <input
                type="text"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          {/* Read-only preview of auto-generated address */}
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Generated Address (auto-generated)
            </label>
            <p className="text-sm text-gray-900 font-medium">
              {generatedAddress}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Map Marker X
              </label>
              <input
                type="number"
                step="any"
                value={mapMarkerX}
                onChange={(e) => setMapMarkerX(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Map Marker Y
              </label>
              <input
                type="number"
                step="any"
                value={mapMarkerY}
                onChange={(e) => setMapMarkerY(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Email
            </label>
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Residents
              </label>
              <button
                type="button"
                onClick={addResident}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Resident
              </button>
            </div>
            <div className="space-y-2">
              {residents.map((resident, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 p-2 bg-gray-50 rounded"
                >
                  <input
                    type="text"
                    placeholder="First name"
                    value={resident.first_name}
                    onChange={(e) =>
                      updateResident(index, "first_name", e.target.value)
                    }
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={resident.last_name}
                    onChange={(e) =>
                      updateResident(index, "last_name", e.target.value)
                    }
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    required
                  />
                  <label className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={resident.is_primary}
                      onChange={(e) =>
                        updateResident(index, "is_primary", e.target.checked)
                      }
                      className="mr-1"
                    />
                    Primary
                  </label>
                  <button
                    type="button"
                    onClick={() => removeResident(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-border rounded-lg hover:bg-gray-50 dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              {household ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
