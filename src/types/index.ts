// User & Auth
export type UserRole = "admin" | "resident" | "staff" | "guest";

// Lot Status enum (development state)
export type LotStatus = "built" | "vacant_lot" | "under_construction";

// Lot Type enum (property category)
export type LotType =
  | "residential"
  | "resort"
  | "commercial"
  | "community"
  | "utility"
  | "open_space";

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  phone?: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface PreApprovedEmail {
  id: string;
  email: string;
  role: UserRole;
  household_id?: string;
  invited_by?: string;
  invited_at: string;
  accepted_at?: string;
  is_active: number;
}

// Household & Residents
export interface Household {
  id: string;
  address: string;
  street?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_user_id?: string; // UPDATED: Can be null (using existing owner_id in DB)
  lot_status?: LotStatus; // NEW: built, vacant_lot, under_construction
  lot_type?: LotType; // NEW: residential, resort, commercial, community, utility, open_space
  lot_size_sqm?: number; // NEW: Lot size in m² (nullable)
  lot_label?: string; // NEW: Label for community/utility lots
  lot_description?: string; // NEW: Description for community/utility lots
  household_group_id?: string | null; // NEW: For grouping merged lots
  is_primary_lot?: boolean; // NEW: Whether this is the primary lot in a merged group
  created_at: string;
}

export interface Resident {
  id: string;
  household_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  is_primary: boolean;
  created_at: string;
}

// New: Household with owner information populated
export interface HouseholdWithOwner extends Household {
  owner_name?: string; // Populated by JOIN
  owner_email?: string;
  owner_role?: UserRole;
}

// New: Lot ownership data for admin
export interface LotOwnership {
  lot_id: string;
  lot_number: string;
  street?: string;
  block_number: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  lot_status: LotStatus;
  lot_type?: LotType;
  lot_size_sqm?: number;
  lot_label?: string;
  lot_description?: string;
  household_group_id?: string | null;
  is_primary_lot?: boolean;
  address?: string;
}

// New: Array of lot ownership for admin list
export type LotOwnershipList = LotOwnership[];

// Service Requests
export type ServiceRequestStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "rejected";
export type ServiceRequestPriority = "low" | "normal" | "high" | "urgent";
export type ServiceRequestCategory =
  | "plumbing"
  | "electrical"
  | "common-area"
  | "security"
  | "other";

export interface ServiceRequest {
  id: string;
  household_id: string;
  category: ServiceRequestCategory;
  description: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// Reservations
export type AmenityType = "clubhouse" | "pool" | "basketball-court";
export type ReservationSlot = "AM" | "PM";
export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export interface Reservation {
  id: string;
  household_id: string;
  amenity_type: AmenityType;
  date: string; // ISO date string
  slot: ReservationSlot;
  status: ReservationStatus;
  purpose?: string;
  created_at: string;
}

export interface AmenityAvailability {
  date: string;
  amenity_type: AmenityType;
  am_available: boolean;
  pm_available: boolean;
}

// Announcements & Events
export type AnnouncementCategory = "event" | "urgent" | "info" | "policy";

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category?: AnnouncementCategory;
  is_pinned: boolean;
  created_by: string;
  created_at: string;
  expires_at?: string;
}

export interface Event {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  location?: string;
  created_at: string;
}

// Payments
export type PaymentMethod =
  | "gcash"
  | "paymaya"
  | "instapay"
  | "cash"
  | "in-person";
export type PaymentStatus = "pending" | "completed" | "failed";

export interface Payment {
  id: string;
  household_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string;
  period: string; // "2025" format for annual dues
  created_at: string;
  paid_at?: string;
  late_fee_amount?: number; // NEW: Accumulated late fees
  late_fee_months?: number; // NEW: Number of months late fee calculated for
  received_by?: string; // NEW: Admin who recorded in-person payment
}

export interface OutstandingBalance {
  household_id: string;
  total_due: number;
  periods_due: string[];
}

// Documents
export type DocumentCategory = "rules" | "forms" | "minutes" | "policies";

export interface Document {
  id: string;
  title: string;
  category?: DocumentCategory;
  file_url: string;
  uploaded_by: string;
  created_at: string;
}

