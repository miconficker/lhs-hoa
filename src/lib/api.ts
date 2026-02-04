import type {
  AuthResponse,
  User,
  Announcement,
  Event,
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
};
