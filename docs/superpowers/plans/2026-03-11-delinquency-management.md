# Delinquency Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a comprehensive delinquency management system with manual override capability, automatic detection, and resident visibility.

**Architecture:**
- New `manual_delinquencies` table tracks admin actions with audit trail
- Delinquency determined by: unpaid demands past 30 days OR manual override
- Voting eligibility requires: not delinquent AND 30-day payment cooldown
- Admin UI under Financials section, resident banner on MyLots page

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), React, TypeScript, shadcn/ui

---

## File Structure

```
functions/
├── routes/
│   ├── admin.ts                      # Modify: add delinquency endpoints
│   └── delinquency.ts                # Create: dedicated delinquency routes
├── lib/
│   └── delinquency.ts                # Create: delinquency business logic
└── types.ts                          # Modify: add delinquency types

migrations/
└── 0018_manual_delinquencies.sql     # Create: new table

src/
├── lib/api.ts                        # Modify: add API client methods
├── types/index.ts                    # Modify: add delinquency types
├── components/admin/Sidebar.tsx      # Modify: add navigation item
├── pages/
│   ├── admin/financials/
│   │   ├── DelinquencyPage.tsx       # Create: main admin page
│   │   ├── DemandGenerationModal.tsx # Create: generate demands
│   │   ├── DelinquentTable.tsx       # Create: table component
│   │   ├── DelinquentActions.tsx     # Create: actions menu
│   │   └── WaiveDelinquencyDialog.tsx# Create: waive confirmation
│   └── MyLotsPage.tsx                # Modify: integrate delinquency banner
└── components/
    ├── my-lots/
    │   └── DelinquencyBanner.tsx     # Create: warning banner
    └── delinquency/
        ├── DelinquencyStatusCard.tsx # Create: status card
        └── RestorationCountdown.tsx  # Create: countdown timer
```

---

## Chunk 1: Database & Backend Core

### Task 1: Create Database Migration

**Files:**
- Create: `migrations/0018_manual_delinquencies.sql`

- [ ] **Step 1: Write migration file**

```sql
-- migrations/0018_manual_delinquencies.sql
-- Track manual delinquency overrides with full audit trail

CREATE TABLE IF NOT EXISTS manual_delinquencies (
  id TEXT PRIMARY KEY,
  lot_member_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  reason TEXT,
  marked_by TEXT NOT NULL,
  marked_at TEXT NOT NULL,
  waived_by TEXT,
  waived_at TEXT,
  waiver_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lot_member_id) REFERENCES lot_members(id) ON DELETE CASCADE,
  FOREIGN KEY (marked_by) REFERENCES users(id),
  FOREIGN KEY (waived_by) REFERENCES users(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_lot_member ON manual_delinquencies(lot_member_id);
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_active ON manual_delinquencies(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_delinquencies_marked_by ON manual_delinquencies(marked_by);
```

- [ ] **Step 2: Run migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0018_manual_delinquencies.sql --local
```

Expected: Output showing table created successfully.

- [ ] **Step 3: Verify table exists**

```bash
npx wrangler d1 execute laguna_hills_hoa --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_delinquencies';"
```

Expected: Returns `manual_delinquencies`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0018_manual_delinquencies.sql
git commit -m "feat: add manual_delinquencies table for audit trail"
```

---

### Task 2: Create Delinquency Business Logic

**Files:**
- Create: `functions/lib/delinquency.ts`

- [ ] **Step 1: Write business logic functions**

```typescript
// functions/lib/delinquency.ts
import type { ResultSet } from '@cloudflare/workers-types';

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
```

- [ ] **Step 2: Create TypeScript declaration file**

```typescript
// functions/lib/delinquency.d.ts
export interface DelinquencyStatus;
export interface ManualDelinquency;
export function checkDelinquency(DB: D1Database, lotMemberId: string): Promise<{...}>;
export function checkVotingEligibility(DB: D1Database, lotMemberId: string, delinquencyStatus: {...}): Promise<{...}>;
export function getDelinquencyStatus(DB: D1Database, lotMemberId: string): Promise<DelinquencyStatus>;
export function markDelinquent(DB: D1Database, lotMemberId: string, markedBy: string, reason: string): Promise<ManualDelinquency>;
export function waiveDelinquency(DB: D1Database, delinquencyId: string, waivedBy: string, waiverReason: string): Promise<boolean>;
```

- [ ] **Step 3: Commit**

```bash
git add functions/lib/delinquency.ts functions/lib/delinquency.d.ts
git commit -m "feat: add delinquency business logic"
```

---

### Task 3: Create Delinquency API Routes

**Files:**
- Create: `functions/routes/delinquency.ts`

- [ ] **Step 1: Write delinquency routes**

