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

const passTypeLabels: Record<PassType, string> = {
  sticker: "Sticker Only",
  rfid: "RFID Only",
  both: "Sticker + RFID",
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
          (f) => f.fee_type === "sticker",
        );
        const rfidFee = feesResult.data.fees.find((f) => f.fee_type === "rfid");
        setEditFees({
          stickerFee: stickerFee?.amount.toString() || "",
          rfidFee: rfidFee?.amount.toString() || "",
          showEditModal: false,
        });
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

  function getFeeForType(passType: PassType): number {
    const fee = fees.find((f) => f.fee_type === passType);
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
          <h1 className="text-2xl font-bold text-card-foreground">Pass Management</h1>
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
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Employees</p>
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
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold text-card-foreground">
                  {stats.pending_approvals}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Wallet className="w-6 h-6 text-purple-600" />
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
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
            </div>

            {/* Employee Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Employee
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      ID Number
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Address
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Dates
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
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
                        <td className="py-3 px-4 text-gray-700">
                          {employeeTypeLabels[employee.employee_type]}
                        </td>
                        <td className="py-3 px-4 text-gray-700">
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
                              onClick={() => handleDeleteEmployee(employee.id)}
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
            </div>

            {/* Vehicle Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Vehicle
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Pass Type
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Address
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Payment
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
                      Codes
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">
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
                                {vehicle.make} {vehicle.model} ({vehicle.color})
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {passTypeLabels[vehicle.pass_type]}
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
                                    stickerNumber: vehicle.sticker_number || "",
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
                            {vehicle.status === "pending_approval" && (
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
                  <div className="p-3 bg-blue-100 rounded-lg">
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
                  <div className="p-3 bg-green-100 rounded-lg">
                    <CreditCard className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">RFID Pass</h3>
                    <p className="text-sm text-muted-foreground">Electronic RFID tag</p>
                  </div>
                </div>
                <div className="text-3xl font-bold text-card-foreground">
                  ₱{getFeeForType("rfid").toFixed(2)}
                </div>
              </div>
              <div className="p-6 border rounded-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <Badge className="w-6 h-6 text-purple-600" />
                    <CreditCard className="w-6 h-6 text-purple-600 -ml-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-card-foreground">Both Passes</h3>
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
            <div className="p-4 bg-gray-50 rounded-lg">
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
    </div>
  );
}
