import type {
  AuthResponse,
  User,
  PreApprovedEmail,
  Announcement,
  Event,
  ServiceRequest,
  MapHousehold,
  Reservation,
  ReservationSlot,
  AmenityType,
  AmenityAvailability,
  Payment,
  PaymentMethod,
  PaymentCategory,
  Poll,
  PollWithResults,
  Document,
  LotOwnershipList,
  LotStatus,
  LotType,
  DuesRate,
  PaymentDemand,
  MyLotsSummary,
  MyLot,
  PublicLot,
  NotificationsResponse,
  NotificationResponse,
  BulkNotificationResponse,
  AdminNotificationsResponse,
  EmployeesResponse,
  EmployeeResponse,
  VehiclesResponse,
  VehicleResponse,
  PassFeesResponse,
  PassFeesUpdateResponse,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  CreateVehicleInput,
  UpdateVehicleInput,
  AssignRFIDInput,
  AssignStickerInput,
  UpdateEmployeeStatusInput,
  UpdateVehicleStatusInput,
  PassStats,
  EmployeeStatus,
  VehicleStatus,
  VehiclePaymentStatus,
  PaymentVerificationQueue,
  InitiatePaymentResponse,
  PaymentSettings,
  CreateThreadInput,
  SendMessageInput,
  UpdateThreadInput,
  ThreadsResponse,
  ThreadResponse,
  CreateThreadResponse,
  MessageResponse,
  // New unified pass system types
  PassTypeRecord,
  HouseholdEmployee,
  VehicleRegistration,
  PassType,
  // Time blocks and external rentals types
  TimeBlock,
  ExternalRental,
  TimeBlocksResponse,
  ExternalRentalsResponse,
  CreateTimeBlockInput,
  CreateExternalRentalInput,
  RecordPaymentInput,
  UserRole,
  ManualDelinquency,
  DelinquentMember,
  DelinquencySummary,
  DelinquencyStatus,
  DemandGenerationRequest,
  DemandGenerationResponse,
  MarkDelinquentRequest,
  WaiveDelinquencyRequest,
} from "@/types";

import { logger } from "@/lib/logger";

