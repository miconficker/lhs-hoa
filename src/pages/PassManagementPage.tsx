import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import {
  Users,
  Car,
  CreditCard,
  Search,
  Filter,
  Check,
  X,
  XCircle,
  Calendar,
  Wallet,
  Badge,
  Save,
  Trash2,
  Edit,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as UIBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logger } from "@/lib/logger";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  HouseholdEmployee,
  VehicleRegistration,
  PassFee,
  EmployeeStatus,
  VehicleStatus,
  VehiclePaymentStatus,
  EmployeeType,
  PassType,
  PassStats,
} from "@/types";

const employeeStatusColors: Record<EmployeeStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  revoked: "bg-red-100 text-destructive",
  expired: "bg-gray-100 text-gray-700",
};

const vehicleStatusColors: Record<VehicleStatus, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-destructive",
};

const paymentStatusColors: Record<VehiclePaymentStatus, string> = {
  unpaid: "bg-red-100 text-destructive",
  paid: "bg-green-100 text-green-700",
};

const employeeTypeLabels: Record<EmployeeType, string> = {
  driver: "Driver",
  housekeeper: "Housekeeper",
  caretaker: "Caretaker",
  other: "Other",
};

interface FilterState {
  status?: EmployeeStatus | VehicleStatus;
  paymentStatus?: VehiclePaymentStatus;
  householdId?: string;
  searchQuery?: string;
}

interface EditVehicleState {
  vehicle: VehicleRegistration | null;
  showRFIDModal: boolean;
  showStickerModal: boolean;
  showPaymentModal: boolean;
  rfidCode: string;
  stickerNumber: string;
  paymentAmount: string;
}

interface EditFeeState {
  stickerFee: string;
  rfidFee: string;
  showEditModal: boolean;
}