```typescript
// functions/routes/delinquency.ts
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth';
import { generateId } from '../lib/utils';
import * as delinquency from '../lib/delinquency';

const app = new Hono();

// Admin: List all delinquent members
app.get('/admin/delinquency/members', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user?.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    // Get manual delinquencies
    const manualDelinquents = await c.env.DB.prepare(
      `SELECT md.id, md.lot_member_id, md.reason, md.marked_at, md.marked_by,
              lm.user_id, lm.role,
              u.email, u.first_name, u.last_name,
              l.block, l.lot, l.lot_size_sqm
       FROM manual_delinquencies md
       INNER JOIN lot_members lm ON md.lot_member_id = lm.id
       INNER JOIN users u ON md.marked_by = u.id
       INNER JOIN lots l ON lm.lot_id = l.id
       WHERE md.is_active = 1`
    ).all();

    // Get automatic delinquencies (unpaid demands 30+ days overdue)
    const automaticDelinquents = await c.env.DB.prepare(
      `SELECT DISTINCT
         lm.id as lot_member_id,
         lm.user_id,
         lm.role,
         u.email,
         u.first_name,
         u.last_name,
         l.block,
         l.lot,
         l.lot_size_sqm,
         pd.due_date,
         pd.amount_due,
         pd.year
       FROM payment_demands pd
       INNER JOIN lot_members lm ON pd.user_id = lm.user_id
       INNER JOIN users u ON lm.user_id = u.id
       INNER JOIN lots l ON lm.lot_id = l.id
       WHERE pd.status = 'pending'
         AND pd.due_date < DATE('now', '-30 days')
         AND l.lot_type NOT IN ('community', 'utility', 'open_space')
         AND NOT EXISTS (
           SELECT 1 FROM manual_delinquencies md2
           WHERE md2.lot_member_id = lm.id AND md2.is_active = 1
         )
       ORDER BY l.block, l.lot`
    ).all();

    // Format results
    const delinquents = [
      ...(manualDelinquents.results || []).map((d: any) => ({
        id: d.id,
        lot_member_id: d.lot_member_id,
        block: d.block,
        lot: d.lot,
        lot_size_sqm: d.lot_size_sqm,
        member: {
          user_id: d.user_id,
          name: `${d.first_name} ${d.last_name}`.trim(),
          email: d.email
        },
        delinquency_type: 'manual',
        days_overdue: null,
        amount_due: 0,
        unpaid_periods: [],
        marked_at: d.marked_at,
        reason: d.reason
      })),
      ...(automaticDelinquents.results || []).map((d: any) => {
        const dueDate = new Date(d.due_date);
        const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return {
          lot_member_id: d.lot_member_id,
          block: d.block,
          lot: d.lot,
          lot_size_sqm: d.lot_size_sqm,
          member: {
            user_id: d.user_id,
            name: `${d.first_name} ${d.last_name}`.trim(),
            email: d.email
          },
          delinquency_type: 'automatic',
          days_overdue: daysOverdue,
          amount_due: d.amount_due,
          unpaid_periods: [d.year.toString()]
        };
      })
    ];

    return c.json({
      delinquents,
      summary: {
        total: delinquents.length,
        manual: (manualDelinquents.results || []).length,
        automatic: (automaticDelinquents.results || []).length,
        total_amount_due: delinquents.reduce((sum, d) => sum + (d.amount_due || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching delinquents:', error);
    return c.json({ error: 'Failed to fetch delinquents' }, 500);
  }
});

// Admin: Mark member as delinquent
app.post('/admin/delinquency/mark', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user?.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { lot_member_id, reason } = await c.req.json();

    if (!lot_member_id) {
      return c.json({ error: 'lot_member_id is required' }, 400);
    }

    if (!reason || reason.trim().length === 0) {
      return c.json({ error: 'Reason is required for audit trail' }, 400);
    }

    // Check if already manually delinquent
    const existing = await c.env.DB.prepare(
      'SELECT id FROM manual_delinquencies WHERE lot_member_id = ? AND is_active = 1'
    ).bind(lot_member_id).first();

    if (existing) {
      return c.json({ error: 'Member is already marked as delinquent' }, 400);
    }

    const result = await delinquency.markDelinquent(
      c.env.DB,
      lot_member_id,
      user.id,
      reason.trim()
    );

    return c.json({ delinquency: result });
  } catch (error: any) {
    console.error('Error marking delinquent:', error);
    return c.json({ error: error.message || 'Failed to mark as delinquent' }, 500);
  }
});

// Admin: Waive manual delinquency
app.post('/admin/delinquency/waive/:id', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user?.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const delinquencyId = c.req.param('id');
    const { waiver_reason } = await c.req.json();

    if (!waiver_reason || waiver_reason.trim().length === 0) {
      return c.json({ error: 'Waiver reason is required' }, 400);
    }

    const success = await delinquency.waiveDelinquency(
      c.env.DB,
      delinquencyId,
      user.id,
      waiver_reason.trim()
    );

    if (success) {
      return c.json({ success: true });
    }

    return c.json({ error: 'Delinquency not found or already waived' }, 404);
  } catch (error: any) {
    console.error('Error waiving delinquency:', error);
    return c.json({ error: error.message || 'Failed to waive delinquency' }, 500);
  }
});

// Admin: Generate payment demands for a year
app.post('/admin/delinquency/demands', authMiddleware, async (c) => {
  const user = c.get('user');

  if (user?.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { year, due_date } = await c.req.json();

    if (!year) {
      return c.json({ error: 'Year is required' }, 400);
    }

    const fiscalYear = parseInt(year);
    if (isNaN(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      return c.json({ error: 'Invalid year' }, 400);
    }

    // Default due date: Jan 31 of the given year (30 days from Jan 1)
    const demandDueDate = due_date || `${year}-01-31`;

    // Get current dues rate
    const rateResult = await c.env.DB.prepare(
      'SELECT rate_per_sqm FROM dues_rates WHERE year = ? ORDER BY effective_date DESC LIMIT 1'
    ).bind(fiscalYear).first();

    if (!rateResult) {
      return c.json({ error: `No dues rate configured for year ${fiscalYear}` }, 400);
    }

    const ratePerSqm = rateResult.rate_per_sqm as number;

    // Get all residential lots
    const lots = await c.env.DB.prepare(
      `SELECT l.id, l.lot_size_sqm, lm.user_id, lm.id as lot_member_id
       FROM lots l
       INNER JOIN lot_members lm ON l.id = lm.lot_id
       WHERE lm.role = 'primary_owner'
         AND l.lot_type NOT IN ('community', 'utility', 'open_space')`
    ).all();

    let generated = 0;
    let skipped = 0;

    for (const lot of (lots.results || [])) {
      const lotSize = lot.lot_size_sqm as number;
      const userId = lot.user_id as string;
      const amountDue = lotSize * ratePerSqm * 12; // Annual dues

      // Check if demand already exists
      const existing = await c.env.DB.prepare(
        'SELECT id FROM payment_demands WHERE user_id = ? AND year = ?'
      ).bind(userId, fiscalYear).first();

      if (existing) {
        skipped++;
        continue;
      }

      // Create demand
      const demandId = generateId();
      await c.env.DB.prepare(
        `INSERT INTO payment_demands (id, user_id, year, demand_sent_date, due_date, amount_due, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(
        demandId,
        userId,
        fiscalYear,
        new Date().toISOString().split('T')[0],
        demandDueDate,
        amountDue
      ).run();

      generated++;
    }

    return c.json({
      generated,
      skipped,
      rate_per_sqm: ratePerSqm,
      due_date: demandDueDate
    });
  } catch (error: any) {
    console.error('Error generating demands:', error);
    return c.json({ error: error.message || 'Failed to generate demands' }, 500);
  }
});

