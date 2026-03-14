/**
 * Slot Availability Utilities
 *
 * Provides functions for determining slot availability with proper
 * cascading block logic for slot relationships.
 */

/**
 * Apply cascading block logic for slot relationships.
 *
 * Rules:
 * - If AM is blocked → FULL_DAY should also be blocked
 * - If PM is blocked → FULL_DAY should also be blocked
 * - If FULL_DAY is blocked → both AM and PM should be blocked
 *
 * @param blockedSlots - Set of blocked slots (e.g., from bookings or closures)
 * @returns Set of blocked slots with cascading rules applied
 */
export function applyCascadingBlockLogic(blockedSlots: Set<string>): Set<string> {
  const result = new Set<string>(blockedSlots);

  for (const slot of blockedSlots) {
    if (slot === 'AM') {
      result.add('FULL_DAY');
    } else if (slot === 'PM') {
      result.add('FULL_DAY');
    } else if (slot === 'FULL_DAY') {
      result.add('AM');
      result.add('PM');
    }
  }

  return result;
}

/**
 * Get available slots for a date given blocked slots.
 *
 * @param blockedSlots - Set of blocked slots (e.g., from bookings or closures)
 * @returns Array of available slot names
 */
export function getAvailableSlots(blockedSlots: Set<string>): string[] {
  const allSlots = ['AM', 'PM', 'FULL_DAY'] as const;
  const cascadedBlocked = applyCascadingBlockLogic(blockedSlots);

  return allSlots.filter(slot => !cascadedBlocked.has(slot));
}

/**
 * Check if a specific slot is available.
 *
 * @param slot - Slot to check
 * @param blockedSlots - Set of blocked slots
 * @returns true if the slot is available, false otherwise
 */
export function isSlotAvailable(slot: string, blockedSlots: Set<string>): boolean {
  const cascadedBlocked = applyCascadingBlockLogic(blockedSlots);
  return !cascadedBlocked.has(slot);
}