export function PassManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Data
  const [stats, setStats] = useState<PassStats | null>(null);
  const [employees, setEmployees] = useState<HouseholdEmployee[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRegistration[]>([]);
  const [fees, setFees] = useState<PassFee[]>([]);
  const [allHouseholds, setAllHouseholds] = useState<any[]>([]);
  const [replacementRequests, setReplacementRequests] = useState<any[]>([]);

  // Filters
  const [employeeFilters, setEmployeeFilters] = useState<FilterState>({});
  const [vehicleFilters, setVehicleFilters] = useState<FilterState>({});

  // Editing states
  const [editVehicle, setEditVehicle] = useState<EditVehicleState>({
    vehicle: null,
    showRFIDModal: false,
    showStickerModal: false,
    showPaymentModal: false,
    rfidCode: "",
    stickerNumber: "",
    paymentAmount: "",
  });

  const [editFees, setEditFees] = useState<EditFeeState>({
    stickerFee: "",
    rfidFee: "",
    showEditModal: false,
  });

  // Admin creation states
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    household_id: "",
    full_name: "",
    employee_type: "driver" as EmployeeType,
    photo: "",
    expiry_date: "",
  });

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({
    household_id: "",
    plate_number: "",
    make: "",
    model: "",
    color: "",
    has_sticker: false,
    has_rfid: false,
  });

  // Household search states
  const [employeeHouseholdSearch, setEmployeeHouseholdSearch] = useState("");
  const [vehicleHouseholdSearch, setVehicleHouseholdSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      // Load stats
      const statsResult = await api.admin.passManagement.getStats();
      if (statsResult.data) {
        setStats(statsResult.data.stats);
      }

      // Load employees
      const empResult = await api.admin.passManagement.employees.list(
        employeeFilters.status || employeeFilters.householdId
          ? {
              status: employeeFilters.status as EmployeeStatus,
              household_id: employeeFilters.householdId,
            }
          : undefined,
      );
      if (empResult.data) {
        let empList = empResult.data.employees;
        if (employeeFilters.searchQuery) {
          const query = employeeFilters.searchQuery.toLowerCase();
          empList = empList.filter(
            (e) =>
              e.full_name.toLowerCase().includes(query) ||
              e.id_number.toLowerCase().includes(query) ||
              (e.household_address &&
                e.household_address.toLowerCase().includes(query)),
          );
        }
        setEmployees(empList);
      }

      // Load vehicles
      const vehResult = await api.admin.passManagement.vehicles.list(
        vehicleFilters.status ||
          vehicleFilters.paymentStatus ||
          vehicleFilters.householdId
          ? {
              status: vehicleFilters.status as VehicleStatus,
              payment_status: vehicleFilters.paymentStatus,
              household_id: vehicleFilters.householdId,
            }
          : undefined,
      );
      if (vehResult.data) {
        let vehList = vehResult.data.vehicles;
        if (vehicleFilters.searchQuery) {
          const query = vehicleFilters.searchQuery.toLowerCase();
          vehList = vehList.filter(
            (v) =>
              v.plate_number.toLowerCase().includes(query) ||
              v.make.toLowerCase().includes(query) ||
              v.model.toLowerCase().includes(query) ||
              (v.household_address &&
                v.household_address.toLowerCase().includes(query)),
          );
        }
        setVehicles(vehList);
      }

      // Load fees
      const feesResult = await api.admin.passManagement.fees.list();
      if (feesResult.data) {
        setFees(feesResult.data.fees);
        const stickerFee = feesResult.data.fees.find(
          (f) => f.pass_type_code === "sticker",
        );
        const rfidFee = feesResult.data.fees.find(
          (f) => f.pass_type_code === "rfid",
        );
        setEditFees({
          stickerFee: stickerFee?.amount.toString() || "",
          rfidFee: rfidFee?.amount.toString() || "",
          showEditModal: false,
        });
      }

      // Load all households for admin creation
      const householdsResult = await api.admin.listHouseholds();
      if (householdsResult.data) {
        setAllHouseholds(householdsResult.data.households);
      }

      // Load replacement requests
      const replacementsResult =
        await api.admin.passManagement.rfidReplacementRequests.list();
      if (replacementsResult.data) {
        setReplacementRequests(replacementsResult.data.requests);
      }
    } catch (err) {
      logger.error("Error loading data", err, {
        component: "PassManagementPage",
      });
      setError("Failed to load pass management data");
    }

    setLoading(false);
  }

  async function handleUpdateEmployeeStatus(
    id: string,
    status: EmployeeStatus,
  ) {
    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.employees.updateStatus(id, {
      status,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Employee status updated successfully!");
      loadData();
    }
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm("Are you sure you want to delete this employee pass?")) {
      return;
    }

    const result = await api.admin.passManagement.employees.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Employee pass deleted successfully!");
      loadData();
    }
  }

  async function handleAssignRFID() {
    if (!editVehicle.vehicle) return;

    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.vehicles.assignRFID(
      editVehicle.vehicle.id,
      { rfid_code: editVehicle.rfidCode },
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("RFID code assigned successfully!");
      setEditVehicle({
        ...editVehicle,
        showRFIDModal: false,
        rfidCode: "",
      });
      loadData();
    }
  }

  async function handleAssignSticker() {
    if (!editVehicle.vehicle) return;

    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.vehicles.assignSticker(
      editVehicle.vehicle.id,
      { sticker_number: editVehicle.stickerNumber },
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Sticker number assigned successfully!");
      setEditVehicle({
        ...editVehicle,
        showStickerModal: false,
        stickerNumber: "",
      });
      loadData();
    }
  }

  async function handleRecordPayment() {
    if (!editVehicle.vehicle) return;

    setError("");
    setSuccessMessage("");

    // For simplicity, we'll just update the status to active for now
    // In production, you'd want a proper payment recording flow
    const result = await api.admin.passManagement.vehicles.updateStatus(
      editVehicle.vehicle.id,
      { status: "active", notes: "Payment recorded manually" },
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Payment recorded successfully!");
      setEditVehicle({
        ...editVehicle,
        showPaymentModal: false,
        paymentAmount: "",
      });
      loadData();
    }
  }

  async function handleUpdateVehicleStatus(id: string, status: VehicleStatus) {
    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.vehicles.updateStatus(id, {
      status,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Vehicle status updated successfully!");
      loadData();
    }
  }

  async function handleDeleteVehicle(id: string) {
    if (
      !confirm("Are you sure you want to delete this vehicle registration?")
    ) {
      return;
    }

    const result = await api.admin.passManagement.vehicles.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Vehicle registration deleted successfully!");
      loadData();
    }
  }

  async function handleReplaceRfid(id: string) {
    const notes = prompt(
      "Reason for RFID replacement (e.g., damaged card):",
      "Damaged - needs replacement",
    );
    if (notes === null) {
      return; // User cancelled
    }

    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.vehicles.replaceRfid(id, {
      notes: notes || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage(
        "RFID replaced successfully! New RFID created and requires payment.",
      );
      loadData();
    }
  }

  async function handleUpdateFees() {
    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.fees.update({
      sticker_fee: parseFloat(editFees.stickerFee) || undefined,
      rfid_fee: parseFloat(editFees.rfidFee) || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Pass fees updated successfully!");
      setEditFees({ ...editFees, showEditModal: false });
      loadData();
    }
  }

  async function handleApproveReplacement(requestId: string) {
    const notes = prompt("Admin notes (optional):");
    setError("");
    setSuccessMessage("");

    const result =
      await api.admin.passManagement.rfidReplacementRequests.approve(
        requestId,
        { admin_notes: notes || undefined },
      );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage(
        "Replacement request approved! New RFID created and requires payment.",
      );
      loadData();
    }
  }

  async function handleRejectReplacement(requestId: string) {
    const reason = prompt("Reason for rejection (required):");
    if (!reason) return;

    setError("");
    setSuccessMessage("");

    const result =
      await api.admin.passManagement.rfidReplacementRequests.reject(requestId, {
        reason,
      });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Replacement request rejected.");
      loadData();
    }
  }

  async function handleCreateEmployee() {
    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.employees.create({
      household_id: employeeForm.household_id,
      full_name: employeeForm.full_name,
      employee_type: employeeForm.employee_type,
      photo: employeeForm.photo
        ? (employeeForm.photo as unknown as File)
        : undefined,
      expiry_date: employeeForm.expiry_date || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Employee pass created successfully!");
      setShowEmployeeModal(false);
      loadData();
    }
  }

  async function handleCreateVehicle() {
    setError("");
    setSuccessMessage("");

    const result = await api.admin.passManagement.vehicles.create({
      household_id: vehicleForm.household_id,
      plate_number: vehicleForm.plate_number,
      make: vehicleForm.make,
      model: vehicleForm.model,
      color: vehicleForm.color,
      has_sticker: vehicleForm.has_sticker,
      has_rfid: vehicleForm.has_rfid,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Vehicle registration created successfully!");
      setShowVehicleModal(false);
      loadData();
    }
  }

  function getFeeForType(passType: PassType): number {
    if (passType === "both") {
      const stickerFee = fees.find((f) => f.pass_type_code === "sticker");
      const rfidFee = fees.find((f) => f.pass_type_code === "rfid");
      return (stickerFee?.amount || 0) + (rfidFee?.amount || 0);
    }
    const fee = fees.find((f) => f.pass_type_code === passType);
    return fee?.amount || 0;
  }

  if (user?.role !== "admin") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
        Access denied. Admin privileges required.
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Pass Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee passes, vehicle registrations, and pass fees
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50/50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {successMessage}
          <button onClick={() => setSuccessMessage("")} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-[hsl(var(--status-info-fg))]" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Active Employees
                </p>
                <p className="text-2xl font-bold text-card-foreground">
                  {stats.active_employees}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Car className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Vehicles</p>
                <p className="text-2xl font-bold text-card-foreground">
                  {stats.active_vehicles}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[hsl(var(--status-warning-bg))] rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Pending Approvals
                </p>
                <p className="text-2xl font-bold text-card-foreground">
                  {stats.pending_approvals}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Wallet className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                <p className="text-2xl font-bold text-card-foreground">
                  ₱{stats.monthly_revenue?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="employees" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="replacements">
            Replacement Requests
            {replacementRequests.filter((r) => r.status === "pending").length >
              0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {
                  replacementRequests.filter((r) => r.status === "pending")
                    .length
                }
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <div className="bg-card rounded-lg shadow p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, or address..."
                  value={employeeFilters.searchQuery || ""}
                  onChange={(e) =>
                    setEmployeeFilters({
                      ...employeeFilters,
                      searchQuery: e.target.value,
                    })
                  }
                  className="flex-1"
                />
              </div>
              <Select
                value={employeeFilters.status || "all"}
                onValueChange={(value) =>
                  setEmployeeFilters({
                    ...employeeFilters,
                    status:
                      value === "all" ? undefined : (value as EmployeeStatus),
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadData} variant="outline" size="sm">
                Reload
              </Button>
              <Button
                onClick={() => {
                  setEmployeeForm({
                    household_id: "",
                    full_name: "",
                    employee_type: "driver",
                    photo: "",
                    expiry_date: "",
                  });
                  setEmployeeHouseholdSearch("");
                  setShowEmployeeModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                Add Employee
              </Button>
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Employee
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        ID Number
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Address
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Dates
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length > 0 ? (
                      employees.map((employee) => (
                        <tr
                          key={employee.id}
                          className="border-b hover:bg-muted"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {employee.photo_url ? (
                                <img
                                  src={employee.photo_url}
                                  alt={employee.full_name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                                  <Users className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                              <span className="font-medium text-card-foreground">
                                {employee.full_name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-card-foreground">
                            {employeeTypeLabels[employee.employee_type]}
                          </td>
                          <td className="py-3 px-4 text-gray-700 dark:text-card-foreground">
                            {employee.id_number}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {employee.household_address || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <UIBadge
                              className={employeeStatusColors[employee.status]}
                            >
                              {employee.status}
                            </UIBadge>
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            <div>
                              {employee.issued_date && (
                                <div>
                                  Issued:{" "}
                                  {new Date(
                                    employee.issued_date,
                                  ).toLocaleDateString()}
                                </div>
                              )}
                              {employee.expiry_date && (
                                <div>
                                  Expires:{" "}
                                  {new Date(
                                    employee.expiry_date,
                                  ).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {employee.status === "pending" && (
                                <Button
                                  onClick={() =>
                                    handleUpdateEmployeeStatus(
                                      employee.id,
                                      "active",
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              {employee.status === "active" && (
                                <Button
                                  onClick={() =>
                                    handleUpdateEmployeeStatus(
                                      employee.id,
                                      "revoked",
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-destructive"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() =>
                                  handleDeleteEmployee(employee.id)
                                }
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No employee passes found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Vehicles Tab */}
        <TabsContent value="vehicles" className="space-y-4">
          <div className="bg-card rounded-lg shadow p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by plate, make, model, or address..."
                  value={vehicleFilters.searchQuery || ""}
                  onChange={(e) =>
                    setVehicleFilters({
                      ...vehicleFilters,
                      searchQuery: e.target.value,
                    })
                  }
                  className="flex-1"
                />
              </div>
              <Select
                value={vehicleFilters.status || "all"}
                onValueChange={(value) =>
                  setVehicleFilters({
                    ...vehicleFilters,
                    status:
                      value === "all" ? undefined : (value as VehicleStatus),
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_payment">
                    Pending Payment
                  </SelectItem>
                  <SelectItem value="pending_approval">
                    Pending Approval
                  </SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={vehicleFilters.paymentStatus || "all"}
                onValueChange={(value) =>
                  setVehicleFilters({
                    ...vehicleFilters,
                    paymentStatus:
                      value === "all"
                        ? undefined
                        : (value as VehiclePaymentStatus),
                  })
                }
              >
                <SelectTrigger className="w-[180px]">
                  <Wallet className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Payment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Payments</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={loadData} variant="outline" size="sm">
                Reload
              </Button>
              <Button
                onClick={() => {
                  setVehicleForm({
                    household_id: "",
                    plate_number: "",
                    make: "",
                    model: "",
                    color: "",
                    has_sticker: false,
                    has_rfid: false,
                  });
                  setVehicleHouseholdSearch("");
                  setShowVehicleModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                Add Vehicle
              </Button>
            </div>

            {/* Vehicle Table */}
            <div className="overflow-x-auto">
              <div className="min-w-[1000px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Vehicle
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Pass Type
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Address
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Payment
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Codes
                      </th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicles.length > 0 ? (
                      vehicles.map((vehicle) => (
                        <tr
                          key={vehicle.id}
                          className="border-b hover:bg-muted"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Car className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-card-foreground">
                                  {vehicle.plate_number}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {vehicle.make} {vehicle.model} (
                                  {vehicle.color})
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1 flex-wrap">
                              {vehicle.sticker_pass_id && (
                                <UIBadge className="bg-blue-100 text-blue-700 text-xs">
                                  Sticker
                                </UIBadge>
                              )}
                              {vehicle.rfid_pass_id && (
                                <UIBadge className="bg-green-100 text-green-700 text-xs">
                                  RFID
                                </UIBadge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {vehicle.household_address || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <UIBadge
                              className={vehicleStatusColors[vehicle.status]}
                            >
                              {vehicle.status}
                            </UIBadge>
                          </td>
                          <td className="py-3 px-4">
                            <UIBadge
                              className={
                                paymentStatusColors[vehicle.payment_status]
                              }
                            >
                              {vehicle.payment_status}
                            </UIBadge>
                            {vehicle.amount_due && (
                              <div className="text-sm text-gray-700 mt-1">
                                ₱{vehicle.amount_due.toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            <div>
                              {vehicle.rfid_code && (
                                <div>
                                  RFID:{" "}
                                  <span className="font-mono">
                                    {vehicle.rfid_code}
                                  </span>
                                </div>
                              )}
                              {vehicle.sticker_number && (
                                <div>
                                  Sticker:{" "}
                                  <span className="font-mono">
                                    {vehicle.sticker_number}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-2">
                              {vehicle.pass_type === "rfid" ||
                              vehicle.pass_type === "both" ? (
                                <Button
                                  onClick={() =>
                                    setEditVehicle({
                                      ...editVehicle,
                                      vehicle,
                                      showRFIDModal: true,
                                      rfidCode: vehicle.rfid_code || "",
                                    })
                                  }
                                  size="sm"
                                  variant="outline"
                                  title="Assign RFID"
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {vehicle.pass_type === "sticker" ||
                              vehicle.pass_type === "both" ? (
                                <Button
                                  onClick={() =>
                                    setEditVehicle({
                                      ...editVehicle,
                                      vehicle,
                                      showStickerModal: true,
                                      stickerNumber:
                                        vehicle.sticker_number || "",
                                    })
                                  }
                                  size="sm"
                                  variant="outline"
                                  title="Assign Sticker"
                                >
                                  <Badge className="w-4 h-4" />
                                </Button>
                              ) : null}
                              {vehicle.payment_status === "unpaid" && (
                                <Button
                                  onClick={() =>
                                    setEditVehicle({
                                      ...editVehicle,
                                      vehicle,
                                      showPaymentModal: true,
                                      paymentAmount:
                                        vehicle.amount_due?.toString() || "",
                                    })
                                  }
                                  size="sm"
                                  variant="outline"
                                  title="Record Payment"
                                >
                                  <Wallet className="w-4 h-4" />
                                </Button>
                              )}
                              {(vehicle.status === "pending_payment" ||
                                vehicle.status === "pending_approval") && (
                                <Button
                                  onClick={() =>
                                    handleUpdateVehicleStatus(
                                      vehicle.id,
                                      "active",
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              )}
                              {vehicle.rfid_pass_id &&
                                vehicle.status === "active" && (
                                  <Button
                                    onClick={() =>
                                      handleReplaceRfid(vehicle.id)
                                    }
                                    size="sm"
                                    variant="outline"
                                    className="text-orange-600 hover:text-orange-700"
                                    title="Replace RFID"
                                  >
                                    <RefreshCcw className="w-4 h-4" />
                                  </Button>
                                )}
                              {vehicle.status === "active" && (
                                <Button
                                  onClick={() =>
                                    handleUpdateVehicleStatus(
                                      vehicle.id,
                                      "cancelled",
                                    )
                                  }
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-destructive"
                                  title="Cancel"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                onClick={() => handleDeleteVehicle(vehicle.id)}
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No vehicle registrations found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Fees Tab */}
        <TabsContent value="fees" className="space-y-4">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-card-foreground">
                Current Pass Fees
              </h2>
              <Button
                onClick={() =>
                  setEditFees({ ...editFees, showEditModal: true })
                }
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Fees
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-[hsl(var(--status-info-bg))] rounded-lg">
                    <Badge className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      Sticker Pass
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Physical sticker for vehicle
                    </p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-card-foreground">
                  ₱{getFeeForType("sticker").toFixed(2)}
                </div>
              </div>
              <div className="p-6 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-[hsl(var(--status-success-bg))] rounded-lg">
                    <CreditCard className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      RFID Pass
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Electronic RFID tag
                    </p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-card-foreground">
                  ₱{getFeeForType("rfid").toFixed(2)}
                </div>
              </div>
              <div className="p-6 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Badge className="w-6 h-6 text-purple-600" />
                    <CreditCard className="w-6 h-6 text-purple-600 -ml-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">
                      Both Passes
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Sticker + RFID combined
                    </p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-card-foreground">
                  ₱
                  {(getFeeForType("sticker") + getFeeForType("rfid")).toFixed(
                    2,
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Replacement Requests Tab */}
        <TabsContent value="replacements" className="space-y-4">
          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-card-foreground">
                RFID Replacement Requests
              </h2>
              <Button onClick={loadData} variant="outline" size="sm">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Reload
              </Button>
            </div>

            {replacementRequests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No replacement requests found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Vehicle
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Address
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Reason
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Requested By
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Date
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-700 dark:text-card-foreground">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {replacementRequests.map((request) => (
                        <tr
                          key={request.id}
                          className="border-b hover:bg-muted"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Car className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <div className="font-medium text-card-foreground">
                                  {request.plate_number}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {request.make} {request.model} (
                                  {request.color})
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {request.household_address || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {request.reason}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            <div>
                              <div className="font-medium">
                                {request.requester_name || "N/A"}
                              </div>
                              <div className="text-xs text-gray-500">
                                {request.requester_email || ""}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <UIBadge
                              className={
                                request.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : request.status === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : request.status === "rejected"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                              }
                            >
                              {request.status}
                            </UIBadge>
                            {request.admin_notes && (
                              <div className="text-xs text-gray-500 mt-1">
                                Note: {request.admin_notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-700 text-sm">
                            {new Date(request.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {request.status === "pending" && (
                                <>
                                  <Button
                                    onClick={() =>
                                      handleApproveReplacement(request.id)
                                    }
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 hover:text-green-700"
                                    title="Approve Request"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    onClick={() =>
                                      handleRejectReplacement(request.id)
                                    }
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-destructive"
                                    title="Reject Request"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              {request.status === "completed" && (
                                <span className="text-xs text-gray-500">
                                  Completed - New RFID created
                                </span>
                              )}
                              {request.status === "rejected" && (
                                <span className="text-xs text-gray-500">
                                  Rejected
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* RFID Assignment Modal */}
      <Dialog
        open={editVehicle.showRFIDModal}
        onOpenChange={(open) =>
          setEditVehicle({ ...editVehicle, showRFIDModal: open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign RFID Code</DialogTitle>
            <DialogDescription>
              Assign an RFID code to vehicle:{" "}
              {editVehicle.vehicle?.plate_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="rfid-code">RFID Code</Label>
              <Input
                id="rfid-code"
                value={editVehicle.rfidCode}
                onChange={(e) =>
                  setEditVehicle({
                    ...editVehicle,
                    rfidCode: e.target.value,
                  })
                }
                placeholder="Enter RFID code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditVehicle({
                  ...editVehicle,
                  showRFIDModal: false,
                  rfidCode: "",
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleAssignRFID}>
              <Save className="w-4 h-4 mr-2" />
              Assign RFID
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sticker Assignment Modal */}
      <Dialog
        open={editVehicle.showStickerModal}
        onOpenChange={(open) =>
          setEditVehicle({ ...editVehicle, showStickerModal: open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Sticker Number</DialogTitle>
            <DialogDescription>
              Assign a sticker number to vehicle:{" "}
              {editVehicle.vehicle?.plate_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="sticker-number">Sticker Number</Label>
              <Input
                id="sticker-number"
                value={editVehicle.stickerNumber}
                onChange={(e) =>
                  setEditVehicle({
                    ...editVehicle,
                    stickerNumber: e.target.value,
                  })
                }
                placeholder="Enter sticker number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditVehicle({
                  ...editVehicle,
                  showStickerModal: false,
                  stickerNumber: "",
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleAssignSticker}>
              <Save className="w-4 h-4 mr-2" />
              Assign Sticker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Recording Modal */}
      <Dialog
        open={editVehicle.showPaymentModal}
        onOpenChange={(open) =>
          setEditVehicle({ ...editVehicle, showPaymentModal: open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment for vehicle: {editVehicle.vehicle?.plate_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gray-50 dark:bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Amount Due:</p>
              <p className="text-2xl font-bold text-card-foreground">
                ₱
                {editVehicle.vehicle?.amount_due
                  ? editVehicle.vehicle.amount_due.toFixed(2)
                  : "0.00"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              This will mark the vehicle as paid and activate the pass if
              pending approval.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditVehicle({
                  ...editVehicle,
                  showPaymentModal: false,
                  paymentAmount: "",
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment}>
              <Wallet className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fees Modal */}
      <Dialog
        open={editFees.showEditModal}
        onOpenChange={(open) =>
          setEditFees({ ...editFees, showEditModal: open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pass Fees</DialogTitle>
            <DialogDescription>
              Update the fees for different pass types
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="sticker-fee">Sticker Pass Fee (₱)</Label>
              <Input
                id="sticker-fee"
                type="number"
                step="0.01"
                min="0"
                value={editFees.stickerFee}
                onChange={(e) =>
                  setEditFees({ ...editFees, stickerFee: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="rfid-fee">RFID Pass Fee (₱)</Label>
              <Input
                id="rfid-fee"
                type="number"
                step="0.01"
                min="0"
                value={editFees.rfidFee}
                onChange={(e) =>
                  setEditFees({ ...editFees, rfidFee: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditFees({ ...editFees, showEditModal: false })}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateFees}>
              <Save className="w-4 h-4 mr-2" />
              Save Fees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Employee Modal */}
      <Dialog open={showEmployeeModal} onOpenChange={setShowEmployeeModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Employee Pass</DialogTitle>
            <DialogDescription>
              Create a new employee pass for a household
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="employee-household">Household *</Label>
              <div className="relative">
                <Input
                  id="employee-household"
                  value={employeeHouseholdSearch}
                  onChange={(e) => {
                    setEmployeeHouseholdSearch(e.target.value);
                    const matched = allHouseholds.find(
                      (hh) =>
                        hh.id === e.target.value ||
                        (hh.address || `Block ${hh.block} Lot ${hh.lot}`)
                          .toLowerCase()
                          .includes(e.target.value.toLowerCase()),
                    );
                    if (matched && e.target.value === matched.id) {
                      setEmployeeForm({
                        ...employeeForm,
                        household_id: matched.id,
                      });
                    }
                  }}
                  placeholder="Search by address, block, or lot..."
                  className="w-full"
                  autoComplete="off"
                />
                {employeeHouseholdSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {allHouseholds
                      .filter(
                        (hh) =>
                          !employeeHouseholdSearch ||
                          (hh.address || `Block ${hh.block} Lot ${hh.lot}`)
                            .toLowerCase()
                            .includes(employeeHouseholdSearch.toLowerCase()) ||
                          hh.id
                            .toLowerCase()
                            .includes(employeeHouseholdSearch.toLowerCase()),
                      )
                      .filter((hh) => hh.id !== employeeForm.household_id)
                      .slice(0, 20)
                      .map((hh) => (
                        <div
                          key={hh.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => {
                            setEmployeeForm({
                              ...employeeForm,
                              household_id: hh.id,
                            });
                            setEmployeeHouseholdSearch(
                              hh.address || `Block ${hh.block} Lot ${hh.lot}`,
                            );
                          }}
                        >
                          <div className="font-medium">
                            {hh.address || `Block ${hh.block} Lot ${hh.lot}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {hh.id}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {employeeForm.household_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected:{" "}
                  {allHouseholds.find(
                    (hh) => hh.id === employeeForm.household_id,
                  )?.address ||
                    `Block ${allHouseholds.find((hh) => hh.id === employeeForm.household_id)?.block} Lot ${allHouseholds.find((hh) => hh.id === employeeForm.household_id)?.lot}`}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="employee-name">Full Name *</Label>
              <Input
                id="employee-name"
                value={employeeForm.full_name}
                onChange={(e) =>
                  setEmployeeForm({
                    ...employeeForm,
                    full_name: e.target.value,
                  })
                }
                placeholder="Enter employee's full name"
              />
            </div>
            <div>
              <Label htmlFor="employee-type">Employee Type *</Label>
              <Select
                value={employeeForm.employee_type}
                onValueChange={(value) =>
                  setEmployeeForm({
                    ...employeeForm,
                    employee_type: value as EmployeeType,
                  })
                }
              >
                <SelectTrigger id="employee-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="housekeeper">Housekeeper</SelectItem>
                  <SelectItem value="caretaker">Caretaker</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="employee-expiry">Expiry Date (Optional)</Label>
              <Input
                id="employee-expiry"
                type="date"
                value={employeeForm.expiry_date}
                onChange={(e) =>
                  setEmployeeForm({
                    ...employeeForm,
                    expiry_date: e.target.value,
                  })
                }
              />
            </div>
            <div>
              <Label htmlFor="employee-photo">Photo (Optional)</Label>
              <Input
                id="employee-photo"
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const base64 = await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = (e) =>
                        resolve(e.target?.result as string);
                      reader.readAsDataURL(file);
                    });
                    setEmployeeForm({ ...employeeForm, photo: base64 });
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmployeeModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateEmployee}
              disabled={
                !employeeForm.household_id ||
                !employeeForm.full_name ||
                !employeeForm.employee_type
              }
            >
              <Save className="w-4 h-4 mr-2" />
              Create Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Vehicle Modal */}
      <Dialog open={showVehicleModal} onOpenChange={setShowVehicleModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Vehicle Registration</DialogTitle>
            <DialogDescription>
              Register a new vehicle for a household
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="vehicle-household">Household *</Label>
              <div className="relative">
                <Input
                  id="vehicle-household"
                  value={vehicleHouseholdSearch}
                  onChange={(e) => {
                    setVehicleHouseholdSearch(e.target.value);
                    const matched = allHouseholds.find(
                      (hh) =>
                        hh.id === e.target.value ||
                        (hh.address || `Block ${hh.block} Lot ${hh.lot}`)
                          .toLowerCase()
                          .includes(e.target.value.toLowerCase()),
                    );
                    if (matched && e.target.value === matched.id) {
                      setVehicleForm({
                        ...vehicleForm,
                        household_id: matched.id,
                      });
                    }
                  }}
                  placeholder="Search by address, block, or lot..."
                  className="w-full"
                  autoComplete="off"
                />
                {vehicleHouseholdSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {allHouseholds
                      .filter(
                        (hh) =>
                          !vehicleHouseholdSearch ||
                          (hh.address || `Block ${hh.block} Lot ${hh.lot}`)
                            .toLowerCase()
                            .includes(vehicleHouseholdSearch.toLowerCase()) ||
                          hh.id
                            .toLowerCase()
                            .includes(vehicleHouseholdSearch.toLowerCase()),
                      )
                      .filter((hh) => hh.id !== vehicleForm.household_id)
                      .slice(0, 20)
                      .map((hh) => (
                        <div
                          key={hh.id}
                          className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                          onClick={() => {
                            setVehicleForm({
                              ...vehicleForm,
                              household_id: hh.id,
                            });
                            setVehicleHouseholdSearch(
                              hh.address || `Block ${hh.block} Lot ${hh.lot}`,
                            );
                          }}
                        >
                          <div className="font-medium">
                            {hh.address || `Block ${hh.block} Lot ${hh.lot}`}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {hh.id}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              {vehicleForm.household_id && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected:{" "}
                  {allHouseholds.find(
                    (hh) => hh.id === vehicleForm.household_id,
                  )?.address ||
                    `Block ${allHouseholds.find((hh) => hh.id === vehicleForm.household_id)?.block} Lot ${allHouseholds.find((hh) => hh.id === vehicleForm.household_id)?.lot}`}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="vehicle-plate">Plate Number *</Label>
              <Input
                id="vehicle-plate"
                value={vehicleForm.plate_number}
                onChange={(e) =>
                  setVehicleForm({
                    ...vehicleForm,
                    plate_number: e.target.value.toUpperCase(),
                  })
                }
                placeholder="ABC 123"
                className="uppercase"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="vehicle-make">Make *</Label>
                <Input
                  id="vehicle-make"
                  value={vehicleForm.make}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, make: e.target.value })
                  }
                  placeholder="Toyota"
                />
              </div>
              <div>
                <Label htmlFor="vehicle-model">Model *</Label>
                <Input
                  id="vehicle-model"
                  value={vehicleForm.model}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, model: e.target.value })
                  }
                  placeholder="Vios"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="vehicle-color">Color *</Label>
              <Input
                id="vehicle-color"
                value={vehicleForm.color}
                onChange={(e) =>
                  setVehicleForm({ ...vehicleForm, color: e.target.value })
                }
                placeholder="White"
              />
            </div>
            <div>
              <Label>Pass Types *</Label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vehicleForm.has_sticker}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        has_sticker: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span>
                    Sticker Pass (₱
                    {fees.find((f) => f.pass_type_code === "sticker")?.amount ||
                      0}
                    )
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={vehicleForm.has_rfid}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        has_rfid: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <span>
                    RFID Pass (₱
                    {fees.find((f) => f.pass_type_code === "rfid")?.amount || 0}
                    )
                  </span>
                </label>
              </div>
              {(vehicleForm.has_sticker || vehicleForm.has_rfid) && (
                <p className="text-sm text-muted-foreground mt-2">
                  Total Fee: ₱
                  {(vehicleForm.has_sticker
                    ? fees.find((f) => f.pass_type_code === "sticker")
                        ?.amount || 0
                    : 0) +
                    (vehicleForm.has_rfid
                      ? fees.find((f) => f.pass_type_code === "rfid")?.amount ||
                        0
                      : 0)}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVehicleModal(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateVehicle}
              disabled={
                !vehicleForm.household_id ||
                !vehicleForm.plate_number ||
                !vehicleForm.make ||
                !vehicleForm.model ||
                !vehicleForm.color ||
                (!vehicleForm.has_sticker && !vehicleForm.has_rfid)
              }
            >
              <Save className="w-4 h-4 mr-2" />
              Register Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
