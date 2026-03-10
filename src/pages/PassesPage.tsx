import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Users,
  Car,
  Plus,
  X,
  Check,
  XCircle,
  CreditCard,
  Badge,
  Calendar,
  Wallet,
  RefreshCcw,
} from "lucide-react";
import type {
  HouseholdEmployee,
  VehicleRegistration,
  PassFee,
  EmployeeStatus,
  VehicleStatus,
  VehiclePaymentStatus,
  EmployeeType,
  PassType,
} from "@/types";
import { PayNowModal } from "@/components/PayNowModal";

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

interface EmployeeForm {
  full_name: string;
  employee_type: EmployeeType;
  photo?: File;
  expiry_date?: string;
}

interface VehicleForm {
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
}

export function PassesPage() {
  const [employees, setEmployees] = useState<HouseholdEmployee[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRegistration[]>([]);
  const [fees, setFees] = useState<PassFee[]>([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal states
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showPayNowModal, setShowPayNowModal] = useState(false);
  const [paymentForVehicle, setPaymentForVehicle] =
    useState<VehicleRegistration | null>(null);
  const [paymentForEmployee, setPaymentForEmployee] =
    useState<HouseholdEmployee | null>(null);

  // Form states
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>({
    full_name: "",
    employee_type: "driver",
    expiry_date: "",
  });
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>({
    plate_number: "",
    make: "",
    model: "",
    color: "",
    pass_type: "sticker",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    // Load user's household from lot_members
    if (!selectedHouseholdId) {
      const membershipsResult = await api.lotMembers.getMyMemberships();
      if (membershipsResult.data && membershipsResult.data.lots.length > 0) {
        setSelectedHouseholdId(membershipsResult.data.lots[0].household_id);
      }
    }

    // Load employees
    const empResult = await api.passRequests.employees.list();
    if (empResult.error) {
      setError(empResult.error);
    } else if (empResult.data) {
      setEmployees(empResult.data.employees);
      // Also set household_id from employees if not set
      if (empResult.data.employees.length > 0 && !selectedHouseholdId) {
        setSelectedHouseholdId(empResult.data.employees[0].household_id);
      }
    }

    // Load vehicles
    const vehResult = await api.passRequests.vehicles.list();
    if (vehResult.error) {
      setError(vehResult.error);
    } else if (vehResult.data) {
      setVehicles(vehResult.data.vehicles);
      // Also set household_id from vehicles if not set
      if (vehResult.data.vehicles.length > 0 && !selectedHouseholdId) {
        setSelectedHouseholdId(vehResult.data.vehicles[0].household_id);
      }
    }

    // Load fees
    const feesResult = await api.passRequests.getFees();
    if (feesResult.data) {
      setFees(feesResult.data.fees);
    }

    setLoading(false);
  }

  async function handleSubmitEmployee(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const result = await api.passRequests.employees.create({
      household_id: selectedHouseholdId,
      full_name: employeeForm.full_name,
      employee_type: employeeForm.employee_type,
      photo: employeeForm.photo,
      expiry_date: employeeForm.expiry_date || undefined,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Employee pass request submitted successfully!");
      setShowEmployeeForm(false);
      setEmployeeForm({
        full_name: "",
        employee_type: "driver",
        expiry_date: "",
      });
      loadData();
    }
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm("Are you sure you want to revoke this employee pass?")) {
      return;
    }

    const result = await api.passRequests.employees.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Employee pass revoked successfully!");
      loadData();
    }
  }

  async function handleSubmitVehicle(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    const result = await api.passRequests.vehicles.create({
      household_id: selectedHouseholdId,
      plate_number: vehicleForm.plate_number,
      make: vehicleForm.make,
      model: vehicleForm.model,
      color: vehicleForm.color,
      pass_type: vehicleForm.pass_type,
    });

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Vehicle registration submitted successfully!");
      setShowVehicleForm(false);
      setVehicleForm({
        plate_number: "",
        make: "",
        model: "",
        color: "",
        pass_type: "sticker",
      });
      loadData();
    }
  }

  async function handleDeleteVehicle(id: string) {
    if (
      !confirm("Are you sure you want to cancel this vehicle registration?")
    ) {
      return;
    }

    const result = await api.passRequests.vehicles.delete(id);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage("Vehicle registration cancelled successfully!");
      loadData();
    }
  }

  function getFeeForType(passType: PassType): number {
    if (passType === "both") {
      const stickerFee =
        fees.find((f) => f.pass_type_code === "sticker")?.amount || 0;
      const rfidFee =
        fees.find((f) => f.pass_type_code === "rfid")?.amount || 0;
      return stickerFee + rfidFee;
    }
    const fee = fees.find((f) => f.pass_type_code === passType);
    return fee?.amount || 0;
  }

  function handlePayNow(vehicle: VehicleRegistration) {
    setPaymentForVehicle(vehicle);
    setPaymentForEmployee(null);
    setShowPayNowModal(true);
  }

  function handlePayForEmployee(employee: HouseholdEmployee) {
    setPaymentForEmployee(employee);
    setPaymentForVehicle(null);
    setShowPayNowModal(true);
  }

  async function handleRequestRfidReplacement(vehicleId: string) {
    const reason = prompt(
      "Please provide a reason for RFID replacement (e.g., Card is damaged, Lost card):",
    );
    if (!reason) return;

    setError("");
    setSuccessMessage("");

    const result = await api.passRequests.vehicles.requestRfidReplacement(
      vehicleId,
      {
        reason,
      },
    );

    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMessage(
        "RFID replacement request submitted! Admin will review and process your request.",
      );
      loadData();
    }
  }

  async function handleRequestStickerRenewal(vehicleId: string) {
    if (
      !confirm(
        "This will create a new sticker pass for next year with a fee. Continue?",
      )
    ) {
      return;
    }

    setError("");
    setSuccessMessage("");

    const result =
      await api.passRequests.vehicles.requestStickerRenewal(vehicleId);

    if (result.error) {
      setError(result.error);
    } else if (result.data) {
      setSuccessMessage(
        `Sticker renewal requested! New sticker for ${result.data.new_pass.expiry_year} created. Fee: ₱${result.data.new_pass.amount_due}`,
      );
      loadData();
    }
  }

  function getStats() {
    const activeEmployees = employees.filter(
      (e) => e.status === "active",
    ).length;
    const activeVehicles = vehicles.filter((v) => v.status === "active").length;
    const pendingVehicles = vehicles.filter(
      (v) => v.status === "pending_payment" || v.status === "pending_approval",
    ).length;
    const totalDue = vehicles
      .filter((v) => v.payment_status === "unpaid")
      .reduce((sum, v) => sum + (v.amount_due || 0), 0);

    return { activeEmployees, activeVehicles, pendingVehicles, totalDue };
  }

  const stats = getStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-card-foreground">
          Resident Passes
        </h1>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50/50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {successMessage}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Employees</p>
              <p className="text-2xl font-bold text-card-foreground">
                {stats.activeEmployees}
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
                {stats.activeVehicles}
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
                {stats.pendingVehicles}
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
              <p className="text-sm text-muted-foreground">Total Due</p>
              <p className="text-2xl font-bold text-card-foreground">
                ₱{stats.totalDue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Fees */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-card-foreground mb-4">
          Current Pass Fees
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Badge className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-card-foreground">
                Sticker Pass
              </span>
            </div>
            <span className="text-lg font-bold text-card-foreground">
              ₱{getFeeForType("sticker").toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-green-600" />
              <span className="font-medium text-card-foreground">
                RFID Pass
              </span>
            </div>
            <span className="text-lg font-bold text-card-foreground">
              ₱{getFeeForType("rfid").toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Employee Passes Section */}
      <div className="bg-card rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            Employee Passes
          </h2>
          <button
            onClick={() => setShowEmployeeForm(!showEmployeeForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {showEmployeeForm ? (
              <X className="w-5 h-5" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            {showEmployeeForm ? "Cancel" : "Add Employee"}
          </button>
        </div>

        {/* Employee Form */}
        {showEmployeeForm && (
          <div className="mb-6 p-6 bg-gray-50 dark:bg-muted rounded-lg">
            <h3 className="text-md font-semibold text-card-foreground mb-4">
              Register New Employee Pass
            </h3>
            <form onSubmit={handleSubmitEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={employeeForm.full_name}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Employee Type
                  </label>
                  <select
                    value={employeeForm.employee_type}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        employee_type: e.target.value as EmployeeType,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="driver">Driver</option>
                    <option value="housekeeper">Housekeeper</option>
                    <option value="caretaker">Caretaker</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Photo (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        photo: e.target.files?.[0],
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Expiry Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={employeeForm.expiry_date}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        expiry_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Employee List */}
        {employees.length > 0 ? (
          <div className="space-y-4">
            {employees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted"
              >
                <div className="flex items-start gap-4">
                  {employee.photo_url ? (
                    <img
                      src={employee.photo_url}
                      alt={employee.full_name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Users className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-card-foreground">
                        {employee.full_name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${employeeStatusColors[employee.status]}`}
                      >
                        {employee.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {employeeTypeLabels[employee.employee_type]}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ID: {employee.id_number}
                    </p>
                    {employee.issued_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        Issued:{" "}
                        {new Date(employee.issued_date).toLocaleDateString()}
                      </p>
                    )}
                    {employee.expiry_date && (
                      <p className="text-xs text-gray-400">
                        Expires:{" "}
                        {new Date(employee.expiry_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Pay Now button for pending employees */}
                  {employee.status === "pending" && (
                    <button
                      onClick={() => handlePayForEmployee(employee)}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Pay Now
                    </button>
                  )}
                  {employee.status !== "revoked" &&
                    employee.status !== "expired" && (
                      <button
                        onClick={() => handleDeleteEmployee(employee.id)}
                        className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-destructive/10"
                      >
                        Revoke
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No employee passes registered. Add your first employee pass to get
            started.
          </div>
        )}
      </div>

      {/* Vehicle Passes Section */}
      <div className="bg-card rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-card-foreground">
            Vehicle Passes
          </h2>
          <button
            onClick={() => setShowVehicleForm(!showVehicleForm)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            {showVehicleForm ? (
              <X className="w-5 h-5" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            {showVehicleForm ? "Cancel" : "Add Vehicle"}
          </button>
        </div>

        {/* Vehicle Form */}
        {showVehicleForm && (
          <div className="mb-6 p-6 bg-gray-50 dark:bg-muted rounded-lg">
            <h3 className="text-md font-semibold text-card-foreground mb-4">
              Register New Vehicle Pass
            </h3>
            <form onSubmit={handleSubmitVehicle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Plate Number
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.plate_number}
                    onChange={(e) =>
                      setVehicleForm({
                        ...vehicleForm,
                        plate_number: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, make: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, model: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, color: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-card-foreground mb-1">
                    Pass Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["sticker", "rfid", "both"] as PassType[]).map((type) => {
                      const fee = getFeeForType(type);
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() =>
                            setVehicleForm({ ...vehicleForm, pass_type: type })
                          }
                          className={`px-3 py-2 border rounded-lg text-center transition-colors ${
                            vehicleForm.pass_type === type
                              ? "bg-primary-600 text-white border-primary-600"
                              : "bg-card text-gray-700 border-gray-300 hover:bg-muted"
                          }`}
                        >
                          <div className="text-sm font-medium">
                            {passTypeLabels[type]}
                          </div>
                          <div className="text-xs mt-1">₱{fee.toFixed(2)}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Vehicle List */}
        {vehicles.length > 0 ? (
          <div className="space-y-4">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-start justify-between p-4 border border-border rounded-lg hover:bg-muted"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Car className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-card-foreground">
                        {vehicle.plate_number}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${vehicleStatusColors[vehicle.status]}`}
                      >
                        {vehicle.status}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${paymentStatusColors[vehicle.payment_status]}`}
                      >
                        {vehicle.payment_status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {vehicle.make} {vehicle.model} ({vehicle.color})
                    </p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {vehicle.sticker_pass_id && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                          Sticker
                        </span>
                      )}
                      {vehicle.rfid_pass_id && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                          RFID
                        </span>
                      )}
                    </div>
                    {vehicle.rfid_code && (
                      <p className="text-xs text-gray-400 mt-1">
                        RFID: {vehicle.rfid_code}
                      </p>
                    )}
                    {vehicle.sticker_number && (
                      <p className="text-xs text-gray-400">
                        Sticker: {vehicle.sticker_number}
                      </p>
                    )}
                    {vehicle.amount_due &&
                      vehicle.payment_status === "unpaid" && (
                        <p className="text-sm font-medium text-red-600 mt-1">
                          Due: ₱{vehicle.amount_due.toFixed(2)}
                        </p>
                      )}
                    {vehicle.issued_date && (
                      <p className="text-xs text-gray-400 mt-1">
                        Issued:{" "}
                        {new Date(vehicle.issued_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Request RFID Replacement button */}
                  {vehicle.rfid_pass_id && vehicle.status === "active" && (
                    <button
                      onClick={() => handleRequestRfidReplacement(vehicle.id)}
                      className="px-3 py-1.5 text-sm border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 flex items-center gap-1.5"
                      title="Request RFID Replacement"
                    >
                      <RefreshCcw className="w-3.5 h-3.5" />
                      Replace RFID
                    </button>
                  )}
                  {/* Renew Sticker button */}
                  {vehicle.sticker_pass_id && vehicle.status === "active" && (
                    <button
                      onClick={() => handleRequestStickerRenewal(vehicle.id)}
                      className="px-3 py-1.5 text-sm border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
                      title="Renew Sticker for Next Year"
                    >
                      <Badge className="w-3.5 h-3.5" />
                      Renew Sticker
                    </button>
                  )}
                  {/* Pay Now button for unpaid vehicles */}
                  {vehicle.payment_status === "unpaid" &&
                    vehicle.amount_due && (
                      <button
                        onClick={() => handlePayNow(vehicle)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Pay ₱{vehicle.amount_due.toFixed(0)}
                      </button>
                    )}
                  {vehicle.status !== "cancelled" && (
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-destructive/10"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No vehicle passes registered. Add your first vehicle pass to get
            started.
          </div>
        )}
      </div>

      {/* Pay Now Modal */}
      <PayNowModal
        isOpen={showPayNowModal}
        onClose={() => {
          setShowPayNowModal(false);
          setPaymentForVehicle(null);
          setPaymentForEmployee(null);
        }}
        onSuccess={() => {
          loadData();
          setShowPayNowModal(false);
          setPaymentForVehicle(null);
          setPaymentForEmployee(null);
        }}
        householdId={selectedHouseholdId}
        defaultType={
          paymentForVehicle
            ? "vehicle_pass"
            : paymentForEmployee
              ? "employee_id"
              : "dues"
        }
        defaultAmount={
          paymentForVehicle?.amount_due ||
          getFeeForType(paymentForVehicle?.pass_type || "sticker") ||
          (paymentForEmployee ? 100 : 0) // Default employee ID fee
        }
      />
    </div>
  );
}
