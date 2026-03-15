/**
 * Reference Number Management
 *
 * Generates and validates obfuscated, non-enumerable reference numbers.
 * Old format: EXT-YYYYMMDD-XXX (enumerable, reveals booking date)
 * New format: LH-XXXXXX (random, non-enumerable)
 */

/**
 * Generate a secure, non-enumerable reference number
 * Format: LH-XXXXXX (6 random alphanumeric characters)
 *
 * Entropy: 62^6 = ~56.8 billion combinations
 * Not tied to date or booking ID
 */
export function generateReferenceNumber(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const array = new Uint8Array(6);

  // Use cryptographically secure random values
  crypto.getRandomValues(array);

  let result = 'LH-';
  for (let i = 0; i < 6; i++) {
    result += chars[array[i] % chars.length];
  }

  return result;
}

/**
 * Validate reference number format
 */
export function isValidReferenceNumber(ref: string): boolean {
  // New format: LH-XXXXXX
  const newFormat = /^LH-[0-9a-zA-Z]{6}$/;

  // Legacy format support: EXT-YYYYMMDD-XXX
  const legacyFormat = /^EXT-\d{8}-[a-zA-Z0-9]{3}$/;

  return newFormat.test(ref) || legacyFormat.test(ref);
}

/**
 * Check if reference is new format
 */
export function isNewFormatReference(ref: string): boolean {
  return /^LH-[0-9a-zA-Z]{6}$/.test(ref);
}

/**
 * Check if reference is legacy format
 */
export function isLegacyFormatReference(ref: string): boolean {
  return /^EXT-\d{8}-[a-zA-Z0-9]{3}$/.test(ref);
}

/**
 * Store reference number mapping in database
 * This allows internal lookup by reference number
 */
export async function storeReferenceMapping(
  db: D1Database,
  bookingId: string,
  referenceNumber: string
): Promise<void> {
  await db.prepare(
    `INSERT INTO reference_number_mappings (reference_number, booking_id)
     VALUES (?, ?)`
  ).bind(referenceNumber, bookingId).run();
}

/**
 * Look up booking ID by reference number
 */
export async function lookupBookingByReference(
  db: D1Database,
  referenceNumber: string
): Promise<string | null> {
  const result = await db.prepare(
    `SELECT booking_id FROM reference_number_mappings
     WHERE reference_number = ?
     LIMIT 1`
  ).bind(referenceNumber).first();

  return result?.booking_id as string || null;
}

/**
 * Generate legacy reference number for backward compatibility
 * DO NOT USE for new bookings
 * @deprecated Use generateReferenceNumber() instead
 */
export function generateLegacyReference(bookingId: string, createdAt: string): string {
  const date = new Date(createdAt);
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `EXT-${dateStr}-${bookingId.slice(-3)}`;
}
