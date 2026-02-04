// User & Auth
export type UserRole = 'admin' | 'resident' | 'staff' | 'guest';

export interface User {
  id: string;
  email: string;
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

// Household & Residents
export interface Household {
  id: string;
  address: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_id?: string;
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

// Service Requests
export type ServiceRequestStatus = 'pending' | 'in-progress' | 'completed' | 'rejected';
export type ServiceRequestPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ServiceRequestCategory = 'plumbing' | 'electrical' | 'common-area' | 'security' | 'other';

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
export type AmenityType = 'clubhouse' | 'pool' | 'basketball-court';
export type ReservationSlot = 'AM' | 'PM';
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

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
export type AnnouncementCategory = 'event' | 'urgent' | 'info' | 'policy';

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
export type PaymentMethod = 'gcash' | 'paymaya' | 'instapay' | 'cash';
export type PaymentStatus = 'pending' | 'completed' | 'failed';

export interface Payment {
  id: string;
  household_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string;
  period: string; // "2025-01" format
  created_at: string;
  paid_at?: string;
}

export interface OutstandingBalance {
  household_id: string;
  total_due: number;
  periods_due: string[];
}

// Documents
export type DocumentCategory = 'rules' | 'forms' | 'minutes' | 'policies';

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
}

export interface PollWithResults extends Poll {
  votes: { option: string; count: number }[];
  total_votes: number;
  has_voted: boolean;
}

// Map
export interface MapHousehold extends Household {
  residents: string[]; // Names
  status: 'owned' | 'rented' | 'vacant';
}

export interface MapAmenity {
  id: string;
  name: string;
  type: AmenityType;
  latitude: number;
  longitude: number;
  icon: string;
}

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
