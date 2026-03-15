/**
 * Public API DTOs (Data Transfer Objects)
 *
 * This layer abstracts the internal database structure from public API responses.
 * All public endpoints should return DTOs, never raw database records.
 *
 * Key Security Principles:
 * 1. Use public-facing field names (not DB column names)
 * 2. Whitelist fields that can be exposed
 * 3. Transform internal values to user-friendly formats
 * 4. Never expose internal IDs or implementation details
 */

// =============================================================================
// Public Types (External-facing)
// =============================================================================

/**
 * Public booking status enum - user-friendly names
 */
export type PublicBookingStatus =
  | 'submitted'
  | 'payment_required'
  | 'verifying_payment'
  | 'confirmed'
  | 'rejected'
  | 'cancelled';

/**
 * Public amenity type
 */
export type PublicAmenityType = 'clubhouse' | 'pool';

/**
 * Public time slot
 */
export type PublicTimeSlot = 'morning' | 'afternoon' | 'full_day';

/**
 * Public event type
 */
export type PublicEventType = 'wedding' | 'birthday' | 'meeting' | 'sports' | 'other';

/**
 * Minimal booking info - shown without verification
 */
export interface PublicBookingMinimal {
  referenceNumber: string;
  amenity: PublicAmenityType;
  date: string;
  slot: PublicTimeSlot;
  status: PublicBookingStatus;
}

/**
 * Public booking information - shown with verification
 */
export interface PublicBookingInfo extends PublicBookingMinimal {
  amount: number;
  guestFirstName: string;
  guestLastName: string;
  statusMessage: string;
  nextAction: string;
  createdAt: string;
}

/**
 * Public booking detail - full info for confirmed bookings
 */
export interface PublicBookingDetail extends PublicBookingInfo {
  guestEmail: string;
  guestPhone: string;
  guestNotes?: string;
  rejectionReason?: string;
}

/**
 * Public amenity listing
 */
export interface PublicAmenity {
  id: PublicAmenityType;
  name: string;
  description: string;
  capacity: number;
  image: string;
}

/**
 * Public availability response
 */
export interface PublicAvailability {
  date: string;
  availableSlots: PublicTimeSlot[];
}

/**
 * Public pricing breakdown
 */
export interface PublicPricing {
  baseRate: number;
  duration: number;
  dayType: 'weekday' | 'weekend' | 'holiday';
  dayMultiplier: number;
  seasonType: 'peak' | 'off_peak';
  seasonMultiplier: number;
  subtotal: number;
  residentDiscount: number;
  finalPrice: number;
}

/**
 * Public payment details
 */
