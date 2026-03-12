// functions/lib/delinquency.ts
// Delinquency business logic for HOA management

export interface DelinquencyStatus {
  is_delinquent: boolean;
  delinquency_type: 'automatic' | 'manual' | null;
  voting_eligible: boolean;
  voting_restored_at: string | null;
  total_due: number;
  unpaid_periods: string[];
  reason?: string;
  days_until_restore?: number;
}

export interface ManualDelinquency {
  id: string;
  lot_member_id: string;
  is_active: boolean;
  reason: string | null;
  marked_by: string;
  marked_at: string;
  waived_by: string | null;
  waived_at: string | null;
  waiver_reason: string | null;
}

/**
 * Check if a lot member is delinquent
 * Delinquent if: unpaid demand past 30 days OR active manual override
 */
export async function checkDelinquency(
  DB: D1Database,
  lotMemberId: string
): Promise<{ is_delinquent: boolean; type: 'automatic' | 'manual' | null; reason?: string }> {
  // Check manual delinquency first
  const manualResult = await DB.prepare(
    'SELECT id, reason FROM manual_delinquencies WHERE lot_member_id = ? AND is_active = 1'
  ).bind(lotMemberId).first();

  if (manualResult) {
    return { is_delinquent: true, type: 'manual', reason: manualResult.reason as string };
  }

  // Check automatic delinquency (unpaid demand 30+ days overdue)
  const automaticResult = await DB.prepare(
    `SELECT pd.id, pd.year
     FROM payment_demands pd
     INNER JOIN lot_members lm ON pd.user_id = lm.user_id
     WHERE lm.id = ?
       AND pd.status = 'pending'
       AND pd.due_date < DATE('now', '-30 days')
     LIMIT 1`
  ).bind(lotMemberId).first();

  if (automaticResult) {
    return { is_delinquent: true, type: 'automatic', reason: 'Unpaid dues overdue' };
  }

  return { is_delinquent: false, type: null };
}

/**
 * Calculate voting eligibility
 * Can vote if: not delinquent AND (30-day payment cooldown satisfied OR never paid)
 */
export async function checkVotingEligibility(
  DB: D1Database,
  lotMemberId: string,
  delinquencyStatus: { is_delinquent: boolean }
): Promise<{ eligible: boolean; restored_at: string | null; days_until_restore?: number }> {
  // If delinquent, not eligible
  if (delinquencyStatus.is_delinquent) {
    return { eligible: false, restored_at: null };
  }

  // Check last payment date for cooldown
  const lastPayment = await DB.prepare(
    `SELECT p.paid_at
     FROM payments p
     INNER JOIN lot_members lm ON p.household_id = lm.household_id
     WHERE lm.id = ? AND p.status = 'completed'
     ORDER BY p.paid_at DESC
     LIMIT 1`
  ).bind(lotMemberId).first();

  if (!lastPayment) {
    // Never paid - eligible (first year)
    return { eligible: true, restored_at: null };
  }

  const paidAt = new Date(lastPayment.paid_at as string);
  const now = new Date();
  const daysSincePayment = Math.floor((now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSincePayment >= 30) {
    // Cooldown satisfied
    return { eligible: true, restored_at: null };
  }

  // In cooldown period
  const restoredAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    eligible: false,
    restored_at: restoredAt.toISOString(),
    days_until_restore: 30 - daysSincePayment
  };
}

/**
 * Get full delinquency status for a lot member
 */
export async function getDelinquencyStatus(
  DB: D1Database,
  lotMemberId: string
): Promise<DelinquencyStatus> {
  const delinquency = await checkDelinquency(DB, lotMemberId);
  const voting = await checkVotingEligibility(DB, lotMemberId, delinquency);

  // Get unpaid periods and total due
  const demandsResult = await DB.prepare(
    `SELECT pd.year, pd.amount_due
     FROM payment_demands pd
     INNER JOIN lot_members lm ON pd.user_id = lm.user_id
     WHERE lm.id = ? AND (pd.status = 'pending' OR pd.status = 'suspended')
     ORDER BY pd.year DESC`
  ).bind(lotMemberId).all();

  const unpaidPeriods = (demandsResult.results || []).map((d: any) => d.year.toString());
  const totalDue = (demandsResult.results || []).reduce((sum: number, d: any) => sum + (d.amount_due || 0), 0);

  return {
    is_delinquent: delinquency.is_delinquent,
    delinquency_type: delinquency.type,
    voting_eligible: voting.eligible,
    voting_restored_at: voting.restored_at,
    total_due: totalDue,
    unpaid_periods: unpaidPeriods,
    reason: delinquency.reason,
    days_until_restore: voting.days_until_restore
  };
}

/**
 * Mark a lot member as manually delinquent
 */
export async function markDelinquent(
  DB: D1Database,
  lotMemberId: string,
  markedBy: string,
  reason: string
): Promise<ManualDelinquency> {
  const id = crypto.randomUUID();
  const markedAt = new Date().toISOString();

  await DB.prepare(
    `INSERT INTO manual_delinquencies (id, lot_member_id, is_active, reason, marked_by, marked_at)
     VALUES (?, ?, 1, ?, ?, ?)`
  ).bind(id, lotMemberId, reason, markedBy, markedAt).run();

  // Set can_vote to false
  await DB.prepare(
    'UPDATE lot_members SET can_vote = 0 WHERE id = ?'
  ).bind(lotMemberId).run();

  return {
    id,
    lot_member_id: lotMemberId,
    is_active: true,
    reason,
    marked_by: markedBy,
    marked_at: markedAt,
    waived_by: null,
    waived_at: null,
    waiver_reason: null
  };
}

/**
 * Waive a manual delinquency
 */
export async function waiveDelinquency(
  DB: D1Database,
  delinquencyId: string,
  waivedBy: string,
  waiverReason: string
): Promise<boolean> {
  const waivedAt = new Date().toISOString();

  const result = await DB.prepare(
    `UPDATE manual_delinquencies
     SET is_active = 0, waived_by = ?, waived_at = ?, waiver_reason = ?
     WHERE id = ? AND is_active = 1`
  ).bind(waivedBy, waivedAt, waiverReason, delinquencyId).run();

  if (result.success && (result.meta?.changes ?? 0) > 0) {
    // Get lot_member_id to restore voting
    const delinquency = await DB.prepare(
      'SELECT lot_member_id FROM manual_delinquencies WHERE id = ?'
    ).bind(delinquencyId).first();

    if (delinquency) {
      // Re-check voting eligibility and restore if appropriate
      const status = await getDelinquencyStatus(DB, delinquency.lot_member_id as string);
      if (status.voting_eligible) {
        await DB.prepare(
          'UPDATE lot_members SET can_vote = 1 WHERE id = ?'
        ).bind(delinquency.lot_member_id).run();
      }
    }

    return true;
  }

  return false;
}
