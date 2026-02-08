import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
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

const employeeStatusColors: Record<EmployeeStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  active: "bg-green-100 text-green-700",
  revoked: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-700",
};

const vehicleStatusColors: Record<VehicleStatus, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const paymentStatusColors: Record<VehiclePaymentStatus, string> = {
  unpaid: "bg-red-100 text-red-700",
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
  const { user } = useAuth();
  const [employees, setEmployees] = useState<HouseholdEmployee[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRegistration[]>([]);
  const [fees, setFees] = useState<PassFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal states
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);

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

  // Mock household ID - in production, this would come from user's household relation
  const householdId = user?.id || "mock-household-id";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError("");

    // Load employees
    const empResult = await api.passRequests.employees.list(householdId);
    if (empResult.error) {
      setError(empResult.error);
    } else if (empResult.data) {
      setEmployees(empResult.data.employees);
    }

    // Load vehicles
    const vehResult = await api.passRequests.vehicles.list(householdId);
    if (vehResult.error) {
      setError(vehResult.error);
    } else if (vehResult.data) {
      setVehicles(vehResult.data.vehicles);
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
      household_id: householdId,
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
      household_id: householdId,
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
    const fee = fees.find((f) => f.fee_type === passType);
    return fee?.amount || 0;
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
        <h1 className="text-2xl font-bold text-gray-900">Resident Passes</h1>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <XCircle className="w-5 h-5" />
          {error}
          <button onClick={() => setError("")} className="ml-auto">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Employees</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.activeEmployees}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Car className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.activeVehicles}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approvals</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.pendingVehicles}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Wallet className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Due</p>
              <p className="text-2xl font-bold text-gray-900">
                ₱{stats.totalDue.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Fees */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Current Pass Fees
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Badge className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Sticker Pass</span>
            </div>
            <span className="text-lg font-bold text-gray-900">
              ₱{getFeeForType("sticker").toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900">RFID Pass</span>
            </div>
            <span className="text-lg font-bold text-gray-900">
              ₱{getFeeForType("rfid").toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Employee Passes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
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
          <div className="mb-6 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Register New Employee Pass
            </h3>
            <form onSubmit={handleSubmitEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="driver">Driver</option>
                    <option value="housekeeper">Housekeeper</option>
                    <option value="caretaker">Caretaker</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
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
                className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
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
                      <h3 className="font-medium text-gray-900">
                        {employee.full_name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${employeeStatusColors[employee.status]}`}
                      >
                        {employee.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {employeeTypeLabels[employee.employee_type]}
                    </p>
                    <p className="text-sm text-gray-500">
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
                {employee.status !== "revoked" &&
                  employee.status !== "expired" && (
                    <button
                      onClick={() => handleDeleteEmployee(employee.id)}
                      className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                    >
                      Revoke
                    </button>
                  )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No employee passes registered. Add your first employee pass to get
            started.
          </div>
        )}
      </div>

      {/* Vehicle Passes Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
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
          <div className="mb-6 p-6 bg-gray-50 rounded-lg">
            <h3 className="text-md font-semibold text-gray-900 mb-4">
              Register New Vehicle Pass
            </h3>
            <form onSubmit={handleSubmitVehicle} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Make
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.make}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, make: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.model}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, model: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color
                  </label>
                  <input
                    type="text"
                    value={vehicleForm.color}
                    onChange={(e) =>
                      setVehicleForm({ ...vehicleForm, color: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
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
                className="flex items-start justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Car className="w-8 h-8 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">
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
                    <p className="text-sm text-gray-600">
                      {vehicle.make} {vehicle.model} ({vehicle.color})
                    </p>
                    <p className="text-sm text-gray-500">
                      {passTypeLabels[vehicle.pass_type]}
                    </p>
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
                {vehicle.status !== "cancelled" && (
                  <button
                    onClick={() => handleDeleteVehicle(vehicle.id)}
                    className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No vehicle passes registered. Add your first vehicle pass to get
            started.
          </div>
        )}
      </div>
    </div>
  );
}
