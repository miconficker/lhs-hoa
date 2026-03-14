/**
 * Admin Booking Helper Functions
 *
 * Provides helper functions for validating and processing admin booking requests.
 * These functions support the admin booking creation workflow where admins can
 * create bookings on behalf of residents or guests, with optional price overrides
 * and payment recording.
 */

import type {
  AdminBookingRequest,
  UnifiedBookingStatus,
  BookingPaymentStatus,
} from '../../types';

// Validation result type
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate admin booking request data.
 *
 * @param data - The admin booking request to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateAdminBookingRequest(data: any): ValidationResult {
  // Validate user_type
  const validUserTypes = ['resident', 'guest', 'new_resident', 'new_guest'];
  if (!data.user_type || !validUserTypes.includes(data.user_type)) {
    return {
      valid: false,
      error: `user_type must be one of: ${validUserTypes.join(', ')}`,
    };
  }

  // Validate resident fields
  if (data.user_type === 'resident') {
    if (!data.user_id) {
      return {
        valid: false,
        error: 'user_id is required for resident bookings',
      };
    }
  }

  // Validate guest fields
  if (data.user_type === 'guest') {
    if (!data.customer_id) {
      return {
        valid: false,
        error: 'customer_id is required for guest bookings',
      };
    }
  }

  // Validate new resident fields
  if (data.user_type === 'new_resident') {
    if (!data.new_customer) {
      return {
        valid: false,
        error: 'new_customer object is required for new residents',
      };
    }
    const { first_name, last_name, email } = data.new_customer;
    if (!first_name || !last_name || !email) {
      return {
        valid: false,
        error: 'new_customer must include first_name, last_name, and email',
      };
    }
  }

  // Validate new guest fields
  if (data.user_type === 'new_guest') {
    if (!data.new_customer) {
      return {
        valid: false,
        error: 'new_customer object is required for new guests',
      };
    }
    const { first_name, last_name, email } = data.new_customer;
    if (!first_name || !last_name || !email) {
      return {
        valid: false,
        error: 'new_customer must include first_name, last_name, and email',
      };
    }
  }

  // Validate booking details
  if (!data.amenity_type) {
    return {
      valid: false,
      error: 'amenity_type is required',
    };
  }

  if (!data.date) {
    return {
      valid: false,
      error: 'date is required',
    };
  }

  if (!data.slot) {
    return {
      valid: false,
      error: 'slot is required',
    };
  }

  // Validate override_price if provided
  if (data.override_price !== undefined && data.override_price !== null) {
    if (typeof data.override_price !== 'number' || data.override_price < 0) {
      return {
        valid: false,
        error: 'override_price must be a non-negative number',
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// Status Determination Functions
// =============================================================================

/**
 * Determine the initial booking status based on request parameters.
 *
 * Rules:
 * - If skip_approval = true AND record_payment with full payment → 'confirmed'
 * - If skip_approval = true AND partial payment → 'payment_due'
 * - If skip_approval = true (no payment) → 'confirmed'
 * - Otherwise → 'submitted'
 *
 * @param request - The admin booking request
 * @returns The initial unified booking status
 */
export function determineInitialStatus(request: AdminBookingRequest): UnifiedBookingStatus {
  if (request.skip_approval) {
    if (request.record_payment && request.payment_amount && request.override_price !== undefined) {
      return request.payment_amount >= request.override_price ? 'confirmed' : 'payment_due';
    }
    return 'confirmed';
  }

  // Default: requires approval
  return 'submitted';
}

/**
 * Determine the payment status based on request parameters and amount.
 *
 * Rules:
 * - If record_payment and payment_amount >= amount → 'paid'
 * - If record_payment and payment_amount < amount → 'partial'
 * - Otherwise → 'unpaid'
 *
 * @param request - The admin booking request
 * @param amount - The total booking amount
 * @returns The booking payment status
 */
export function determinePaymentStatus(
  request: AdminBookingRequest,
  amount: number
): BookingPaymentStatus {
  if (request.record_payment && request.payment_amount !== undefined) {
    if (request.payment_amount >= amount) {
      return 'paid';
    }
    return 'partial';
  }

  return 'unpaid';
}

// =============================================================================
// Notes Generation Functions
// =============================================================================

/**
 * Generate admin notes by combining base notes with price override and internal notes.
 *
 * @param request - The admin booking request
 * @param baseNotes - Optional base notes to prepend
 * @returns Combined notes string, or undefined if empty
 */
export function generateAdminNotes(
  request: AdminBookingRequest,
  baseNotes?: string
): string | undefined {
  const parts: string[] = [];

  // Add base notes if provided
  if (baseNotes?.trim()) {
    parts.push(baseNotes.trim());
  }

  // Add price override note if applicable
  if (request.override_price !== undefined && request.override_price !== null) {
    parts.push(`Price override: ${request.override_price}`);
  }

  // Add internal admin notes if provided
  if (request.admin_notes_internal?.trim()) {
    parts.push(request.admin_notes_internal.trim());
  }

  // Return undefined if no notes
  if (parts.length === 0) {
    return undefined;
  }

  // Join with newlines
  return parts.join('\n');
}

// =============================================================================
// Customer Creation Functions
// =============================================================================

/**
 * Create a new customer (guest only).
 *
 * For new guests: Creates a customer record in the customers table.
 * For new residents: Returns an error (not implemented - requires user management).
 *
 * @param db - D1Database instance
 * @param request - The admin booking request
 * @param createdBy - The user ID of the admin creating the customer
 * @returns Object with customerId, userId?, householdId?, or error?
 */
export async function createNewCustomer(
  db: D1Database,
  request: AdminBookingRequest,
  createdBy: string
): Promise<{ customerId?: string; userId?: string; householdId?: string; error?: string }> {
  const { new_customer } = request;
  if (!new_customer) {
    return { error: 'No new customer data provided' };
  }

  try {
    if (request.user_type === 'new_guest') {
      // Create external guest customer
      const customerId = crypto.randomUUID();
      const now = new Date().toISOString();

      await db.prepare(
        `INSERT INTO customers (
          id,
          first_name,
          last_name,
          email,
          phone,
          guest_notes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        customerId,
        new_customer.first_name,
        new_customer.last_name,
        new_customer.email,
        new_customer.phone || null,
        new_customer.resident_notes || null, // Store resident_notes as guest_notes
        now,
        now
      ).run();

      return { customerId };
    } else if (request.user_type === 'new_resident') {
      // Create new resident (requires creating user and household)
      // This is more complex - for now, require admin to create via user management
      return { error: 'Please create new residents via User Management first' };
    }
  } catch (error: any) {
    return { error: `Failed to create customer: ${error.message}` };
  }

  return { error: `Invalid user_type for customer creation: ${request.user_type}` };
}