// Polls
export interface Poll {
  id: string;
  question: string;
  options: string[];
  ends_at: string;
  created_by: string;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  household_id: string;
  selected_option: string;
  voted_at: string;
  lot_count?: number; // NEW: Number of lots this vote represents (proxy voting)
  voting_method?: "online" | "in-person"; // NEW: How the vote was cast
  recorded_by?: string; // NEW: Admin who recorded in-person vote
}

export interface PollWithResults extends Poll {
  votes: { option: string; count: number }[];
  total_votes: number;
  total_lots: number; // NEW: Total lots voted (weighted by lot_count)
  has_voted: boolean;
}

// Map
export interface MapHousehold extends Household {
  residents: string[]; // Names
  status: "owned" | "rented" | "vacant";
}

export interface MapAmenity {
  id: string;
  name: string;
  type: AmenityType;
  latitude: number;
  longitude: number;
  icon: string;
}

// GeoJSON Map Features
export interface LotFeatureProperties {
  path_id: string;
  street?: string | null;
  lot_number: string | null;
  block_number: string | null;
  area_sqm: number | null;
  status: LotStatus; // CHANGED: now uses LotStatus type
  owner_user_id?: string; // NEW
  owner_name?: string; // NEW: only included for admin users
  lot_size_sqm?: number; // NEW
  household_id?: string;
  residents?: string;
}

export interface StreetFeatureProperties {
  path_id: string;
  name?: string;
}

export interface BlockFeatureProperties {
  block_number: string;
  lot_count: number;
  area_sqm?: number | null;
}

export type LotFeature = GeoJSON.Feature<GeoJSON.Polygon, LotFeatureProperties>;

export type StreetFeature = GeoJSON.Feature<
  GeoJSON.LineString,
  StreetFeatureProperties
>;

export type BlockFeature = GeoJSON.Feature<
  GeoJSON.Polygon,
  BlockFeatureProperties
>;

// API Response wrapper
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

// Dashboard
export interface DashboardStats {
  households: number;
  pendingRequests: number;
  upcomingReservations: number;
  unpaidPayments: number;
}

export interface MyStats {
  pendingRequests: number;
  upcomingReservations: number;
  unpaidPayments: number;
  totalDue: number;
}

// Lot Annotation
export interface LotMapping {
  path_id: string;
  lot_number: string;
  block_number?: string;
  annotated_at?: string;
}

export interface LotMappingFile {
  version: string;
  created_at: string;
  mappings: LotMapping[];
}

// =============================================================================
// Dues & Payments
// =============================================================================

export interface DuesRate {
  id: string;
  rate_per_sqm: number;
  year: number;
  effective_date: string;
  created_at: string;
  created_by?: string;
}

export interface PaymentDemand {
  id: string;
  user_id: string;
  year: number;
  demand_sent_date: string;
  due_date: string;
  amount_due: number;
  status: "pending" | "paid" | "suspended";
  paid_date?: string;
  created_at: string;
}

export interface InstallmentPlan {
  id: string;
  user_id: string;
  year: number;
  total_amount: number;
  schedule: InstallmentSchedule[];
  status: "active" | "completed" | "cancelled";
  approved_by: string;
  approved_at: string;
  notes?: string;
  created_at: string;
}

export interface InstallmentSchedule {
  due_date: string;
  amount: number;
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  due_date: string;
  amount: number;
  paid_date?: string;
  status: "pending" | "paid" | "missed";
  created_at: string;
}

// =============================================================================
// My Lots Dashboard
// =============================================================================

export interface MyLot {
  lot_id: string;
  street?: string;
  block?: string;
  lot?: string;
  address: string;
  lot_status: LotStatus;
  lot_type?: LotType;
  lot_size_sqm?: number;
  lot_label?: string;
  lot_description?: string;
  annual_dues: number;
  payment_status?: "current" | "overdue" | "suspended";
  household_group_id?: string | null;
  is_primary_lot?: boolean;
  merged_lots?: string[];
}

