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

  const data = await response.json();

  if (!response.ok) {
    return { error: data.error || 'Request failed' };
  }

  return { data };
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
};
