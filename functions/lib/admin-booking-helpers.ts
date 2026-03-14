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
    const { first_name, last_name, email, household_address } = data.new_customer;
    if (!first_name || !last_name || !email) {
      return {
        valid: false,
        error: 'new_customer must include first_name, last_name, and email',
      };
    }
    if (!household_address) {
      return {
        valid: false,
        error: 'new_customer.household_address is required for new residents',
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

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(data.date)) {
    return {
      valid: false,
      error: 'date must be in YYYY-MM-DD format',
    };
  }

  if (!data.slot) {
    return {
      valid: false,
      error: 'slot is required',
    };
  }

  // Validate slot value
  const validSlots = ['AM', 'PM', 'FULL_DAY'];
  if (!validSlots.includes(data.slot)) {
    return {
      valid: false,
      error: `slot must be one of: ${validSlots.join(', ')}`,
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

  // Validate payment_amount if record_payment is true
  if (data.record_payment && data.payment_amount !== undefined) {
    if (typeof data.payment_amount !== 'number' || data.payment_amount < 0) {
      return {
        valid: false,
        error: 'payment_amount must be a non-negative number',
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
    if (request.record_payment && request.payment_amount !== undefined) {
      // Will determine based on whether payment covers the full amount
      // This is handled after pricing calculation, so default to payment_due
      // The caller should check if payment_amount >= amount and set confirmed
      return 'payment_due';
    }
    // No payment recorded, or skip_approval without payment requirement
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
 * @returns The created customer ID
 * @throws Error if customer creation fails or new_resident is requested
 */
export async function createNewCustomer(
  db: D1Database,
  request: AdminBookingRequest,
  createdBy: string
): Promise<string> {
  if (request.user_type === 'new_guest') {
    const { new_customer } = request;
    if (!new_customer) {
      throw new Error('new_customer data required for guest creation');
    }

    const customerId = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
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

      return customerId;
    } catch (error: any) {
      // Handle UNIQUE constraint on email
      if (error.message?.includes('UNIQUE constraint')) {
        throw new Error(`Customer with email ${new_customer.email} already exists`);
      }
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  if (request.user_type === 'new_resident') {
    throw new Error(
      'Creating new residents through admin booking is not supported. ' +
      'Please create the user account and household first, then create a booking for the existing resident.'
    );
  }

  throw new Error(`Invalid user_type for customer creation: ${request.user_type}`);
}
