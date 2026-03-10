/**
 * Unified household access control
 *
 * Checks if a user can access a household through lot_members (new)
 * Falls back to legacy checks during transition period
 */

import { D1Database } from '@cloudflare/workers-types';

export interface LotMember {
  id: string;
  household_id: string;
  user_id: string;
  member_type: 'primary_owner' | 'secondary';
  can_vote: boolean;
  verified: boolean;
  verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface HouseholdAccessResult {
  hasAccess: boolean;
  memberType?: 'primary_owner' | 'secondary';
  verified?: boolean;
  canVote?: boolean;
  source: 'lot_members' | 'legacy_owner_id' | 'legacy_residents';
}

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

/**
 * Check if a user can access a household
 * Prioritizes lot_members, falls back to legacy checks
 */
export async function canAccessHousehold(
  userId: string,
  householdId: string,
  db: D1Database
): Promise<HouseholdAccessResult> {
  // Check lot_members first (new system)
  const memberStmt = db.prepare(
    'SELECT * FROM lot_members WHERE user_id = ? AND household_id = ? AND verified = 1'
  );
  const memberResult = await memberStmt.bind(userId, householdId).first<LotMember>();

  if (memberResult) {
    return {
      hasAccess: true,
      memberType: memberResult.member_type,
      verified: memberResult.verified,
      canVote: memberResult.can_vote,
      source: 'lot_members'
    };
  }

  // Legacy fallback: check households.owner_id
  const householdStmt = db.prepare(
    'SELECT id, owner_id FROM households WHERE id = ?'
  );
  const household = await householdStmt.bind(householdId).first<{ id: string; owner_id: string | null }>();

  if (household?.owner_id === userId) {
    return {
      hasAccess: true,
      memberType: 'primary_owner',
      verified: true,
      canVote: true,
      source: 'legacy_owner_id'
    };
  }

  // Legacy fallback: check residents table
  const residentStmt = db.prepare(
    'SELECT id FROM residents WHERE user_id = ? AND household_id = ?'
  );
  const resident = await residentStmt.bind(userId, householdId).first<{ id: string }>();

  if (resident) {
    return {
      hasAccess: true,
      source: 'legacy_residents'
    };
  }

  return { hasAccess: false, source: 'lot_members' };
}

/**
 * Get all lots for a user (primary owner only)
 */
export async function getUserLots(
  userId: string,
  db: D1Database
): Promise<Array<{ household_id: string; block: string; lot: string; address: string; lot_type: string; verified: boolean }>> {
  const stmt = db.prepare(`
    SELECT h.id as household_id, h.block, h.lot, h.address, h.lot_type, lm.verified
      FROM lot_members lm
      JOIN households h ON lm.household_id = h.id
     WHERE lm.user_id = ?
       AND lm.member_type = 'primary_owner'
     ORDER BY h.block, h.lot
  `);
  const result = await stmt.bind(userId).all();
  return (result.results || []) as any;
}

/**
 * Count votes eligible for a user
 */
export async function getUserVoteCount(userId: string, db: D1Database): Promise<number> {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
      FROM lot_members lm
      JOIN households h ON lm.household_id = h.id
     WHERE lm.user_id = ?
       AND lm.member_type = 'primary_owner'
       AND lm.can_vote = 1
       AND lm.verified = 1
       AND h.lot_type NOT IN ('community', 'utility', 'open_space')
  `);
  const result = await stmt.bind(userId).first<{ count: number }>();
  return result?.count ? Number(result.count) : 0;
}

/**
 * Get all members of a household
 */
export async function getHouseholdMembers(
  householdId: string,
  db: D1Database
): Promise<Array<{ id: string; user_id: string; first_name: string; last_name: string; email: string; member_type: string; can_vote: boolean; verified: boolean }>> {
  const stmt = db.prepare(`
    SELECT lm.id, u.id as user_id, u.first_name, u.last_name, u.email,
           lm.member_type, lm.can_vote, lm.verified
      FROM lot_members lm
      JOIN users u ON lm.user_id = u.id
     WHERE lm.household_id = ?
     ORDER BY lm.member_type DESC, u.last_name, u.first_name
  `);
  const result = await stmt.bind(householdId).all();
  return (result.results || []) as any;
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string, db: D1Database): Promise<boolean> {
  const stmt = db.prepare('SELECT role FROM users WHERE id = ?');
  const result = await stmt.bind(userId).first<{ role: string }>();
  return result?.role === 'admin';
}