export interface MyLotsSummary {
  total_lots: number;
  total_properties?: number;
  total_sqm: number;
  annual_dues_total: number;
  unpaid_periods: string[];
  voting_status: "eligible" | "suspended";
  rate_per_sqm: number;
  lots: MyLot[];
}

// =============================================================================
// Public Lot Information (for non-admin users)
// =============================================================================

export interface PublicLot {
  lot_id: string;
  street?: string;
  block?: string;
  lot?: string;
  lot_status: LotStatus;
  lot_type?: LotType;
  lot_label?: string;
  lot_description?: string;
  owner_user_id?: string; // Only included for lots owned by the current user
}

// =============================================================================
// Notifications
// =============================================================================

export type NotificationType =
  | "demand_letter"
  | "reminder"
  | "late_notice"
  | "announcement"
  | "alert";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  created_at: string;
  sent_at?: string;
}

export interface NotificationWithUser extends Notification {
  user_email?: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface NotificationResponse {
  notification: Notification;
}

export interface BulkNotificationInput {
  target: "all" | "delinquent" | "specific";
  user_ids?: string[];
  type: NotificationType;
  title: string;
  content: string;
  link?: string;
  send_now?: boolean;
}

export interface BulkNotificationResponse {
  success: boolean;
  count: number;
  notifications: Notification[];
}

export interface AdminNotificationsResponse {
  notifications: NotificationWithUser[];
}

// =============================================================================
// Pass Management System
// =============================================================================

export type EmployeeType = "driver" | "housekeeper" | "caretaker" | "other";
export type EmployeeStatus = "pending" | "active" | "revoked" | "expired";
export type PassType = "sticker" | "rfid" | "both";
export type VehicleStatus =
  | "pending_payment"
  | "pending_approval"
  | "active"
  | "cancelled";
export type VehiclePaymentStatus = "unpaid" | "paid";

export interface HouseholdEmployee {
  id: string;
  household_id: string;
  household_address?: string; // Populated by JOIN
  full_name: string;
  employee_type: EmployeeType;
  id_number: string;
  photo_url?: string;
  status: EmployeeStatus;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VehicleRegistration {
  id: string;
  household_id: string;
  household_address?: string; // Populated by JOIN
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
  rfid_code?: string;
  sticker_number?: string;
  status: VehicleStatus;
  payment_status: VehiclePaymentStatus;
  issued_date?: string;
  amount_due?: number;
  amount_paid?: number;
  payment_method?: PaymentMethod;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PassFee {
  id: string;
  fee_type: PassType;
  amount: number;
  effective_date: string;
  created_at: string;
}

// API Response types for pass management
export interface EmployeesResponse {
  employees: HouseholdEmployee[];
}

export interface EmployeeResponse {
  employee: HouseholdEmployee;
}

export interface VehiclesResponse {
  vehicles: VehicleRegistration[];
}

export interface VehicleResponse {
  vehicle: VehicleRegistration;
}

export interface PassFeesResponse {
  fees: PassFee[];
}

export interface PassFeesUpdateResponse {
  fees: PassFee[];
}

export interface CreateEmployeeInput {
  household_id: string;
  full_name: string;
  employee_type: EmployeeType;
  photo?: File;
  expiry_date?: string;
}

export interface UpdateEmployeeInput {
  full_name?: string;
  employee_type?: EmployeeType;
  expiry_date?: string;
  notes?: string;
}

export interface CreateVehicleInput {
  household_id: string;
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType;
}

export interface UpdateVehicleInput {
  plate_number?: string;
  make?: string;
  model?: string;
  color?: string;
  pass_type?: PassType;
}

export interface AssignRFIDInput {
  rfid_code: string;
}

export interface AssignStickerInput {
  sticker_number: string;
}

export interface RecordPaymentInput {
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  received_by: string;
}

export interface UpdateEmployeeStatusInput {
  status: EmployeeStatus;
  notes?: string;
}

export interface UpdateVehicleStatusInput {
  status: VehicleStatus;
  notes?: string;
}

// Dashboard stats for passes
export interface PassStats {
  active_employees: number;
  active_vehicles: number;
  pending_approvals: number;
  monthly_revenue: number;
}
