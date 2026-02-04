import type {
  AuthResponse,
  User,
  Announcement,
  Event,
  ServiceRequest,
  MapHousehold,
  Reservation,
  AmenityAvailability,
  Payment,
  Poll,
  PollWithResults,
  Document,
} from '@/types';

const API_BASE = '/api';

interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('hoa_token');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Check if response has content before parsing JSON
  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');

  if (!hasJsonContent || response.status === 204) {
    if (!response.ok) {
      return { error: response.statusText || 'Request failed' };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  const text = await response.text();
  if (!text.trim()) {
    if (!response.ok) {
      return { error: response.statusText || 'Request failed' };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      return { error: data.error || 'Request failed' };
    }
    return { data };
  } catch (e) {
    console.error('JSON parse error:', e, 'Response text:', text);
    return { error: 'Invalid response from server' };
  }
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('hoa_token');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: formData,
  });

  const contentType = response.headers.get('content-type');
  const hasJsonContent = contentType?.includes('application/json');

  if (!hasJsonContent || response.status === 204) {
    if (!response.ok) {
      return { error: response.statusText || 'Upload failed' };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  const text = await response.text();
  if (!text.trim()) {
    if (!response.ok) {
      return { error: response.statusText || 'Upload failed' };
    }
    return { data: undefined } as ApiResponse<T>;
  }

  try {
    const data = JSON.parse(text);
    if (!response.ok) {
      return { error: data.error || 'Upload failed' };
    }
    return { data };
  } catch (e) {
    console.error('JSON parse error:', e, 'Response text:', text);
    return { error: 'Invalid response from server' };
  }
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials extends LoginCredentials {
  role: string;
}

// Dashboard types
export interface DashboardStatsResponse {
  stats: {
    households: number;
    pendingRequests: number;
    upcomingReservations: number;
    unpaidPayments: number;
  };
  recentAnnouncements: Announcement[];
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
  category?: 'event' | 'urgent' | 'info' | 'policy';
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
  category: 'plumbing' | 'electrical' | 'common-area' | 'security' | 'other';
  description: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface UpdateServiceRequestInput {
  status?: 'pending' | 'in-progress' | 'completed' | 'rejected';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
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
  amenity_type: 'clubhouse' | 'pool' | 'basketball-court';
  date: string; // YYYY-MM-DD format
  slot: 'AM' | 'PM';
  purpose?: string;
}

export interface UpdateReservationInput {
  status?: 'pending' | 'confirmed' | 'cancelled';
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
  method: 'gcash' | 'paymaya' | 'instapay' | 'cash';
  period: string; // YYYY-MM format
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
  category?: 'rules' | 'forms' | 'minutes' | 'policies';
  file: File;
}

// Admin types
export interface AdminUser {
  id: string;
  email: string;
  role: string;
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
  role: 'admin' | 'resident' | 'staff' | 'guest';
  phone?: string;
}

export interface UpdateAdminUserInput {
  email?: string;
  password?: string;
  role?: 'admin' | 'resident' | 'staff' | 'guest';
  phone?: string;
}

export interface AdminHousehold {
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
      apiRequest<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    login: (credentials: LoginCredentials) =>
      apiRequest<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    getMe: () => apiRequest<{ user: User }>('/api/auth/me'),
  },
  dashboard: {
    getStats: () => apiRequest<DashboardStatsResponse>('/api/dashboard/stats'),
    getMyStats: (householdId: string) =>
      apiRequest<MyStatsResponse>(`/api/dashboard/my-stats/${householdId}`),
  },
  announcements: {
    list: (limit = 20, offset = 0) =>
      apiRequest<AnnouncementsResponse>(`/api/announcements?limit=${limit}&offset=${offset}`),
    get: (id: string) => apiRequest<AnnouncementResponse>(`/api/announcements/${id}`),
    create: (input: CreateAnnouncementInput) =>
      apiRequest<AnnouncementResponse>('/api/announcements', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreateAnnouncementInput>) =>
      apiRequest<AnnouncementResponse>(`/api/announcements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/announcements/${id}`, {
        method: 'DELETE',
      }),
  },
  events: {
    list: (upcoming = false) =>
      apiRequest<EventsResponse>(`/api/events?upcoming=${upcoming}`),
    get: (id: string) => apiRequest<EventResponse>(`/api/events/${id}`),
    create: (input: CreateEventInput) =>
      apiRequest<EventResponse>('/api/events', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreateEventInput>) =>
      apiRequest<EventResponse>(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/events/${id}`, {
        method: 'DELETE',
      }),
  },
  serviceRequests: {
    list: (filters?: { status?: string; priority?: string; category?: string; household_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.household_id) params.append('household_id', filters.household_id);
      const query = params.toString();
      return apiRequest<ServiceRequestsResponse>(`/api/service-requests${query ? '?' + query : ''}`);
    },
    get: (id: string) => apiRequest<ServiceRequestResponse>(`/api/service-requests/${id}`),
    create: (input: CreateServiceRequestInput) =>
      apiRequest<ServiceRequestResponse>('/api/service-requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateServiceRequestInput) =>
      apiRequest<ServiceRequestResponse>(`/api/service-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/service-requests/${id}`, {
        method: 'DELETE',
      }),
  },
  households: {
    list: () => apiRequest<HouseholdsResponse>('/api/households'),
    get: (id: string) => apiRequest<{ household: MapHousehold }>(`/api/households/${id}`),
    getMapLocations: () => apiRequest<MapLocationsResponse>('/api/households/map/locations'),
  },
  reservations: {
    list: (filters?: { household_id?: string; amenity_type?: string; date?: string; status?: string }) => {
      const params = new URLSearchParams();
      if (filters?.household_id) params.append('household_id', filters.household_id);
      if (filters?.amenity_type) params.append('amenity_type', filters.amenity_type);
      if (filters?.date) params.append('date', filters.date);
      if (filters?.status) params.append('status', filters.status);
      const query = params.toString();
      return apiRequest<ReservationsResponse>(`/api/reservations${query ? '?' + query : ''}`);
    },
    getAvailability: (startDate: string, endDate: string, amenityType: string) =>
      apiRequest<AvailabilityResponse>(
        `/api/reservations/availability?start_date=${startDate}&end_date=${endDate}&amenity_type=${amenityType}`
      ),
    getMy: (householdId: string) =>
      apiRequest<ReservationsResponse>(`/api/reservations/my/${householdId}`),
    get: (id: string) => apiRequest<ReservationResponse>(`/api/reservations/${id}`),
    create: (input: CreateReservationInput) =>
      apiRequest<ReservationResponse>('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: UpdateReservationInput) =>
      apiRequest<ReservationResponse>(`/api/reservations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/reservations/${id}`, {
        method: 'DELETE',
      }),
  },
  payments: {
    list: (filters?: { household_id?: string; status?: string; period?: string }) => {
      const params = new URLSearchParams();
      if (filters?.household_id) params.append('household_id', filters.household_id);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.period) params.append('period', filters.period);
      const query = params.toString();
      return apiRequest<PaymentsResponse>(`/api/payments${query ? '?' + query : ''}`);
    },
    getBalance: (householdId: string) =>
      apiRequest<BalanceResponse>(`/api/payments/balance/${householdId}`),
    getMyPayments: (householdId: string) =>
      apiRequest<PaymentsResponse>(`/api/payments/my/${householdId}`),
    get: (id: string) => apiRequest<PaymentResponse>(`/api/payments/${id}`),
    create: (input: CreatePaymentInput) =>
      apiRequest<PaymentResponse>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateStatus: (id: string, status: 'pending' | 'completed' | 'failed') =>
      apiRequest<PaymentResponse>(`/api/payments/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),
  },
  polls: {
    list: () => apiRequest<PollsResponse>('/api/polls'),
    get: (id: string) => apiRequest<PollResponse>(`/api/polls/${id}`),
    getMyVote: (id: string, householdId: string) =>
      apiRequest<PollVoteResponse>(`/api/polls/${id}/my-vote?household_id=${householdId}`),
    create: (input: CreatePollInput) =>
      apiRequest<PollResponse>('/api/polls', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    vote: (id: string, input: VoteInput) =>
      apiRequest<{ vote: { id: string } }>(`/api/polls/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    update: (id: string, input: Partial<CreatePollInput>) =>
      apiRequest<PollResponse>(`/api/polls/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/polls/${id}`, {
        method: 'DELETE',
      }),
  },
  documents: {
    list: (category?: string) => {
      const query = category ? `?category=${category}` : '';
      return apiRequest<DocumentsResponse>(`/api/documents${query}`);
    },
    get: (id: string) => apiRequest<DocumentResponse>(`/api/documents/${id}`),
    create: (input: CreateDocumentInput) => {
      const formData = new FormData();
      formData.append('file', input.file);
      formData.append('title', input.title);
      if (input.category) {
        formData.append('category', input.category);
      }
      return apiUpload<DocumentResponse>('/api/documents', formData);
    },
    getDownloadUrl: (id: string) => `/api/documents/${id}/download`,
    delete: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/documents/${id}`, {
        method: 'DELETE',
      }),
  },
  admin: {
    // Users
    listUsers: () => apiRequest<AdminUsersResponse>('/api/admin/users'),
    createUser: (input: CreateAdminUserInput) =>
      apiRequest<AdminUserResponse>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateUser: (id: string, input: UpdateAdminUserInput) =>
      apiRequest<AdminUserResponse>(`/api/admin/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteUser: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/admin/users/${id}`, {
        method: 'DELETE',
      }),
    // Households
    listHouseholds: () => apiRequest<AdminHouseholdsResponse>('/api/admin/households'),
    createHousehold: (input: CreateAdminHouseholdInput) =>
      apiRequest<AdminHouseholdResponse>('/api/admin/households', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateHousehold: (id: string, input: UpdateAdminHouseholdInput) =>
      apiRequest<AdminHouseholdResponse>(`/api/admin/households/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    deleteHousehold: (id: string) =>
      apiRequest<{ success: boolean }>(`/api/admin/households/${id}`, {
        method: 'DELETE',
      }),
    // Import
    importHouseholds: (input: AdminImportInput) =>
      apiRequest<AdminImportResponse>('/api/admin/households/import', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    // Stats
    getStats: () => apiRequest<AdminStatsResponse>('/api/admin/stats'),
  },
};
