// Shared types for Cloudflare Workers backend
// In production, consider a shared package or monorepo

export type UserRole = 'admin' | 'resident' | 'staff' | 'guest';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  phone?: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
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

export interface ServiceRequest {
  id: string;
  household_id: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface Reservation {
  id: string;
  household_id: string;
  amenity_type: string;
  date: string;
  slot: string;
  status: string;
  purpose?: string;
  created_at: string;
}

export interface Payment {
  id: string;
  household_id: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  reference_number?: string;
  period: string;
  created_at: string;
  paid_at?: string;
}