// Public: Get delinquency status for current user
app.get('/my-lots/delinquency-status', authMiddleware, async (c) => {
  const user = c.get('user');

  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  try {
    // Get user's lot_members
    const lotMembers = await c.env.DB.prepare(
      'SELECT id FROM lot_members WHERE user_id = ?'
    ).bind(user.id).all();

    if (!lotMembers.results || lotMembers.results.length === 0) {
      return c.json({ error: 'No lots found' }, 404);
    }

    // Check all lots - delinquent if any are delinquent
    let combinedStatus: delinquency.DelinquencyStatus | null = null;

    for (const lm of lotMembers.results) {
      const status = await delinquency.getDelinquencyStatus(c.env.DB, (lm as any).id);

      if (!combinedStatus || status.is_delinquent) {
        combinedStatus = status;
      }
    }

    return c.json(combinedStatus);
  } catch (error: any) {
    console.error('Error fetching delinquency status:', error);
    return c.json({ error: error.message || 'Failed to fetch status' }, 500);
  }
});

export default app;
```

- [ ] **Step 2: Update main routes to include delinquency**

Add to `functions/routes/admin.ts`:

```typescript
// Import delinquency routes (near top of file)
import delinquencyRoutes from './delinquency';

// Add this line in the route setup section:
app.route('/', delinquencyRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add functions/routes/delinquency.ts functions/routes/admin.ts
git commit -m "feat: add delinquency API routes"
```

---

## Chunk 2: Frontend Types & API Client

### Task 4: Add TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add delinquency types**

Add to `src/types/index.ts`:

```typescript
// Add these interfaces to the types file

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

export interface DelinquentMember {
  id?: string;
  lot_member_id: string;
  block: string;
  lot: string;
  lot_size_sqm: number;
  member: {
    user_id: string;
    name: string;
    email: string;
  };
  delinquency_type: 'automatic' | 'manual';
  days_overdue: number | null;
  amount_due: number;
  unpaid_periods: string[];
  marked_at?: string;
  reason?: string;
}

export interface DelinquencySummary {
  total: number;
  manual: number;
  automatic: number;
  total_amount_due: number;
}

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

export interface DemandGenerationRequest {
  year: number;
  due_date?: string;
}

export interface DemandGenerationResponse {
  generated: number;
  skipped: number;
  rate_per_sqm: number;
  due_date: string;
}

export interface MarkDelinquentRequest {
  lot_member_id: string;
  reason: string;
}

export interface WaiveDelinquencyRequest {
  waiver_reason: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add delinquency TypeScript types"
```

---

### Task 5: Update API Client

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add delinquency API methods**

Find the API client class and add these methods. Look for the pattern of other admin methods.

```typescript
// Add to the api object in src/lib/api.ts

  // Delinquency management
  delinquency: {
    // Admin: List all delinquents
    getDelinquents: async (params?: {
      type?: 'all' | 'automatic' | 'manual';
      year?: number;
      search?: string;
    }) => {
      const queryParams = new URLSearchParams();
      if (params?.type && params.type !== 'all') queryParams.append('type', params.type);
      if (params?.year) queryParams.append('year', params.year.toString());
      if (params?.search) queryParams.append('search', params.search);

      return fetchWithAuth(`/api/admin/delinquency/members${queryParams.toString() ? '?' + queryParams.toString() : ''}`);
    },

    // Admin: Mark member as delinquent
    markDelinquent: async (data: MarkDelinquentRequest) => {
      return fetchWithAuth('/api/admin/delinquency/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },

    // Admin: Waive delinquency
    waiveDelinquency: async (id: string, data: WaiveDelinquencyRequest) => {
      return fetchWithAuth(`/api/admin/delinquency/waive/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },

    // Admin: Generate payment demands
    generateDemands: async (data: DemandGenerationRequest) => {
      return fetchWithAuth('/api/admin/delinquency/demands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    },

    // Get current user's delinquency status
    getMyStatus: async () => {
      return fetchWithAuth('/api/my-lots/delinquency-status');
    },
  },
```

Also add the import at the top:

```typescript
import type {
  // ... existing imports ...
  ManualDelinquency,
  DelinquentMember,
  DelinquencySummary,
  DelinquencyStatus,
  DemandGenerationRequest,
  DemandGenerationResponse,
  MarkDelinquentRequest,
  WaiveDelinquencyRequest,
} from '@/types';
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add delinquency API client methods"
```

---

## Chunk 3: Admin UI Components

### Task 6: Update Admin Sidebar

**Files:**
- Modify: `src/components/admin/Sidebar.tsx`

- [ ] **Step 1: Add Delinquency Management nav item**

Find the Financials section and add the new item:

```tsx
// In the navItems array, under Financials section:
{
  title: "Financials",
  href: "/admin/financials",
  icon: DollarSign,
  children: [
    { title: "Payments", href: "/admin/payments", icon: DollarSign },
    {
      title: "Dues Settings",
      href: "/admin/dues-settings",
      icon: DollarSign,
    },
    {
      title: "Delinquency Management",  // <-- ADD THIS
      href: "/admin/financials/delinquency",
      icon: DollarSign,
    },
    {
      title: "Verification Queue",
      href: "/admin/verification-queue",
      icon: DollarSign,
    },
  ],
},
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/Sidebar.tsx
git commit -m "feat: add Delinquency Management to admin sidebar"
```

---

### Task 7: Create Demand Generation Modal

**Files:**
- Create: `src/pages/admin/financials/DemandGenerationModal.tsx`

- [ ] **Step 1: Write the modal component**

```tsx
// src/pages/admin/financials/DemandGenerationModal.tsx
import { useState } from "react";
import { api } from "@/lib/api";
import { notify } from "@/lib/toast";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Receipt } from "lucide-react";

interface DemandGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function DemandGenerationModal({
  open,
  onOpenChange,
  onComplete,
}: DemandGenerationModalProps) {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState(`${new Date().getFullYear()}-01-31`);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    generated: number;
    skipped: number;
    rate_per_sqm: number;
  } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setResult(null);

    try {
      const response = await api.delinquency.generateDemands({
        year: parseInt(year),
        due_date: dueDate,
      });

      if (response.error) {
        notify.error(response.error);
        setGenerating(false);
        return;
      }

      if (response.data) {
        setResult(response.data as DemandGenerationResponse);
        notify.success(
          `Generated ${response.data.generated} demands, skipped ${response.data.skipped} existing`
        );
        onComplete?.();
      }
    } catch (error) {
      logger.error("Error generating demands", error, {
        component: "DemandGenerationModal",
      });
      notify.error("Failed to generate demands");
    } finally {
      setGenerating(false);
    }
  }

  function handleClose() {
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Generate Payment Demands
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year">Fiscal Year *</Label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Payment demands will be due on this date (30 days from Jan 1 by default)
              </p>
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">This will:</p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                <li>Create demands for all residential lots</li>
                <li>Calculate amount: lot_size × rate × 12</li>
                <li>Skip lots that already have demands for this year</li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                {generating ? "Generating..." : "Generate Demands"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="font-medium text-green-900 dark:text-green-100">
                Demands Generated Successfully
              </p>
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                <p>✓ {result.generated} new demands created</p>
                {result.skipped > 0 && (
                  <p>○ {result.skipped} skipped (already exists)</p>
                )}
                <p className="mt-2">Rate: ₱{result.rate_per_sqm.toLocaleString()}/sqm/year</p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financials/DemandGenerationModal.tsx
git commit -m "feat: add demand generation modal"
```

---

### Task 8: Create Delinquency Page

**Files:**
- Create: `src/pages/admin/financials/DelinquencyPage.tsx`

- [ ] **Step 1: Write the main page component**

```tsx
// src/pages/admin/financials/DelinquencyPage.tsx
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { DelinquentMember, DelinquencySummary } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { Receipt, UserCheck, AlertCircle } from "lucide-react";
import { DemandGenerationModal } from "./DemandGenerationModal";
import { DelinquentTable } from "./DelinquentTable";
import { Button } from "@/components/ui/button";

export function DelinquencyPage() {
  const { user } = useAuth();
  const [delinquents, setDelinquents] = useState<DelinquentMember[]>([]);
  const [summary, setSummary] = useState<DelinquencySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDemandModal, setShowDemandModal] = useState(false);

  useEffect(() => {
    loadDelinquents();
  }, []);

  async function loadDelinquents() {
    setLoading(true);
    try {
      const response = await api.delinquency.getDelinquents();
      if (response.data) {
        setDelinquents((response.data as any).delinquents || []);
        setSummary((response.data as any).summary);
      }
    } catch (error) {
      logger.error("Error loading delinquents", error, {
        component: "DelinquencyPage",
      });
    }
    setLoading(false);
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            Delinquency Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage delinquent homeowners and payment demands
          </p>
        </div>
        <Button onClick={() => setShowDemandModal(true)}>
          <Receipt className="w-4 h-4 mr-2" />
          Generate Demands
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Delinquent</p>
                <p className="text-2xl font-bold">{summary.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <UserCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manual Override</p>
                <p className="text-2xl font-bold">{summary.manual}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
                <Receipt className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Owed</p>
                <p className="text-2xl font-bold">
                  ₱{summary.total_amount_due.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delinquent Table */}
      <DelinquentTable
        delinquents={delinquents}
        loading={loading}
        onRefresh={loadDelinquents}
      />

      {/* Demand Generation Modal */}
      <DemandGenerationModal
        open={showDemandModal}
        onOpenChange={setShowDemandModal}
        onComplete={loadDelinquents}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financials/DelinquencyPage.tsx
git commit -m "feat: add delinquency management page"
```

---

### Task 9: Create Delinquent Table Component

**Files:**
- Create: `src/pages/admin/financials/DelinquentTable.tsx`

- [ ] **Step 1: Write the table component**

```tsx
// src/pages/admin/financials/DelinquentTable.tsx
import { useState } from "react";
import type { DelinquentMember } from "@/types";
import { MoreVertical, Calendar, DollarSign } from "lucide-react";
import { DelinquentActions } from "./DelinquentActions";
import { cn } from "@/lib/utils";

interface DelinquentTableProps {
  delinquents: DelinquentMember[];
  loading: boolean;
  onRefresh: () => void;
}

export function DelinquentTable({
  delinquents,
  loading,
  onRefresh,
}: DelinquentTableProps) {
  const [filter, setFilter] = useState<"all" | "automatic" | "manual">("all");
  const [search, setSearch] = useState("");

  const filteredDelinquents = delinquents.filter((d) => {
    const matchesFilter = filter === "all" || d.delinquency_type === filter;
    const matchesSearch =
      !search ||
      d.member.name.toLowerCase().includes(search.toLowerCase()) ||
      `${d.block}-${d.lot}`.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Filters */}
      <div className="p-4 border-b flex items-center gap-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="px-3 py-2 border rounded-lg text-sm bg-background"
        >
          <option value="all">All Types</option>
          <option value="automatic">Automatic</option>
          <option value="manual">Manual</option>
        </select>

        <input
          type="text"
          placeholder="Search by name or lot..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-background"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Lot
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Member
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                Amount Due
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-card divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : filteredDelinquents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  {search || filter !== "all"
                    ? "No delinquents match your filters"
                    : "No delinquent members found"}
                </td>
              </tr>
            ) : (
              filteredDelinquents.map((delinquent) => (
                <tr key={delinquent.lot_member_id} className="hover:bg-muted/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-card-foreground">
                      {delinquent.block}-{delinquent.lot}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {delinquent.lot_size_sqm} sqm
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-card-foreground">
                      {delinquent.member.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {delinquent.member.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        "px-2 py-1 text-xs font-medium rounded-full",
                        delinquent.delinquency_type === "manual"
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                      )}
                    >
                      {delinquent.delinquency_type === "manual" ? "Manual" : "Automatic"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delinquent.delinquency_type === "automatic" && delinquent.days_overdue !== null ? (
                      <div className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                        <Calendar className="w-3 h-3" />
                        {delinquent.days_overdue} days overdue
                      </div>
                    ) : delinquent.marked_at ? (
                      <div className="text-xs text-muted-foreground">
                        {new Date(delinquent.marked_at).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {delinquent.amount_due > 0 ? (
                      <div className="flex items-center gap-1 text-sm font-medium text-card-foreground">
                        <DollarSign className="w-3 h-3" />
                        {delinquent.amount_due.toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {delinquent.unpaid_periods.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {delinquent.unpaid_periods.join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <DelinquentActions
                      delinquent={delinquent}
                      onRefresh={onRefresh}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financials/DelinquentTable.tsx
git commit -m "feat: add delinquent table component"
```

---

### Task 10: Create Actions Menu Component

**Files:**
- Create: `src/pages/admin/financials/DelinquentActions.tsx`

- [ ] **Step 1: Write the actions menu**

```tsx
// src/pages/admin/financials/DelinquentActions.tsx
import { useState } from "react";
import type { DelinquentMember } from "@/types";
import { MoreVertical, Eye, MessageSquare, Ban } from "lucide-react";
import { WaiveDelinquencyDialog } from "./WaiveDelinquencyDialog";
import { notify } from "@/lib/toast";

interface DelinquentActionsProps {
  delinquent: DelinquentMember;
  onRefresh: () => void;
}

export function DelinquentActions({
  delinquent,
  onRefresh,
}: DelinquentActionsProps) {
  const [open, setOpen] = useState(false);
  const [showWaiveDialog, setShowWaiveDialog] = useState(false);

  function handleSendReminder() {
    // TODO: Implement reminder sending
    notify.info("Reminder feature coming soon");
  }

  return (
    <>
      <div className="relative inline-block text-left">
        <button
          onClick={() => setOpen(!open)}
          className="p-2 hover:bg-accent rounded-lg transition-colors"
          aria-label="Actions"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute right-0 z-20 w-48 bg-card border rounded-lg shadow-lg py-1">
              <button
                onClick={() => {
                  setOpen(false);
                  // Show details modal (TODO)
                  notify.info("Details view coming soon");
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                View Details
              </button>

              <button
                onClick={() => {
                  setOpen(false);
                  handleSendReminder();
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-accent flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Send Reminder
              </button>

              {delinquent.delinquency_type === "manual" && delinquent.id && (
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowWaiveDialog(true);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-accent text-orange-600 dark:text-orange-400 flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Waive Delinquency
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showWaiveDialog && delinquent.id && (
        <WaiveDelinquencyDialog
          delinquentId={delinquent.id}
          memberName={delinquent.member.name}
          open={showWaiveDialog}
          onOpenChange={setShowWaiveDialog}
          onComplete={() => {
            onRefresh();
            setShowWaiveDialog(false);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financials/DelinquentActions.tsx
git commit -m "feat: add delinquent actions menu"
```

---

### Task 11: Create Waive Dialog Component

**Files:**
- Create: `src/pages/admin/financials/WaiveDelinquencyDialog.tsx`

- [ ] **Step 1: Write the waive dialog**

```tsx
// src/pages/admin/financials/WaiveDelinquencyDialog.tsx
import { useState } from "react";
import { api } from "@/lib/api";
import { notify } from "@/lib/toast";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BanCheck } from "lucide-react";

interface WaiveDelinquencyDialogProps {
  delinquentId: string;
  memberName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function WaiveDelinquencyDialog({
  delinquentId,
  memberName,
  open,
  onOpenChange,
  onComplete,
}: WaiveDelinquencyDialogProps) {
  const [waiverReason, setWaiverReason] = useState("");
  const [waiving, setWaiving] = useState(false);

  async function handleWaive(e: React.FormEvent) {
    e.preventDefault();

    if (!waiverReason.trim()) {
      notify.error("Please provide a reason for waiving this delinquency");
      return;
    }

    setWaiving(true);

    try {
      const response = await api.delinquency.waiveDelinquency(delinquentId, {
        waiver_reason: waiverReason.trim(),
      });

      if (response.error) {
        notify.error(response.error);
        setWaiving(false);
        return;
      }

      notify.success("Delinquency waived successfully");
      onComplete();
    } catch (error) {
      logger.error("Error waiving delinquency", error, {
        component: "WaiveDelinquencyDialog",
      });
      notify.error("Failed to waive delinquency");
      setWaiving(false);
    }
  }

  function handleClose() {
    setWaiverReason("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BanCheck className="w-5 h-5 text-orange-600" />
            Waive Delinquency
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleWaive} className="space-y-4">
          <div className="bg-muted p-3 rounded-lg text-sm">
            <p className="font-medium">Member: {memberName}</p>
            <p className="text-muted-foreground mt-1">
              This will restore voting rights immediately if all other requirements are met.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="waiverReason">Waive Reason *</Label>
            <Textarea
              id="waiverReason"
              value={waiverReason}
              onChange={(e) => setWaiverReason(e.target.value)}
              placeholder="Explain why this delinquency is being waived..."
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              This will be recorded in the audit trail
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={waiving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={waiving} variant="destructive">
              {waiving ? "Waiving..." : "Waive Delinquency"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/admin/financials/WaiveDelinquencyDialog.tsx
git commit -m "feat: add waive delinquency dialog"
```

---

### Task 12: Register Admin Page Route

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

- [ ] **Step 1: Add route for DelinquencyPage**

Find the routing logic and add the new page:

```tsx
// Import the component
import { DelinquencyPage } from "./admin/financials/DelinquencyPage";

// Add to the routing logic (look for similar patterns):
if (pathSection === "financials" && subSection === "delinquency") {
  return <DelinquencyPage />;
}
```

You may need to add subSection parsing if it doesn't exist. Look for how other nested routes like `/admin/users?tab=board-members` work.

- [ ] **Step 2: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat: register delinquency page route"
```

---

## Chunk 4: Resident UI Components

### Task 13: Create Delinquency Banner Component

**Files:**
- Create: `src/components/my-lots/DelinquencyBanner.tsx`

- [ ] **Step 1: Write the banner component**

```tsx
// src/components/my-lots/DelinquencyBanner.tsx
import { AlertTriangle, CreditCard, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DelinquencyStatus } from "@/types";

interface DelinquencyBannerProps {
  status: DelinquencyStatus;
}

export function DelinquencyBanner({ status }: DelinquencyBannerProps) {
  if (!status.is_delinquent) {
    return null;
  }

  return (
    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100">
            DELINQUENCY NOTICE
          </h3>
          <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
            Your account is currently delinquent. This means:
          </p>
          <ul className="list-disc list-inside text-sm text-orange-700 dark:text-orange-300 mt-1 space-y-1">
            <li>Voting rights are suspended</li>
            <li>You may not be eligible for certain services</li>
          </ul>

          {status.total_due > 0 && (
            <div className="mt-4 p-3 bg-white dark:bg-orange-900/10 rounded-lg">
              <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                Total Amount Due: ₱{status.total_due.toLocaleString()}
              </p>
              {status.unpaid_periods.length > 0 && (
                <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                  Periods: {status.unpaid_periods.join(", ")}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <Button
              size="sm"
              onClick={() => (window.location.href = "/payments")}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => (window.location.href = "/messages?compose=true")}
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us
            </Button>
          </div>

          {status.reason && (
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-3">
              Reason: {status.reason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/my-lots/DelinquencyBanner.tsx
git commit -m "feat: add delinquency banner for residents"
```

---

### Task 14: Create Restoration Countdown Component

**Files:**
- Create: `src/components/delinquency/RestorationCountdown.tsx'

- [ ] **Step 1: Write countdown component**

```tsx
// src/components/delinquency/RestorationCountdown.tsx
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface RestorationCountdownProps {
  voting_restored_at: string | null;
  days_until_restore?: number;
}

export function RestorationCountdown({
  voting_restored_at,
  days_until_restore: initialDays,
}: RestorationCountdownProps) {
  const [daysLeft, setDaysLeft] = useState(initialDays);

  useEffect(() => {
    if (voting_restored_at) {
      const updateDays = () => {
        const restoredDate = new Date(voting_restored_at);
        const now = new Date();
        const diff = Math.ceil(
          (restoredDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        setDaysLeft(Math.max(0, diff));
      };

      updateDays();
      const interval = setInterval(updateDays, 60 * 60 * 1000); // Update hourly
      return () => clearInterval(interval);
    }
  }, [voting_restored_at]);

  if (!voting_restored_at || daysLeft === undefined) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="w-4 h-4" />
      <span>
        Voting rights restore in{" "}
        <span className="font-medium text-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/delinquency/RestorationCountdown.tsx
git commit -m "feat: add voting restoration countdown component"
```

---

### Task 15: Update MyLots Page with Delinquency

**Files:**
- Modify: `src/pages/MyLotsPage.tsx`

- [ ] **Step 1: Read current MyLotsPage to understand structure**

Use Read tool to examine the file structure and find where to integrate the banner.

- [ ] **Step 2: Add delinquency status fetching**

Add to the component:

```tsx
import { DelinquencyBanner } from "@/components/my-lots/DelinquencyBanner";
import { RestorationCountdown } from "@/components/delinquency/RestorationCountdown";
import { api } from "@/lib/api";
import type { DelinquencyStatus } from "@/types";

// Add state in component:
const [delinquencyStatus, setDelinquencyStatus] = useState<DelinquencyStatus | null>(null);

// Add to useEffect or create new one:
useEffect(() => {
  async function loadDelinquencyStatus() {
    try {
      const response = await api.delinquency.getMyStatus();
      if (response.data) {
        setDelinquencyStatus(response.data as DelinquencyStatus);
      }
    } catch (error) {
      console.error("Error loading delinquency status:", error);
    }
  }
  loadDelinquencyStatus();
}, []);
```

- [ ] **Step 3: Add banner to JSX**

Add near the top of the return, after any existing header:

```tsx
{delinquencyStatus && <DelinquencyBanner status={delinquencyStatus} />}
```

- [ ] **Step 4: Update voting status section**

Find where voting status is displayed and add the countdown:

```tsx
{/* In the voting status area, add: */}
{delinquencyStatus?.voting_restored_at && (
  <RestorationCountdown
    voting_restored_at={delinquencyStatus.voting_restored_at}
    days_until_restore={delinquencyStatus.days_until_restore}
  />
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/MyLotsPage.tsx
git commit -m "feat: integrate delinquency status in MyLots page"
```

---

## Chunk 5: Integration & Testing

### Task 16: Type Check and Build

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Fix any type errors**

If errors occur, fix imports and types as needed.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues"
```

---

### Task 17: Manual Testing Checklist

- [ ] **Test 1: Run the application**

```bash
npm run dev:all
```

- [ ] **Test 2: Admin - Generate payment demands**
  1. Login as admin (admin@lagunahills.com)
  2. Navigate to Admin → Financials → Delinquency Management
  3. Click "Generate Demands"
  4. Fill in year and due date
  5. Verify demands are created

- [ ] **Test 3: Admin - View delinquents list**
  1. Check that delinquents appear in the table
  2. Verify summary cards show correct counts
  3. Test filters (All/Automatic/Manual)
  4. Test search functionality

- [ ] **Test 4: Admin - Mark member as delinquent**
  1. Create a manual delinquency via API or direct DB insert for testing
  2. Verify it appears in the list
  3. Test waive functionality
  4. Verify voting rights are restored after waiver

- [ ] **Test 5: Resident - View delinquency status**
  1. Login as a delinquent user
  2. Navigate to My Lots page
  3. Verify delinquency banner appears
  4. Check voting status shows suspended
  5. Verify restoration countdown appears if applicable

- [ ] **Test 6: Verify automatic detection**
  1. Create a payment demand with past due date (>30 days ago)
  2. Verify member appears as automatically delinquent
  3. Mark demand as paid
  4. Verify 30-day cooldown is in effect

---

### Task 18: Final Documentation

- [ ] **Step 1: Update CLAUDE.md if needed**

Document any new patterns or conventions introduced.

- [ ] **Step 2: Update API documentation**

If `docs/API_DOCUMENTATION.md` exists, add the new endpoints.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "docs: update documentation for delinquency management"
```

---

## Completion Criteria

- [ ] All tasks completed
- [ ] TypeScript compiles without errors
- [ ] Application builds successfully
- [ ] Manual testing checklist passes
- [ ] No console errors during normal operation
- [ ] Git history shows clean, logical commits

---

## Notes for Implementation

1. **Migration**: Remember to run the D1 migration both locally and in production
2. **Route registration**: The AdminPanelPage routing may need adjustment based on existing patterns
3. **API error handling**: The API client uses a specific pattern - follow it for consistency
4. **Testing**: This project has no test suite - manual verification is required
5. **Date handling**: All dates should be ISO strings for consistency
6. **Amount calculations**: Annual dues = lot_size × rate_per_sqm × 12