export interface PublicPaymentDetails {
  gcash: {
    number: string;
    name: string;
  };
  bankTransfer: {
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
}

/**
 * Public phase information for status display
 */
export interface PublicPhaseInfo {
  phase: number;
  phaseName: string;
  description: string;
  nextStep: string;
  isRejected: boolean;
  isCancelled: boolean;
}

/**
 * Public notification
 */
export interface PublicNotification {
  id: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

/**
 * API response wrapper
 */
export interface PublicApiResponse<T> {
  data: T;
  error?: never;
}

export interface PublicApiError {
  error: string;
  message?: string;
  code?: string;
}

// =============================================================================
// Internal Types (Database records - NOT exposed directly)
// =============================================================================

/**
 * Raw booking record from database (INTERNAL USE ONLY)
 */
interface BookingRecord {
  id: string;
  customer_id?: string;
  user_id?: string;
  workflow: string;
  amenity_type: string;
  date: string;
  slot: string;
  base_rate?: number;
  duration_hours?: number;
  day_multiplier?: number;
  season_multiplier?: number;
  amount: number;
  pricing_calculated_at?: string;
  payment_status?: string;
  proof_of_payment_url?: string;
  booking_status: string;
  event_type: string;
  purpose?: string;
  attendee_count?: number;
  rejection_reason?: string;
  admin_notes?: string;
  created_at: string;
  created_by_customer_id?: string;
  created_ip?: string;
  updated_at?: string;
  deleted_at?: string;
  // Joined customer fields
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

/**
 * Raw customer record from database (INTERNAL USE ONLY)
 */
interface CustomerRecord {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  guest_notes?: string;
  created_at: string;
  created_ip?: string;
}

// =============================================================================
// Mapping Functions: Internal → Public
// =============================================================================

/**
 * Map internal amenity type to public
 */
function mapAmenityType(amenityType: string): PublicAmenityType {
  const valid: PublicAmenityType[] = ['clubhouse', 'pool'];
  if (valid.includes(amenityType as PublicAmenityType)) {
    return amenityType as PublicAmenityType;
  }
  return 'clubhouse'; // Default fallback
}

/**
 * Map internal slot to public
 */
function mapTimeSlot(slot: string): PublicTimeSlot {
  const slotMap: Record<string, PublicTimeSlot> = {
    'AM': 'morning',
    'PM': 'afternoon',
    'FULL_DAY': 'full_day'
  };
  return slotMap[slot] || 'full_day';
}

/**
 * Map internal status to public
 */
function mapBookingStatus(status: string): PublicBookingStatus {
  const statusMap: Record<string, PublicBookingStatus> = {
    'submitted': 'submitted',
    'payment_due': 'payment_required',
    'payment_review': 'verifying_payment',
    'confirmed': 'confirmed',
    'rejected': 'rejected',
    'cancelled': 'cancelled'
  };
  return statusMap[status] || 'submitted';
}

/**
 * Get status message for public display
 */
function getStatusMessage(status: PublicBookingStatus): string {
  const messages: Record<PublicBookingStatus, string> = {
    submitted: 'Your request is being reviewed.',
    payment_required: 'Approved! Please complete your payment to confirm your booking.',
    verifying_payment: 'Payment received. Your booking is being verified.',
    confirmed: 'Your booking is confirmed!',
    rejected: 'Your request has been declined.',
    cancelled: 'Your booking has been cancelled.'
  };
  return messages[status] || 'Your request is being processed.';
}

/**
 * Get next action for public display
 */
function getNextAction(status: PublicBookingStatus): { action: string; link?: string } {
  const actions: Record<PublicBookingStatus, { action: string; link?: string }> = {
    submitted: { action: 'Wait for approval' },
    payment_required: { action: 'Complete payment' },
    verifying_payment: { action: 'Wait for verification' },
    confirmed: { action: 'View booking details' },
    rejected: { action: 'Submit new request' },
    cancelled: { action: 'Submit new request' }
  };
  return actions[status] || { action: 'Contact support' };
}

/**
 * Format time as "8:23 AM" or "2:15 PM"
 */
export function formatTimeOfDay(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// =============================================================================
// DTO Transformers
// =============================================================================

/**
 * Transform booking record to minimal public DTO
 * Used for unauthenticated access
 */
export function toPublicBookingMinimal(
  booking: BookingRecord,
  referenceNumber: string
): PublicBookingMinimal {
  return {
    referenceNumber,
    amenity: mapAmenityType(booking.amenity_type),
    date: booking.date,
    slot: mapTimeSlot(booking.slot),
    status: mapBookingStatus(booking.booking_status)
  };
}

/**
 * Transform booking record to public info DTO
 * Used after ownership verification
 */
export function toPublicBookingInfo(
  booking: BookingRecord,
  referenceNumber: string
): PublicBookingInfo {
  const publicStatus = mapBookingStatus(booking.booking_status);
  return {
    ...toPublicBookingMinimal(booking, referenceNumber),
    amount: booking.amount,
    guestFirstName: booking.first_name || '',
    guestLastName: booking.last_name || '',
    statusMessage: getStatusMessage(publicStatus),
    nextAction: getNextAction(publicStatus).action,
    createdAt: formatTimeOfDay(booking.created_at)
  };
}

/**
 * Transform booking record to full detail DTO
 * Used for confirmed bookings with full access
 */
export function toPublicBookingDetail(
  booking: BookingRecord,
  referenceNumber: string
): PublicBookingDetail {
  const publicStatus = mapBookingStatus(booking.booking_status);
  const nextActionObj = getNextAction(publicStatus);

  return {
    ...toPublicBookingInfo(booking, referenceNumber),
    guestEmail: booking.email || '',
    guestPhone: booking.phone || '',
    guestNotes: booking.purpose || booking.admin_notes,
    rejectionReason: booking.rejection_reason
  };
}

/**
 * Transform amenity for public listing
 */
export function toPublicAmenity(amenityType: PublicAmenityType): PublicAmenity {
  const amenities: Record<PublicAmenityType, PublicAmenity> = {
    clubhouse: {
      id: 'clubhouse',
      name: 'Clubhouse',
      description: 'Perfect for weddings, parties, and meetings',
      capacity: 100,
      image: '/images/clubhouse.jpg'
    },
    pool: {
      id: 'pool',
      name: 'Swimming Pool',
      description: 'Olympic-sized pool with kiddie area',
      capacity: 50,
      image: '/images/pool.jpg'
    }
  };
  return amenities[amenityType];
}

/**
 * Transform availability data
 */
export function toPublicAvailability(date: string, slots: string[]): PublicAvailability {
  return {
    date,
    availableSlots: slots.map(mapTimeSlot) as PublicTimeSlot[]
  };
}

/**
 * Transform pricing calculation
 */
export function toPublicPricing(
  baseRate: number,
  duration: number,
  dayType: 'weekday' | 'weekend' | 'holiday',
  dayMultiplier: number,
  seasonType: 'peak' | 'off_peak',
  seasonMultiplier: number,
  residentDiscount: number,
  finalPrice: number
): PublicPricing {
  return {
    baseRate,
    duration,
    dayType,
    dayMultiplier,
    seasonType,
    seasonMultiplier,
    subtotal: finalPrice / (1 - residentDiscount),
    residentDiscount,
    finalPrice
  };
}

/**
 * Transform payment details with masking
 */
export function toPublicPaymentDetails(
  gcashNumber: string,
  gcashName: string,
  bankName: string,
  accountName: string,
  accountNumber: string
): PublicPaymentDetails {
  // Mask sensitive numbers
  const maskAccount = (num: string): string => {
    if (num.length <= 4) return 'XXXX';
    return num.slice(0, 2) + 'X'.repeat(num.length - 4) + num.slice(-2);
  };

  return {
    gcash: {
      number: maskAccount(gcashNumber),
      name: gcashName
    },
    bankTransfer: {
      bankName,
      accountName,
      accountNumber: maskAccount(accountNumber)
    }
  };
}

/**
 * Transform notification for public display
 */
export function toPublicNotification(notification: any): PublicNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    content: notification.content,
    link: notification.link,
    read: !!notification.read,
    createdAt: notification.created_at
  };
}

/**
 * Transform phase information
 */
export function toPublicPhaseInfo(
  status: PublicBookingStatus,
  phase: number,
  phaseName: string,
  description: string,
  nextStep: string
): PublicPhaseInfo {
  return {
    phase,
    phaseName,
    description,
    nextStep,
    isRejected: status === 'rejected',
    isCancelled: status === 'cancelled'
  };
}

// =============================================================================
// Generic Response Builders
// =============================================================================

/**
 * Build success response
 */
export function publicSuccess<T>(data: T): PublicApiResponse<T> {
  return { data };
}

/**
 * Build error response
 */
export function publicError(
  message: string,
  code?: string
): PublicApiError {
  const error: PublicApiError = { error: message };
  if (code) error.code = code;
  return error;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate reference number format
 */
export function isValidReferenceNumber(ref: string): boolean {
  // Accept both old (EXT-YYYYMMDD-XXX) and new (LH-XXXXXX) formats
  const oldFormat = /^EXT-\d{8}-[a-zA-Z0-9]{3}$/;
  const newFormat = /^LH-[a-zA-Z0-9]{6}$/;
  return oldFormat.test(ref) || newFormat.test(ref);
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
