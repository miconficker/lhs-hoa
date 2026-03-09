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
  owner_user_id?: string; // Nullable for HOA-owned lots (developer-owner), required for residential
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
export type AmenityType =
  | "clubhouse"
  | "pool"
  | "basketball-court"
  | "tennis-court";
export type ReservationSlot = "AM" | "PM" | "FULL_DAY";
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

export interface ReservationWithHousehold extends Reservation {
  household_address?: string; // Populated by JOIN in admin queries
}

export interface AmenityAvailability {
  date: string;
  amenity_type: AmenityType;
  am_available: boolean;
  pm_available: boolean;
  am_blocked?: boolean;
  pm_blocked?: boolean;
  block_reason?: string;
}

// New types for reservations management
export type TimeBlockSlot = "AM" | "PM" | "FULL_DAY";
export type RentalPaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export interface TimeBlock {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface ExternalRental {
  id: string;
  amenity_type: AmenityType;
  date: string;
  slot: TimeBlockSlot;
  renter_name: string;
  renter_contact?: string;
  amount: number;
  payment_status: RentalPaymentStatus;
  amount_paid: number;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface TimeBlocksResponse {
  time_blocks: TimeBlock[];
}

export interface ExternalRentalsResponse {
  rentals: ExternalRental[];
}

export interface CreateTimeBlockInput {
  amenity_type: AmenityType;
  date: string; // YYYY-MM-DD format
  slot: TimeBlockSlot;
  reason: string;
}

export interface CreateExternalRentalInput {
  amenity_type: AmenityType;
  date: string; // YYYY-MM-DD format
  slot: TimeBlockSlot;
  renter_name: string;
  renter_contact?: string;
  amount: number;
  notes?: string;
}

export interface RecordPaymentInput {
  amount: number;
  payment_method?: string;
  receipt_number?: string;
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
export type PaymentCategory = "dues" | "vehicle_pass" | "employee_id";
export type PaymentVerificationStatus = "pending" | "verified" | "not_required";
export type VerificationQueueStatus = "pending" | "approved" | "rejected";

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
  late_fee_amount?: number; // Accumulated late fees
  late_fee_months?: number; // Number of months late fee calculated for
  received_by?: string; // Admin who recorded in-person payment
  payment_category: PaymentCategory; // Type of payment (required for verification system)
  verification_status?: PaymentVerificationStatus; // Proof verification status
  proof_uploaded_at?: string; // When proof was uploaded
  household_address?: string; // Populated by JOIN in admin queries
}

export interface OutstandingBalance {
  household_id: string;
  total_due: number;
  periods_due: string[];
}

// =============================================================================
// Payment Verification System
// =============================================================================

export interface PaymentProof {
  id: string;
  payment_id: string;
  file_url: string;
  file_name?: string;
  uploaded_at: string;
  verified: boolean;
  verified_by?: string;
  verified_at?: string;
  notes?: string;
  created_at: string;
}

export interface PaymentVerificationQueue {
  id: string; // queue_id
  payment_id: string;
  user_id: string;
  household_id?: string;
  payment_type: PaymentCategory;
  amount: number;
  reference_number?: string;
  proof_uploaded_at: string;
  status: VerificationQueueStatus;
  rejection_reason?: string;
  notified_admin: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  file_url?: string;
  file_name?: string;
  user_email?: string;
  first_name?: string;
  last_name?: string;
  household_address?: string;
}

export interface InitiatePaymentInput {
  payment_type: PaymentCategory;
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  proof: File;
}

export interface InitiatePaymentResponse {
  payment: Payment;
  proof: { id: string; file_url: string };
  queue_id: string;
}

export interface VerifyPaymentInput {
  action: "approve" | "reject";
  rejection_reason?: string;
}

export interface PaymentSettings {
  bank_details: {
    bank_name: string;
    account_name: string;
    account_number: string;
  };
  gcash_details: {
    name: string;
    number: string;
  };
  late_fee_config: {
    rate_percent: number;
    grace_period_days: number;
    max_months: number;
  };
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
  lot_type?: LotType; // Lot type
  owner_user_id?: string; // NEW
  owner_name?: string; // NEW: only included for admin users
  owner_email?: string; // Owner email
  lot_size_sqm?: number; // NEW
  lot_label?: string | null; // Lot label
  lot_description?: string | null; // Lot description
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
  | "alert"
  | "payment_verification_requested"
  | "payment_verified"
  | "payment_rejected";

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
// Legacy pass type (kept for backward compatibility)
export type PassType = "sticker" | "rfid" | "both";

// New unified pass system types
export type PassTypeCategory = "vehicle" | "employee" | "resident" | "visitor";
export type PassTypeCode = "sticker" | "rfid" | "employee_id" | "vip" | "valet";
export type PassPaymentStatus = "unpaid" | "paid" | "partial";

export type VehicleStatus =
  | "pending_payment"
  | "pending_approval"
  | "active"
  | "cancelled";
export type VehiclePaymentStatus = "unpaid" | "paid";

// Pass Type Registry
export interface PassTypeRecord {
  id: string;
  code: PassTypeCode;
  name: string;
  category: PassTypeCategory;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// Individual Vehicle Pass (new unified system)
export interface VehiclePass {
  id: string;
  vehicle_id: string;
  pass_type_id: string;
  identifier: string; // sticker_number or rfid_code
  amount_due: number;
  amount_paid: number;
  payment_status: PassPaymentStatus;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Joined fields (from views)
  pass_type_code?: PassTypeCode;
  pass_type_name?: string;
  pass_type_category?: PassTypeCategory;
  plate_number?: string;
  make?: string;
  model?: string;
  color?: string;
  household_address?: string;
  balance_due?: number;
}

// Updated Household Employee with payment fields
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

  // New payment fields
  pass_type_id?: string;
  amount_due?: number;
  amount_paid?: number;
  payment_status?: PassPaymentStatus;
  balance_due?: number;

  // Pass type details (from view)
  pass_type_code?: PassTypeCode;
  pass_type_name?: string;
}

// Vehicle Registration (updated to work with new system)
export interface VehicleRegistration {
  id: string;
  household_id: string;
  household_address?: string; // Populated by JOIN
  plate_number: string;
  make: string;
  model: string;
  color: string;
  pass_type: PassType; // Legacy field, kept for backward compatibility
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

  // New unified system fields (from view)
  sticker_pass_id?: string;
  sticker_amount_due?: number;
  sticker_amount_paid?: number;
  sticker_payment_status?: PassPaymentStatus;
  rfid_pass_id?: string;
  rfid_amount_due?: number;
  rfid_amount_paid?: number;
  rfid_payment_status?: PassPaymentStatus;
  total_amount_due?: number;
  total_amount_paid?: number;
  total_balance_due?: number;
}

// Updated Pass Fee (references pass_types)
export interface PassFee {
  id: string;
  pass_type_id: string;
  pass_type_code?: PassTypeCode;
  pass_type_name?: string;
  amount: number;
  effective_date: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

// Create vehicle with individual pass selection (new system)
export interface CreateVehicleInputUnified {
  household_id: string;
  plate_number: string;
  make: string;
  model: string;
  color: string;
  has_sticker: boolean;
  has_rfid: boolean;
}

// Record payment for a specific pass (new system)
export interface RecordPassPaymentInput {
  vehicle_pass_id?: string;
  employee_pass_id?: string;
  amount: number;
  method: PaymentMethod;
  reference_number?: string;
  notes?: string;
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
  pass_type?: PassType; // Legacy field for backward compatibility
  has_sticker?: boolean; // New field for unified system
  has_rfid?: boolean; // New field for unified system
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

// NOTE: RecordPaymentInput was moved to line 221 for external rentals
// For pass payments, use RecordPassPaymentInput (line 812) instead

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

// Messaging System Types
export type MessageCategory =
  | "general"
  | "service_request"
  | "payment"
  | "reservation"
  | "admin";

export interface MessageThread {
  id: string;
  subject: string | null;
  category: MessageCategory;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message_at?: string;
  last_read_at?: string;
  unread_count?: number;
}

export interface ThreadParticipant {
  id: string;
  thread_id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  last_read_at: string | null;
  is_active: boolean;
  joined_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_email?: string;
  sender_name?: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface MessageThreadDetail {
  thread: MessageThread;
  participants: ThreadParticipant[];
  messages: Message[];
}

export interface CreateThreadInput {
  subject?: string;
  category?: MessageCategory;
  participant_ids: string[];
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
}

export interface SendMessageInput {
  body: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: string;
}

export interface UpdateThreadInput {
  subject?: string;
}

export interface ThreadsResponse {
  threads: MessageThread[];
}

export interface ThreadResponse {
  thread: MessageThread;
  participants: ThreadParticipant[];
  messages: Message[];
}

export interface CreateThreadResponse {
  thread_id: string;
  message: Message;
}

export interface MessageResponse {
  message: Message;
}