const API_BASE = "/api";

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("hoa_token");

  // Debug logging
  if (import.meta.env.DEV) {
    console.log(`[API] ${options.method || "GET"} ${API_BASE}${endpoint}`, {
      hasToken: !!token,
      tokenPreview: token ? `${token.substring(0, 20)}...` : "none",
    });
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Check if response has content before parsing JSON
  const contentType = response.headers.get("content-type");
  const hasJsonContent = contentType?.includes("application/json");

  if (!hasJsonContent || response.status === 204) {
    if (!response.ok) {
      return { error: response.statusText || "Request failed" };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  const text = await response.text();

  // Debug logging for errors
  if (import.meta.env.DEV && !response.ok) {
    logger.error(`API error: ${endpoint}`, {
      status: response.status,
      statusText: response.statusText,
      responseBody: text,
    });
  }

  if (!text.trim()) {
    if (!response.ok) {
      return { error: response.statusText || "Request failed" };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      return { error: data.error || "Request failed" };
    }
    return { data };
  } catch (e) {
    logger.error("JSON parse error", e, { responseText: text });
    return { error: "Invalid response from server" };
  }
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("hoa_token");

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  const contentType = response.headers.get("content-type");
  const hasJsonContent = contentType?.includes("application/json");

  if (!hasJsonContent || response.status === 204) {
    if (!response.ok) {
      return { error: response.statusText || "Upload failed" };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  const text = await response.text();

  // Debug logging for errors
  if (import.meta.env.DEV && !response.ok) {
    logger.error(`API error: ${endpoint}`, {
      status: response.status,
      statusText: response.statusText,
      responseBody: text,
    });
  }

  if (!text.trim()) {
    if (!response.ok) {
      return { error: response.statusText || "Upload failed" };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      return { error: data.error || "Upload failed" };
    }
    return { data };
  } catch (e) {
    logger.error("JSON parse error", e, { responseText: text });
    return { error: "Invalid response from server" };
  }
}

// Helper functions for common API requests
async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

async function apiPut<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
  return apiRequest<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials extends LoginCredentials {
  role: string;
}

// Dashboard types
export interface RequestStatusChartData {
  name: string;
  value: number;
  color: string;
}

export interface PaymentTrendChartData {
  month: string;
  paid: number;
  pending: number;
  failed: number;
}

export interface DashboardStatsResponse {
  stats: {
    households: number;
    pendingRequests: number;
    upcomingReservations: number;
    unpaidPayments: number;
  };
  recentAnnouncements: Announcement[];
  charts: {
    requestStatus: RequestStatusChartData[];
    paymentTrends: PaymentTrendChartData[];
  };
}

export interface MyStatsResponse {
  pendingRequests: number;
  upcomingReservations: number;
  unpaidPayments: number;
  totalDue: number;
}

// Announcements types
export interface AnnouncementsResponse {
  announcements: Announcement[];
}

export interface AnnouncementResponse {
  announcement: Announcement;
}

export interface CreateAnnouncementInput {
  title: string;
  content: string;
  category?: "event" | "urgent" | "info" | "policy";
  is_pinned?: boolean;
  expires_at?: string;
}

// Events types
export interface EventsResponse {
  events: Event[];
}

export interface EventResponse {
  event: Event;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_date: string;
  location?: string;
}

// Service Requests types
export interface ServiceRequestsResponse {
  requests: ServiceRequest[];
}

// Households types
export interface HouseholdsResponse {
  households: MapHousehold[];
}

export interface MapLocationsResponse {
  households: MapHousehold[];
}

export interface ServiceRequestResponse {
  request: ServiceRequest;
}

export interface CreateServiceRequestInput {
  household_id: string;
  category: "plumbing" | "electrical" | "common-area" | "security" | "other";
  description: string;
  priority?: "low" | "normal" | "high" | "urgent";
}

export interface UpdateServiceRequestInput {
  status?: "pending" | "in-progress" | "completed" | "rejected";
  priority?: "low" | "normal" | "high" | "urgent";
  assigned_to?: string;
}

// Reservations types
export interface ReservationsResponse {
  reservations: Reservation[];
}

export interface ReservationResponse {
  reservation: Reservation;
}

export interface AvailabilityResponse {
  availability: AmenityAvailability[];
}

export interface CreateReservationInput {
  household_id: string;
  amenity_type: AmenityType;
  date: string; // YYYY-MM-DD format
  slot: ReservationSlot;
  purpose?: string;
}

export interface UpdateReservationInput {
  status?: "pending" | "confirmed" | "cancelled";
}

// Payments types
export interface PaymentsResponse {
  payments: Payment[];
}

export interface PaymentResponse {
  payment: Payment;
}

export interface BalanceResponse {
  household_id: string;
  total_due: number;
  periods_due: string[];
}

export interface CreatePaymentInput {
  household_id: string;
  amount: number;
  method: PaymentMethod;
  period: string; // YYYY format for annual dues
  reference_number?: string;
}

// Polls types
export interface PollsResponse {
  polls: Poll[];
}

export interface PollResponse {
  poll: PollWithResults;
}

export interface PollVoteResponse {
  voted: boolean;
  vote?: {
    id: string;
    poll_id: string;
    household_id: string;
    selected_option: string;
    voted_at: string;
  };
}

export interface CreatePollInput {
  question: string;
  options: string[];
  ends_at: string;
}

export interface VoteInput {
  household_id: string;
  selected_option: string;
}

// Documents types
export interface DocumentsResponse {
  documents: Document[];
}

export interface DocumentResponse {
  document: Document;
}

export interface CreateDocumentInput {
  title: string;
  category?: "rules" | "forms" | "minutes" | "policies";
  file: File;
}

// Admin types
export interface AdminUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  phone?: string;
  created_at: string;
  household_count?: number;
  household_addresses?: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
}

export interface AdminUserResponse {
  user: AdminUser;
}

export interface CreateAdminUserInput {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role: "admin" | "resident" | "staff" | "guest";
  phone?: string;
}

export interface UpdateAdminUserInput {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  role?: "admin" | "resident" | "staff" | "guest";
  phone?: string;
}

export interface AdminHousehold {
  id: string;
  address: string;
  street?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_id?: string;
  created_at: string;
  owner_email?: string;
  residents: AdminResident[];
}

export interface AdminResident {
  id: string;
  household_id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  is_primary: boolean;
}

export interface AdminHouseholdsResponse {
  households: AdminHousehold[];
}

export interface AdminHouseholdResponse {
  household: AdminHousehold;
}

export interface CreateAdminHouseholdInput {
  address: string;
  street?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_id?: string;
  residents?: Array<{
    first_name: string;
    last_name: string;
    is_primary?: boolean;
    user_id?: string;
  }>;
}

export interface UpdateAdminHouseholdInput {
  address?: string;
  street?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_id?: string;
}

export interface ImportHouseholdInput {
  address: string;
  street?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_email?: string;
  residents?: Array<{
    first_name: string;
    last_name: string;
    is_primary?: boolean;
  }>;
}

export interface AdminImportInput {
  households: ImportHouseholdInput[];
}

export interface AdminImportResponse {
  results: {
    success: number;
    failed: number;
    errors: string[];
  };
}

export interface AdminStatsResponse {
  stats: {
    users: {
      total: number;
      byRole: Array<{ role: string; count: number }>;
    };
    households: {
      total: number;
      byBlock: Array<{ block: string; count: number }>;
    };
    residents: number;
    serviceRequests: {
      pending: number;
    };
    reservations: {
      upcoming: number;
    };
    payments: {
      unpaid: number;
      unpaidAmount: number;
    };
  };
}

export const api = {
  auth: {
    register: (credentials: RegisterCredentials) =>
      apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    login: (credentials: LoginCredentials) =>
      apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
    getMe: () => apiRequest<{ user: User }>("/auth/me"),
    changePassword: (input: {
      currentPassword?: string;
      newPassword: string;
    }) =>
      apiRequest<{
        message: string;
        wasInitialSetup?: boolean;
      }>("/auth/change-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    getGoogleUrl: () => apiRequest<{ url: string }>("/auth/google/url"),
    // Whitelist management (admin only)
    whitelist: {
      add: (input: { email: string; role: string; household_id?: string }) =>
        apiRequest<{ entry: PreApprovedEmail }>("/auth/whitelist", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      list: () =>
        apiRequest<{ entries: PreApprovedEmail[] }>("/auth/whitelist"),
      remove: (id: string) =>
        apiRequest<{ success: boolean }>(`/auth/whitelist/${id}`, {
          method: "DELETE",
        }),
    },
  },
  dashboard: {
    getStats: () => apiRequest<DashboardStatsResponse>("/dashboard/stats"),
    getMyStats: (householdId: string) =>
      apiRequest<MyStatsResponse>(`/dashboard/my-stats/${householdId}`),
  },
  announcements: {
    list: (limit = 20, offset = 0) =>
      apiRequest<AnnouncementsResponse>(
        `/announcements?limit=${limit}&offset=${offset}`,
      ),
    get: (id: string) =>
      apiRequest<AnnouncementResponse>(`/announcements/${id}`),
    create: (input: CreateAnnouncementInput) =>
      apiRequest<AnnouncementResponse>("/announcements", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreateAnnouncementInput>) =>
      apiRequest<AnnouncementResponse>(`/announcements/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/announcements/${id}`, {
        method: "DELETE",
      }),
  },
  events: {
    list: (upcoming = false) =>
      apiRequest<EventsResponse>(`/events?upcoming=${upcoming}`),
    get: (id: string) => apiRequest<EventResponse>(`/events/${id}`),
    create: (input: CreateEventInput) =>
      apiRequest<EventResponse>("/events", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreateEventInput>) =>
      apiRequest<EventResponse>(`/events/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/events/${id}`, {
        method: "DELETE",
      }),
  },
  serviceRequests: {
    list: (filters?: {
      status?: string;
      priority?: string;
      category?: string;
      household_id?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.priority) params.append("priority", filters.priority);
      if (filters?.category) params.append("category", filters.category);
      if (filters?.household_id)
        params.append("household_id", filters.household_id);
      const query = params.toString();
      return apiRequest<ServiceRequestsResponse>(
        `/service-requests${query ? "?" + query : ""}`,
      );
    },
    get: (id: string) =>
      apiRequest<ServiceRequestResponse>(`/service-requests/${id}`),
    create: (input: CreateServiceRequestInput) =>
      apiRequest<ServiceRequestResponse>("/service-requests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateServiceRequestInput) =>
      apiRequest<ServiceRequestResponse>(`/service-requests/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/service-requests/${id}`, {
        method: "DELETE",
      }),
  },
  households: {
    list: () => apiRequest<HouseholdsResponse>("/households"),
    get: (id: string) =>
      apiRequest<{ household: MapHousehold }>(`/households/${id}`),
    getMapLocations: () =>
      apiRequest<MapLocationsResponse>("/households/map/locations"),
    getMyLots: (): Promise<ApiResponse<MyLotsSummary>> =>
      apiGet<MyLotsSummary>("/households/my-lots"),
    getLots: (): Promise<ApiResponse<{ lots: PublicLot[] }>> =>
      apiGet<{ lots: MyLot[] }>("/households/lots"),
  },
  reservations: {
    list: (filters?: {
      household_id?: string;
      amenity_type?: string;
      date?: string;
      status?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.household_id)
        params.append("household_id", filters.household_id);
      if (filters?.amenity_type)
        params.append("amenity_type", filters.amenity_type);
      if (filters?.date) params.append("date", filters.date);
      if (filters?.status) params.append("status", filters.status);
      const query = params.toString();
      return apiRequest<ReservationsResponse>(
        `/reservations${query ? "?" + query : ""}`,
      );
    },
    getAvailability: (
      startDate: string,
      endDate: string,
      amenityType: string,
    ) =>
      apiRequest<AvailabilityResponse>(
        `/reservations/availability?start_date=${startDate}&end_date=${endDate}&amenity_type=${amenityType}`,
      ),
    getMy: (householdId: string) =>
      apiRequest<ReservationsResponse>(`/reservations/my/${householdId}`),
    get: (id: string) => apiRequest<ReservationResponse>(`/reservations/${id}`),
    create: (input: CreateReservationInput) =>
      apiRequest<ReservationResponse>("/reservations", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateReservationInput) =>
      apiRequest<ReservationResponse>(`/reservations/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/reservations/${id}`, {
        method: "DELETE",
      }),
    // Time blocks management (admin only)
    timeBlocks: {
      list: (filters?: {
        amenity_type?: AmenityType;
        start_date?: string;
        end_date?: string;
      }) => {
        const params = new URLSearchParams();
        if (filters?.amenity_type)
          params.append("amenity_type", filters.amenity_type);
        if (filters?.start_date)
          params.append("start_date", filters.start_date);
        if (filters?.end_date) params.append("end_date", filters.end_date);
        const query = params.toString();
        return apiRequest<TimeBlocksResponse>(
          `/reservations/time-blocks${query ? "?" + query : ""}`,
        );
      },
      get: (id: string) =>
        apiRequest<{ time_block: TimeBlock }>(
          `/reservations/time-blocks/${id}`,
        ),
      create: (input: CreateTimeBlockInput) =>
        apiRequest<{ time_block: TimeBlock }>("/reservations/time-blocks", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (id: string, input: Partial<CreateTimeBlockInput>) =>
        apiRequest<{ time_block: TimeBlock }>(
          `/reservations/time-blocks/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(input),
          },
        ),
      delete: (id: string) =>
        apiRequest<{ success: boolean }>(`/reservations/time-blocks/${id}`, {
          method: "DELETE",
        }),
    },
    // External rentals management (admin only)
    externalRentals: {
      list: (filters?: {
        amenity_type?: AmenityType;
        start_date?: string;
        end_date?: string;
        payment_status?: string;
      }) => {
        const params = new URLSearchParams();
        if (filters?.amenity_type)
          params.append("amenity_type", filters.amenity_type);
        if (filters?.start_date)
          params.append("start_date", filters.start_date);
        if (filters?.end_date) params.append("end_date", filters.end_date);
        if (filters?.payment_status)
          params.append("payment_status", filters.payment_status);
        const query = params.toString();
        return apiRequest<ExternalRentalsResponse>(
          `/reservations/external-rentals${query ? "?" + query : ""}`,
        );
      },
      get: (id: string) =>
        apiRequest<{ rental: ExternalRental }>(
          `/reservations/external-rentals/${id}`,
        ),
      create: (input: CreateExternalRentalInput) =>
        apiRequest<{ rental: ExternalRental }>(
          "/reservations/external-rentals",
          {
            method: "POST",
            body: JSON.stringify(input),
          },
        ),
      update: (
        id: string,
        input: Partial<
          CreateExternalRentalInput & {
            payment_status?: "unpaid" | "partial" | "paid" | "overdue";
            amount_paid?: number;
          }
        >,
      ) =>
        apiRequest<{ rental: ExternalRental }>(
          `/reservations/external-rentals/${id}`,
          {
            method: "PUT",
            body: JSON.stringify(input),
          },
        ),
      recordPayment: (id: string, input: RecordPaymentInput) =>
        apiRequest<{
          rental: ExternalRental;
          payment_id: string;
          amount_paid: number;
        }>(`/reservations/external-rentals/${id}/record-payment`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      delete: (id: string) =>
        apiRequest<{ success: boolean }>(
          `/reservations/external-rentals/${id}`,
          {
            method: "DELETE",
          },
        ),
      export: (filters?: {
        start_date?: string;
        end_date?: string;
        amenity_type?: AmenityType;
      }) => {
        const params = new URLSearchParams();
        if (filters?.start_date)
          params.append("start_date", filters.start_date);
        if (filters?.end_date) params.append("end_date", filters.end_date);
        if (filters?.amenity_type)
          params.append("amenity_type", filters.amenity_type);
        const query = params.toString();
        return `/api/reservations/external-rentals/export${query ? `?${query}` : ""}`;
      },
    },
  },
  payments: {
    list: (filters?: {
      household_id?: string;
      status?: string;
      period?: string;
      method?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.household_id)
        params.append("household_id", filters.household_id);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.period) params.append("period", filters.period);
      if (filters?.method) params.append("method", filters.method);
      const query = params.toString();
      return apiRequest<PaymentsResponse>(
        `/payments${query ? "?" + query : ""}`,
      );
    },
    getBalance: (householdId: string) =>
      apiRequest<BalanceResponse>(`/payments/balance/${householdId}`),
    getMyPayments: (householdId: string) =>
      apiRequest<PaymentsResponse>(`/payments/my/${householdId}`),
    get: (id: string) => apiRequest<PaymentResponse>(`/payments/${id}`),
    create: (input: CreatePaymentInput) =>
      apiRequest<PaymentResponse>("/payments", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateStatus: (id: string, status: "pending" | "completed" | "failed") =>
      apiRequest<PaymentResponse>(`/payments/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      }),
    // Payment verification endpoints
    getMyPendingVerifications: () =>
      apiRequest<{ verifications: PaymentVerificationQueue[] }>(
        "/payments/my-pending/verifications",
      ),
    initiatePayment: (input: {
      payment_type: PaymentCategory;
      amount: number;
      method: PaymentMethod;
      reference_number?: string;
      proof: File;
    }) => {
      const formData = new FormData();
      formData.append("payment_type", input.payment_type);
      formData.append("amount", input.amount.toString());
      formData.append("method", input.method);
      if (input.reference_number) {
        formData.append("reference_number", input.reference_number);
      }
      formData.append("proof", input.proof);
      return apiUpload<InitiatePaymentResponse>("/payments/initiate", formData);
    },
    uploadProof: (paymentId: string, proof: File) => {
      const formData = new FormData();
      formData.append("proof", proof);
      return apiUpload<{ message: string; file_url: string }>(
        `/payments/${paymentId}/proof`,
        formData,
      );
    },
  },
  polls: {
    list: () => apiRequest<PollsResponse>("/polls"),
    get: (id: string) => apiRequest<PollResponse>(`/polls/${id}`),
    getMyVote: (id: string, householdId: string) =>
      apiRequest<PollVoteResponse>(
        `/polls/${id}/my-vote?household_id=${householdId}`,
      ),
    create: (input: CreatePollInput) =>
      apiRequest<PollResponse>("/polls", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    vote: (id: string, input: VoteInput) =>
      apiRequest<{ vote: { id: string } }>(`/polls/${id}/vote`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreatePollInput>) =>
      apiRequest<PollResponse>(`/polls/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/polls/${id}`, {
        method: "DELETE",
      }),
  },
  documents: {
    list: (category?: string) => {
      const query = category ? `?category=${category}` : "";
      return apiRequest<DocumentsResponse>(`/documents${query}`);
    },
    get: (id: string) => apiRequest<DocumentResponse>(`/documents/${id}`),
    create: (input: CreateDocumentInput) => {
      const formData = new FormData();
      formData.append("file", input.file);
      formData.append("title", input.title);
      if (input.category) {
        formData.append("category", input.category);
      }
      return apiUpload<DocumentResponse>("/documents", formData);
    },
    getDownloadUrl: (id: string) => `/api/documents/${id}/download`,
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/documents/${id}`, {
        method: "DELETE",
      }),
  },
  admin: {
    // Users
    listUsers: () => apiRequest<AdminUsersResponse>("/admin/users"),
    searchUsers: (query: string) =>
      apiRequest<{
        users: Array<{
          id: string;
          email: string;
          first_name?: string;
          last_name?: string;
          role: string;
        }>;
      }>(`/admin/users/search?q=${encodeURIComponent(query)}`),
    createUser: (input: CreateAdminUserInput) =>
      apiRequest<AdminUserResponse>("/admin/users", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateUser: (id: string, input: UpdateAdminUserInput) =>
      apiRequest<AdminUserResponse>(`/admin/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    deleteUser: (id: string) =>
      apiRequest<{ success: boolean }>(`/admin/users/${id}`, {
        method: "DELETE",
      }),
    // Households
    listHouseholds: () =>
      apiRequest<AdminHouseholdsResponse>("/admin/households"),
    createHousehold: (input: CreateAdminHouseholdInput) =>
      apiRequest<AdminHouseholdResponse>("/admin/households", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateHousehold: (id: string, input: UpdateAdminHouseholdInput) =>
      apiRequest<AdminHouseholdResponse>(`/admin/households/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    deleteHousehold: (id: string) =>
      apiRequest<{ success: boolean }>(`/admin/households/${id}`, {
        method: "DELETE",
      }),
    // Import
    importHouseholds: (input: AdminImportInput) =>
      apiRequest<AdminImportResponse>("/admin/households/import", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Stats
    getStats: () => apiRequest<AdminStatsResponse>("/admin/stats"),
    // Lot Ownership
    getLotsWithOwnership: (): Promise<
      ApiResponse<{ lots: LotOwnershipList }>
    > => apiGet<{ lots: LotOwnershipList }>("/admin/lots/ownership"),
    assignLotOwner: (
      lotId: string,
      ownerId: string,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/owner`, {
        owner_user_id: ownerId,
      }),
    updateLotStatus: (
      lotId: string,
      status: LotStatus,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/status`, {
        lot_status: status,
      }),
    updateLotType: (
      lotId: string,
      lotType: LotType,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/type`, {
        lot_type: lotType,
      }),
    updateLotStreet: (
      lotId: string,
      street: string,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/street`, {
        street,
      }),
    updateLotSize: (
      lotId: string,
      size: number | null,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/size`, {
        lot_size_sqm: size,
      }),
    updateLotLabel: (
      lotId: string,
      label: string | null,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/label`, {
        lot_label: label,
      }),
    updateLotDescription: (
      lotId: string,
      description: string | null,
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/description`, {
        lot_description: description,
      }),
    updateLotPolygon: (
      lotId: string,
      polygon: number[][],
    ): Promise<ApiResponse<{ success: boolean }>> =>
      apiPut<{ success: boolean }>(`/admin/lots/${lotId}/polygon`, {
        lot_polygon: polygon,
      }),
    getHomeowners: (): Promise<ApiResponse<{ homeowners: User[] }>> =>
      apiGet<{ homeowners: User[] }>("/admin/homeowners"),
    batchAssignOwner: (
      lotIds: string[],
      ownerId: string,
    ): Promise<ApiResponse<{ success: boolean; count: number }>> =>
      apiPut<{ success: boolean; count: number }>("/admin/lots/batch/owner", {
        lot_ids: lotIds,
        owner_user_id: ownerId,
      }),
    // Merge/Unmerge Households
    mergeHouseholds: (
      primary_lot_id: string,
      lot_ids_to_merge: string[],
    ): Promise<
      ApiResponse<{
        household_group_id: string;
        merged_count: number;
        lots: Array<{ lot_id: string; address: string }>;
      }>
    > =>
      apiRequest<{
        household_group_id: string;
        merged_count: number;
        lots: Array<{ lot_id: string; address: string }>;
      }>("/admin/households/merge", {
        method: "POST",
        body: JSON.stringify({ primary_lot_id, lot_ids_to_merge }),
      }),
    unmergeHousehold: (
      lot_id: string,
    ): Promise<ApiResponse<{ success: boolean; lot_id: string }>> =>
      apiRequest<{ success: boolean; lot_id: string }>(
        `/admin/households/unmerge`,
        {
          method: "POST",
          body: JSON.stringify({ lot_id }),
        },
      ),
    // Sync lots from GeoJSON
    syncLots: (): Promise<
      ApiResponse<{
        success: boolean;
        results: {
          inserted: number;
          updated: number;
          errors: number;
          errorDetails: string[];
        };
      }>
    > =>
      apiRequest<{
        success: boolean;
        results: {
          inserted: number;
          updated: number;
          errors: number;
          errorDetails: string[];
        };
      }>("/admin/sync-lots", {
        method: "POST",
      }),
    // Import lot polygons from static GeoJSON to database
    importLotPolygons: (): Promise<
      ApiResponse<{
        success: boolean;
        results: {
          total: number;
          updated: number;
          skipped: number;
          errors: number;
          errorDetails: string[];
        };
      }>
    > =>
      apiRequest<{
        success: boolean;
        results: {
          total: number;
          updated: number;
          skipped: number;
          errors: number;
          errorDetails: string[];
        };
      }>("/admin/lots/import-polygons", {
        method: "POST",
      }),
    // Dues Rates Management
    getDuesRates: (): Promise<ApiResponse<{ dues_rates: DuesRate[] }>> =>
      apiGet<{ dues_rates: DuesRate[] }>("/admin/dues-rates"),
    createDuesRate: (input: {
      rate_per_sqm: number;
      year: number;
      effective_date: string;
    }): Promise<ApiResponse<{ dues_rate: DuesRate }>> =>
      apiRequest<{ dues_rate: DuesRate }>("/admin/dues-rates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    updateDuesRate: (
      id: string,
      input: {
        rate_per_sqm?: number;
        year?: number;
        effective_date?: string;
      },
    ): Promise<ApiResponse<{ dues_rate: DuesRate }>> =>
      apiRequest<{ dues_rate: DuesRate }>(`/admin/dues-rates/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    deleteDuesRate: (id: string): Promise<ApiResponse<{ success: boolean }>> =>
      apiRequest<{ success: boolean }>(`/admin/dues-rates/${id}`, {
        method: "DELETE",
      }),
    getActiveDuesRate: (): Promise<
      ApiResponse<{ active_rate: DuesRate | null }>
    > => apiGet<{ active_rate: DuesRate | null }>("/admin/dues-rates/active"),
    // Payment Demands
    getPaymentDemands: (params?: {
      year?: number;
      status?: string;
    }): Promise<ApiResponse<{ payment_demands: PaymentDemand[] }>> =>
      apiGet<{ payment_demands: PaymentDemand[] }>(
        `/admin/payment-demands${
          params
            ? `?${new URLSearchParams(
                Object.fromEntries(
                  Object.entries({
                    year: params.year?.toString(),
                    status: params.status,
                  }).filter(([_, v]) => v !== undefined) as [string, string][],
                ),
              )}`
            : ""
        }`,
      ),
    createPaymentDemands: (input: {
      year: number;
      demand_sent_date: string;
      due_date: string;
    }): Promise<
      ApiResponse<{
        results: {
          created: number;
          skipped: number;
          total_amount: number;
          errors: string[];
        };
      }>
    > =>
      apiRequest<{
        results: {
          created: number;
          skipped: number;
          total_amount: number;
          errors: string[];
        };
      }>("/admin/payment-demands/create", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Record in-person payment
    recordInPersonPayment: (input: {
      user_id: string;
      amount: number;
      method: "cash" | "in-person";
      period: string;
      check_number?: string;
      lot_ids?: string[];
    }): Promise<ApiResponse<{ payment: Payment; late_fees: number }>> =>
      apiRequest<{ payment: Payment; late_fees: number }>(
        "/admin/payments/in-person",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    // Payment verification endpoints
    getVerificationQueue: (params?: {
      status?: "pending" | "approved" | "rejected";
      limit?: number;
      offset?: number;
    }) => {
      const query = new URLSearchParams();
      if (params?.status) query.append("status", params.status);
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.offset) query.append("offset", params.offset.toString());
      const queryString = query.toString();
      return apiRequest<{
        verifications: PaymentVerificationQueue[];
        total: number;
        limit: number;
        offset: number;
      }>(`/admin/payments/verify${queryString ? "?" + queryString : ""}`);
    },
    verifyPayment: (
      paymentId: string,
      input: { action: "approve" | "reject"; rejection_reason?: string },
    ) =>
      apiRequest<{ message: string }>(`/admin/payments/${paymentId}/verify`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    getPaymentSettings: () =>
      apiRequest<PaymentSettings>("/admin/payments/settings"),
    updatePaymentSettings: (input: PaymentSettings) =>
      apiRequest<{ message: string; settings: PaymentSettings }>(
        "/admin/payments/settings",
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    // System settings
    getSystemSettings: () =>
      apiRequest<{ settings: Record<string, string> }>("/admin/settings"),
    updateSystemSetting: (key: string, value: string) =>
      apiRequest<{ message: string; setting: any }>(`/admin/settings/${key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      }),
    // Export payments with filters
    exportPayments: (filters?: {
      start_date?: string;
      end_date?: string;
      payment_type?: string;
      status?: string;
      method?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.start_date) params.append("start_date", filters.start_date);
      if (filters?.end_date) params.append("end_date", filters.end_date);
      if (filters?.payment_type)
        params.append("payment_type", filters.payment_type);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.method) params.append("method", filters.method);
      const queryString = params.toString();
      return apiRequest<{ payments: Payment[] }>(
        `/admin/payments/export${queryString ? `?${queryString}` : ""}`,
      );
    },
    // Record in-person vote
    recordInPersonVote: (
      pollId: string,
      input: {
        household_id: string;
        selected_option: string;
        voted_at?: string;
        witness?: string;
      },
    ): Promise<ApiResponse<{ vote: { id: string } }>> =>
      apiRequest<{ vote: { id: string } }>(
        `/admin/polls/${pollId}/record-vote`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    // Get list of users for admin dropdowns - already defined above in admin object
    // Pass Management
    passManagement: {
      // Pass Types (new for unified system)
      passTypes: {
        list: () =>
          apiRequest<{ pass_types: PassTypeRecord[] }>(
            "/admin/pass-management/pass-types",
          ),
      },
      // Stats
      getStats: () =>
        apiRequest<{ stats: PassStats }>("/admin/pass-management/stats"),
      // Employee Management
      employees: {
        list: (filters?: {
          status?: EmployeeStatus;
          household_id?: string;
        }) => {
          const params = new URLSearchParams();
          if (filters?.status) params.append("status", filters.status);
          if (filters?.household_id)
            params.append("household_id", filters.household_id);
          const query = params.toString();
          return apiRequest<EmployeesResponse>(
            `/admin/pass-management/employees${query ? "?" + query : ""}`,
          );
        },
        get: (id: string) =>
          apiRequest<EmployeeResponse>(
            `/admin/pass-management/employees/${id}`,
          ),
        updateStatus: (id: string, input: UpdateEmployeeStatusInput) =>
          apiRequest<EmployeeResponse>(
            `/admin/pass-management/employees/${id}/status`,
            {
              method: "PUT",
              body: JSON.stringify(input),
            },
          ),
        recordPayment: (
          id: string,
          input: {
            amount: number;
            method: PaymentMethod;
            reference_number?: string;
          },
        ) =>
          apiRequest<{
            employee: HouseholdEmployee;
            payment_id: string;
            amount_paid: number;
          }>(`/admin/pass-management/employees/${id}/record-payment`, {
            method: "POST",
            body: JSON.stringify(input),
          }),
        delete: (id: string) =>
          apiRequest<{ success: boolean }>(
            `/admin/pass-management/employees/${id}`,
            {
              method: "DELETE",
            },
          ),
        create: (input: CreateEmployeeInput) =>
          apiRequest<EmployeeResponse>("/admin/pass-management/employees", {
            method: "POST",
            body: JSON.stringify(input),
          }),
      },
      // Vehicle Management
      vehicles: {
        list: (filters?: {
          status?: VehicleStatus;
          payment_status?: VehiclePaymentStatus;
          household_id?: string;
        }) => {
          const params = new URLSearchParams();
          if (filters?.status) params.append("status", filters.status);
          if (filters?.payment_status)
            params.append("payment_status", filters.payment_status);
          if (filters?.household_id)
            params.append("household_id", filters.household_id);
          const query = params.toString();
          return apiRequest<VehiclesResponse>(
            `/admin/pass-management/vehicles${query ? "?" + query : ""}`,
          );
        },
        get: (id: string) =>
          apiRequest<VehicleResponse>(`/admin/pass-management/vehicles/${id}`),
        assignRFID: (id: string, input: AssignRFIDInput) =>
          apiRequest<VehicleResponse>(
            `/admin/pass-management/vehicles/${id}/assign-rfid`,
            {
              method: "PUT",
              body: JSON.stringify(input),
            },
          ),
        assignSticker: (id: string, input: AssignStickerInput) =>
          apiRequest<VehicleResponse>(
            `/admin/pass-management/vehicles/${id}/assign-sticker`,
            {
              method: "PUT",
              body: JSON.stringify(input),
            },
          ),
        recordPayment: (
          id: string,
          input: {
            amount: number;
            method: PaymentMethod;
            reference_number?: string;
            pass_type?: PassType;
          },
        ) =>
          apiRequest<{
            vehicle: VehicleRegistration;
            payment_id: string;
            amount_paid: number;
          }>(`/admin/pass-management/vehicles/${id}/record-payment`, {
            method: "POST",
            body: JSON.stringify(input),
          }),
        updateStatus: (id: string, input: UpdateVehicleStatusInput) =>
          apiRequest<VehicleResponse>(
            `/admin/pass-management/vehicles/${id}/status`,
            {
              method: "PUT",
              body: JSON.stringify(input),
            },
          ),
        delete: (id: string) =>
          apiRequest<{ success: boolean }>(
            `/admin/pass-management/vehicles/${id}`,
            {
              method: "DELETE",
            },
          ),
        create: (input: CreateVehicleInput) =>
          apiRequest<VehicleResponse>("/admin/pass-management/vehicles", {
            method: "POST",
            body: JSON.stringify(input),
          }),
        replaceRfid: (id: string, input: { notes?: string }) =>
          apiRequest<{
            vehicle: VehicleRegistration;
            new_rfid_pass: {
              id: string;
              identifier: string;
              amount_due: number;
              payment_status: string;
            };
          }>(`/admin/pass-management/vehicles/${id}/replace-rfid`, {
            method: "POST",
            body: JSON.stringify(input),
          }),
      },
      // Pass Fee Management
      fees: {
        list: () => apiRequest<PassFeesResponse>("/admin/pass-management/fees"),
        update: (input: {
          sticker_fee?: number;
          rfid_fee?: number;
          employee_fee?: number;
        }) =>
          apiRequest<PassFeesUpdateResponse>("/admin/pass-management/fees", {
            method: "PUT",
            body: JSON.stringify(input),
          }),
      },
      // RFID Replacement Requests Management
      rfidReplacementRequests: {
        list: (params?: { status?: string }) => {
          const query = params?.status ? `?status=${params.status}` : "";
          return apiRequest<{ requests: any[] }>(
            `/admin/pass-management/rfid-replacement-requests${query}`,
          );
        },
        approve: (id: string, input: { admin_notes?: string }) =>
          apiRequest<{
            success: boolean;
            new_rfid_pass: {
              id: string;
              identifier: string;
              amount_due: number;
              payment_status: string;
            };
          }>(`/admin/pass-management/rfid-replacement-requests/${id}/approve`, {
            method: "PUT",
            body: JSON.stringify(input),
          }),
        reject: (id: string, input: { reason: string }) =>
          apiRequest<{ success: boolean }>(
            `/admin/pass-management/rfid-replacement-requests/${id}/reject`,
            {
              method: "PUT",
              body: JSON.stringify(input),
            },
          ),
      },
    },
  },
  notifications: {
    list: (params?: {
      limit?: number;
      offset?: number;
      type?: string;
      read?: boolean;
    }) => {
      const query = new URLSearchParams();
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.offset) query.append("offset", params.offset.toString());
      if (params?.type) query.append("type", params.type);
      if (params?.read !== undefined)
        query.append("read", params.read.toString());
      const queryString = query.toString();
      return apiRequest<NotificationsResponse>(
        `/notifications${queryString ? "?" + queryString : ""}`,
      );
    },
    get: (id: string) =>
      apiRequest<NotificationResponse>(`/notifications/${id}`),
    create: (input: {
      user_id: string;
      type: string;
      title: string;
      content: string;
      link?: string;
    }) =>
      apiRequest<NotificationResponse>("/notifications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    markAsRead: (id: string) =>
      apiRequest<NotificationResponse>(`/notifications/${id}/read`, {
        method: "PUT",
      }),
    markAllAsRead: () =>
      apiRequest<{ success: boolean }>("/notifications/read-all", {
        method: "PUT",
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/notifications/${id}`, {
        method: "DELETE",
      }),
    // Admin bulk send
    sendBulk: (input: {
      target: "all" | "delinquent" | "specific";
      user_ids?: string[];
      type: string;
      title: string;
      content: string;
      link?: string;
      send_now?: boolean;
    }) =>
      apiRequest<BulkNotificationResponse>("/notifications/admin/send", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Admin get all notifications
    getAll: (params?: { limit?: number; offset?: number }) => {
      const query = new URLSearchParams();
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.offset) query.append("offset", params.offset.toString());
      const queryString = query.toString();
      return apiRequest<AdminNotificationsResponse>(
        `/notifications/admin/all${queryString ? "?" + queryString : ""}`,
      );
    },
  },
  passRequests: {
    // Employee Pass Requests (for residents)
    employees: {
      list: () => apiRequest<EmployeesResponse>(`/pass-requests/employees`),
      get: (id: string) =>
        apiRequest<EmployeeResponse>(`/pass-requests/employees/${id}`),
      create: (input: CreateEmployeeInput) => {
        const formData = new FormData();
        formData.append("household_id", input.household_id);
        formData.append("full_name", input.full_name);
        formData.append("employee_type", input.employee_type);
        if (input.photo) {
          formData.append("photo", input.photo);
        }
        if (input.expiry_date) {
          formData.append("expiry_date", input.expiry_date);
        }
        return apiUpload<EmployeeResponse>(
          "/pass-requests/employees",
          formData,
        );
      },
      update: (id: string, input: UpdateEmployeeInput) =>
        apiRequest<EmployeeResponse>(`/pass-requests/employees/${id}`, {
          method: "PUT",
          body: JSON.stringify(input),
        }),
      delete: (id: string) =>
        apiRequest<{ success: boolean }>(`/pass-requests/employees/${id}`, {
          method: "DELETE",
        }),
    },
    // Vehicle Pass Requests (for residents)
    vehicles: {
      list: () => apiRequest<VehiclesResponse>(`/pass-requests/vehicles`),
      get: (id: string) =>
        apiRequest<VehicleResponse>(`/pass-requests/vehicles/${id}`),
      create: (input: CreateVehicleInput) =>
        apiRequest<VehicleResponse>("/pass-requests/vehicles", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (id: string, input: UpdateVehicleInput) =>
        apiRequest<VehicleResponse>(`/pass-requests/vehicles/${id}`, {
          method: "PUT",
          body: JSON.stringify(input),
        }),
      delete: (id: string) =>
        apiRequest<{ success: boolean }>(`/pass-requests/vehicles/${id}`, {
          method: "DELETE",
        }),
      requestRfidReplacement: (id: string, input: { reason: string }) =>
        apiRequest<{
          success: boolean;
          request: { id: string; status: string };
        }>(`/pass-requests/vehicles/${id}/request-rfid-replacement`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      requestStickerRenewal: (id: string) =>
        apiRequest<{
          success: boolean;
          new_pass: {
            id: string;
            identifier: string;
            amount_due: number;
            expiry_year: number;
          };
        }>(`/pass-requests/vehicles/${id}/request-sticker-renewal`, {
          method: "POST",
        }),
    },
    // Get current pass fees
    getFees: () => apiRequest<PassFeesResponse>("/pass-requests/fees"),
    rfidReplacementRequests: {
      list: () =>
        apiRequest<{ requests: any[] }>(
          "/pass-requests/rfid-replacement-requests",
        ),
    },
  },
  lotMembers: {
    getMyMemberships: () =>
      apiGet<{
        lots: Array<{
          household_id: string;
          block: string;
          lot: string;
          address: string;
          lot_type: string;
          verified: boolean;
        }>;
        voteCount: number;
        totalVotes: number;
      }>("/lot-members/my"),
    getHouseholdMembers: (id: string) =>
      apiGet<{
        householdId: string;
        members: Array<{
          id: string;
          user_id: string;
          first_name: string;
          last_name: string;
          email: string;
          member_type: string;
          can_vote: boolean;
          verified: boolean;
        }>;
      }>(`/lot-members/household/${id}`),
    assignMember: (input: {
      household_id: string;
      user_id?: string;
      email?: string;
      member_type: "primary_owner" | "secondary";
      notes?: string;
    }) =>
      apiRequest<{
        id: string;
        household_id: string;
        user_id: string;
        member_type: string;
        can_vote: boolean;
        verified: boolean;
      }>("/admin/lot-members", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    verifyMember: (id: string, notes?: string) =>
      apiRequest<{
        id: string;
        verified: boolean;
        can_vote: boolean;
        verified_at: string;
      }>(`/admin/lot-members/${id}/verify`, {
        method: "PUT",
        body: JSON.stringify({ notes: notes || "" }),
      }),
    removeMember: (id: string) =>
      apiRequest<{ success: boolean }>(`/admin/lot-members/${id}`, {
        method: "DELETE",
      }),
    getUnassignedLots: () =>
      apiGet<{
        lots: Array<{
          id: string;
          block: string;
          lot: string;
          address: string;
          lot_type: string;
          lot_status: string;
        }>;
      }>("/admin/lot-members/lots/unassigned"),
    getPendingMembers: () =>
      apiGet<{
        members: Array<{
          id: string;
          household_id: string;
          user_id: string;
          member_type: string;
          can_vote: boolean;
          verified: boolean;
          notes: string | null;
          created_at: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          role: string;
          block: string;
          lot: string;
          address: string;
        }>;
      }>("/admin/lot-members/pending"),
  },
  messages: {
    // Get all threads for current user
    getThreads: (limit = 20, offset = 0) =>
      apiRequest<ThreadsResponse>(
        `/messages/threads?limit=${limit}&offset=${offset}`,
      ),
    // Get single thread with messages
    getThread: (id: string) =>
      apiRequest<ThreadResponse>(`/messages/threads/${id}`),
    // Create new thread with first message
    createThread: (input: CreateThreadInput) =>
      apiRequest<CreateThreadResponse>("/messages/threads", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Send message to existing thread
    sendMessage: (threadId: string, input: SendMessageInput) =>
      apiRequest<MessageResponse>(`/messages/threads/${threadId}/messages`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    // Update thread (subject)
    updateThread: (id: string, input: UpdateThreadInput) =>
      apiRequest<ThreadResponse>(`/messages/threads/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    // Add participant to thread
    addParticipant: (threadId: string, userId: string) =>
      apiRequest<{ success: boolean }>(
        `/messages/threads/${threadId}/participants`,
        {
          method: "POST",
          body: JSON.stringify({ user_id: userId }),
        },
      ),
    // Remove participant from thread (or leave)
    removeParticipant: (threadId: string, userId: string) =>
      apiRequest<{ success: boolean }>(
        `/messages/threads/${threadId}/participants/${userId}`,
        {
          method: "DELETE",
        },
      ),
  },

  // Delinquency management
  delinquency: {
    // Admin: List all delinquents
    getDelinquents: async (params?: {
      type?: "all" | "automatic" | "manual";
      year?: number;
      search?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.type && params.type !== "all")
        queryParams.append("type", params.type);
      if (params?.year) queryParams.append("year", params.year.toString());
      if (params?.search) queryParams.append("search", params.search);

      return apiRequest<{
        delinquents: DelinquentMember[];
        summary: DelinquencySummary;
      }>(
        `/admin/delinquency/members${queryParams.toString() ? "?" + queryParams.toString() : ""}`,
      );
    },

    // Admin: Mark member as delinquent
    markDelinquent: async (data: MarkDelinquentRequest) => {
      return apiRequest<{ delinquency: ManualDelinquency }>(
        "/admin/delinquency/mark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
    },

    // Admin: Waive delinquency
    waiveDelinquency: async (id: string, data: WaiveDelinquencyRequest) => {
      return apiRequest<{ success: boolean }>(
        `/admin/delinquency/waive/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
    },

    // Admin: Generate payment demands
    generateDemands: async (data: DemandGenerationRequest) => {
      return apiRequest<DemandGenerationResponse>(
        "/admin/delinquency/demands",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
    },

    // Get current user's delinquency status
    getMyStatus: async () => {
      return apiRequest<DelinquencyStatus>("/my-lots/delinquency-status");
    },
  },
};
