import type { AuthResponse, User } from '@/types';

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
};
