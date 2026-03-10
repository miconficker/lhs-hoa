# Lot Members Migration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a new unified ownership and access control system using the `lot_members` table, replacing the dual-path model of `households.owner_id` and `residents` table.

**Architecture:** Three-phase sequential migration. Phase 1 creates new structures additively (zero risk). Phase 2 backfills existing data and updates all queries. Phase 3 removes legacy columns and tables after verification.

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), React 18, TypeScript, Tailwind CSS, shadcn/ui

---

## File Structure

### New Files (Phase 1)
- `migrations/0017_lot_members.sql` - Database migration script
- `functions/routes/lot-members.ts` - New API endpoints
- `functions/lib/lot-access.ts` - Unified access control helper
- `src/components/admin/lots/LotsManagementPage.tsx` - Main lots management page
- `src/components/admin/lots/LotMembersList.tsx` - Display household members
- `src/components/admin/lots/AssignMemberDialog.tsx` - Add owner/member dialog
- `src/components/admin/lots/VerifyMemberDialog.tsx` - Verify ownership dialog
- `src/components/admin/lots/types.ts` - TypeScript types for lot management

### Modified Files (Phase 1)
- `functions/lib/auth.ts` - Add lot_members check to authentication helpers
- `src/lib/api.ts` - Add lot members API client methods
- `src/pages/AdminPanel.tsx` - Add Lots management route
- `src/components/layout/AdminSidebar.tsx` - Add Lots navigation item

### Modified Files (Phase 2)
- `functions/routes/polls.ts` - Update vote count query
- `functions/routes/service-requests.ts` - Update access control
- `functions/routes/reservations.ts` - Update access control
- `functions/routes/payments.ts` - Update access control
- `functions/routes/admin/lots.ts` - Dual-write during transition

### Modified Files (Phase 3)
- `migrations/0018_cleanup_legacy.sql` - Cleanup migration
- All files - Remove transitional dual-write code

---

## Chunk 1: Phase 1 - Database Migration

### Task 1: Create migration file

**Files:**
- Create: `migrations/0017_lot_members.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ================================================================
-- Migration 0017: lot_members table + users.profile_complete
-- ADDITIVE ONLY — no existing tables or columns modified
-- Safe to run immediately on production
-- ================================================================

-- 1. Add profile_complete to users table
ALTER TABLE users ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT 0;

-- Backfill: mark existing users complete if they have name + phone
UPDATE users
   SET profile_complete = 1
 WHERE first_name IS NOT NULL
   AND last_name  IS NOT NULL
   AND phone      IS NOT NULL;

-- 2. Create lot_members table (new unified ownership/access table)
CREATE TABLE lot_members (
  id            TEXT     PRIMARY KEY,
  household_id  TEXT     NOT NULL REFERENCES households(id),
  user_id       TEXT     NOT NULL REFERENCES users(id),
  member_type   TEXT     NOT NULL
                CHECK(member_type IN ('primary_owner','secondary')),
  can_vote      BOOLEAN  NOT NULL DEFAULT 0,
  verified      BOOLEAN  NOT NULL DEFAULT 0,
  verified_at   DATETIME,
  verified_by   TEXT     REFERENCES users(id),
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(household_id, user_id)
);

-- Indexes for common query patterns
CREATE INDEX idx_lot_members_household ON lot_members(household_id);
CREATE INDEX idx_lot_members_user       ON lot_members(user_id);
CREATE INDEX idx_lot_members_verified   ON lot_members(verified, member_type);
```

- [ ] **Step 2: Run migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0017_lot_members.sql --local
```

Expected: Output showing ALTER TABLE and CREATE TABLE successful

- [ ] **Step 3: Verify schema changes**

```bash
npx wrangler d1 execute laguna_hills_hoa --local --command="PRAGMA table_info(lot_members);"
```

Expected: Shows all columns with correct types

- [ ] **Step 4: Commit**

```bash
git add migrations/0017_lot_members.sql
git commit -m "feat(migration): add lot_members table and users.profile_complete"
```

---

## Chunk 2: Phase 1 - Backend API Routes

### Task 2: Create lot access control helper

**Files:**
- Create: `functions/lib/lot-access.ts`

- [ ] **Step 1: Write the access control helper**

```typescript
/**
 * Unified household access control
 *
 * Checks if a user can access a household through lot_members (new)
 * Falls back to legacy checks during transition period
 */

import { Env } from '../types';

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

/**
 * Check if a user can access a household
 * Prioritizes lot_members, falls back to legacy checks
 */
export async function canAccessHousehold(
  userId: string,
  householdId: string,
  env: Env
): Promise<HouseholdAccessResult> {
  // Check lot_members first (new system)
  const memberStmt = env.db.prepare(
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
  const householdStmt = env.db.prepare(
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
  const residentStmt = env.db.prepare(
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
  env: Env
): Promise<Array<{ household_id: string; block: string; lot: string; address: string; lot_type: string; verified: boolean }>> {
  const stmt = env.db.prepare(`
    SELECT h.id as household_id, h.block, h.lot, h.address, h.lot_type, lm.verified
      FROM lot_members lm
      JOIN households h ON lm.household_id = h.id
     WHERE lm.user_id = ?
       AND lm.member_type = 'primary_owner'
     ORDER BY h.block, h.lot
  `);
  const result = await stmt.bind(userId).all();
  return result.results as any;
}

/**
 * Count votes eligible for a user
 */
export async function getUserVoteCount(userId: string, env: Env): Promise<number> {
  const stmt = env.db.prepare(`
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
  return result?.count ?? 0;
}

/**
 * Get all members of a household
 */
export async function getHouseholdMembers(
  householdId: string,
  env: Env
): Promise<Array<{ user_id: string; first_name: string; last_name: string; email: string; member_type: string; can_vote: boolean; verified: boolean }>> {
  const stmt = env.db.prepare(`
    SELECT u.id as user_id, u.first_name, u.last_name, u.email,
           lm.member_type, lm.can_vote, lm.verified
      FROM lot_members lm
      JOIN users u ON lm.user_id = u.id
     WHERE lm.household_id = ?
     ORDER BY lm.member_type DESC, u.last_name, u.first_name
  `);
  const result = await stmt.bind(householdId).all();
  return result.results as any;
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string, env: Env): Promise<boolean> {
  const stmt = env.db.prepare('SELECT role FROM users WHERE id = ?');
  const result = await stmt.bind(userId).first<{ role: string }>();
  return result?.role === 'admin';
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/lib/lot-access.ts
git commit -m "feat(lot-access): add unified household access control helper"
```

---

### Task 3: Create lot members API routes

**Files:**
- Create: `functions/routes/lot-members.ts`

- [ ] **Step 1: Create the API routes file**

```typescript
import { Hono } from 'hono';
import { authMiddleware } from '../lib/auth';
import { canAccessHousehold, isAdmin, getHouseholdMembers, getUserLots, getUserVoteCount } from '../lib/lot-access';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const lotMembers = new Hono();

// Authentication middleware for all routes
lotMembers.use('*', authMiddleware);

// GET /api/lot-members/my - Get current user's memberships
lotMembers.get('/my', async (c) => {
  const authUser = c.get('user');

  const lots = await getUserLots(authUser.userId, c.env);
  const voteCount = await getUserVoteCount(authUser.userId, c.env);

  return c.json({
    lots,
    voteCount,
    totalVotes: voteCount
  });
});

// GET /api/lot-members/household/:id - Get all members of a household
lotMembers.get('/household/:id', async (c) => {
  const authUser = c.get('user');
  const householdId = c.req.param('id');

  // Check access
  const access = await canAccessHousehold(authUser.userId, householdId, c.env);
  if (!access.hasAccess && authUser.role !== 'admin') {
    return c.json({ error: 'Access denied' }, 403);
  }

  const members = await getHouseholdMembers(householdId, c.env);

  return c.json({ householdId, members });
});

// Admin routes below
const adminLotMembers = new Hono();
adminLotMembers.use('*', authMiddleware);

// DTOs
const assignMemberSchema = z.object({
  household_id: z.string(),
  user_id: z.string(),
  member_type: z.enum(['primary_owner', 'secondary']),
  notes: z.string().optional()
});

const verifyMemberSchema = z.object({
  notes: z.string().optional()
});

// POST /api/admin/lot-members - Assign a member to a household
adminLotMembers.post('/', zValidator('json', assignMemberSchema), async (c) => {
  const authUser = c.get('user');
  const data = c.req.valid('json');

  // Admin only
  if (authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Verify lot is assignable
  const householdStmt = c.env.db.prepare(
    'SELECT lot_type FROM households WHERE id = ?'
  );
  const household = await householdStmt.bind(data.household_id).first<{ lot_type: string }>();

  if (!household) {
    return c.json({ error: 'Household not found' }, 404);
  }

  if (!['residential', 'resort', 'commercial'].includes(household.lot_type)) {
    return c.json({ error: 'Lot type not assignable' }, 400);
  }

  // Check for duplicate
  const duplicateStmt = c.env.db.prepare(
    'SELECT id FROM lot_members WHERE household_id = ? AND user_id = ?'
  );
  const duplicate = await duplicateStmt.bind(data.household_id, data.user_id).first();

  if (duplicate) {
    return c.json({ error: 'User already assigned to this household' }, 400);
  }

  // If assigning primary_owner, check if one already exists
  if (data.member_type === 'primary_owner') {
    const existingStmt = c.env.db.prepare(
      `SELECT id FROM lot_members
        WHERE household_id = ? AND member_type = 'primary_owner'`
    );
    const existing = await existingStmt.bind(data.household_id).first();

    if (existing) {
      return c.json({ error: 'Primary owner already exists for this household' }, 400);
    }
  }

  // Create membership
  const id = crypto.randomUUID();
  const canVote = data.member_type === 'primary_owner' ? 0 : 0; // Starts as 0 until verified

  const insertStmt = c.env.db.prepare(
    `INSERT INTO lot_members (id, household_id, user_id, member_type, can_vote, verified, notes)
     VALUES (?, ?, ?, ?, ?, 0, ?)`
  );

  await insertStmt.bind(id, data.household_id, data.user_id, data.member_type, canVote, data.notes || null).run();

  return c.json({
    id,
    household_id: data.household_id,
    user_id: data.user_id,
    member_type: data.member_type,
    can_vote: canVote,
    verified: false
  }, 201);
});

// PUT /api/admin/lot-members/:id/verify - Verify a membership
adminLotMembers.put('/:id/verify', zValidator('json', verifyMemberSchema), async (c) => {
  const authUser = c.get('user');
  const memberId = c.req.param('id');
  const data = c.req.valid('json');

  // Admin only
  if (authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Get current membership
  const memberStmt = c.env.db.prepare(
    'SELECT * FROM lot_members WHERE id = ?'
  );
  const member = await memberStmt.bind(memberId).first<any>();

  if (!member) {
    return c.json({ error: 'Membership not found' }, 404);
  }

  // Calculate can_vote based on member_type and verified
  const newVerified = 1;
  const newCanVote = member.member_type === 'primary_owner' ? 1 : 0;

  // Update membership
  const updateStmt = c.env.db.prepare(
    `UPDATE lot_members
     SET verified = ?, can_vote = ?, verified_at = datetime('now'), verified_by = ?, notes = ?
     WHERE id = ?`
  );

  await updateStmt.bind(newVerified, newCanVote, authUser.userId, data.notes || member.notes, memberId).run();

  return c.json({
    id: memberId,
    verified: newVerified,
    can_vote: newCanVote,
    verified_at: new Date().toISOString()
  });
});

// DELETE /api/admin/lot-members/:id - Remove a membership
adminLotMembers.delete('/:id', async (c) => {
  const authUser = c.get('user');
  const memberId = c.req.param('id');

  // Admin only
  if (authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  // Delete membership
  const deleteStmt = c.env.db.prepare('DELETE FROM lot_members WHERE id = ?');
  await deleteStmt.bind(memberId).run();

  return c.json({ success: true });
});

// GET /api/admin/lots/unassigned - Get list of unassigned assignable lots
adminLotMembers.get('/lots/unassigned', async (c) => {
  const authUser = c.get('user');

  // Admin only
  if (authUser.role !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const stmt = c.env.db.prepare(`
    SELECT h.id, h.block, h.lot, h.address, h.lot_type, h.lot_status
      FROM households h
     WHERE h.lot_type IN ('residential', 'resort', 'commercial')
       AND NOT EXISTS (
           SELECT 1 FROM lot_members lm
            WHERE lm.household_id = h.id
              AND lm.member_type = 'primary_owner'
              AND lm.verified = 1
       )
     ORDER BY h.block, h.lot
  `);

  const result = await stmt.all();
  return c.json({ lots: result.results });
});

export { lotMembers, adminLotMembers };
```

- [ ] **Step 2: Register routes in main app**

Modify `functions/index.ts` to add the new routes:

```typescript
import { lotMembers, adminLotMembers } from './routes/lot-members';

// Add to app
app.route('/api/lot-members', lotMembers);
app.route('/api/admin/lot-members', adminLotMembers);
```

- [ ] **Step 3: Commit**

```bash
git add functions/routes/lot-members.ts functions/index.ts
git commit -m "feat(api): add lot members API routes"
```

---

## Chunk 3: Phase 1 - Frontend API Client

### Task 4: Add API client methods

**Files:**
- Modify: `src/lib/api.ts`

- [ ] **Step 1: Add lot members API types and methods**

Add to `src/lib/api.ts`:

```typescript
// Lot Members types
export interface LotMember {
  id: string;
  household_id: string;
  user_id: string;
  member_type: 'primary_owner' | 'secondary';
  can_vote: boolean;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
  notes?: string;
  created_at: string;
}

export interface HouseholdMember {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_type: string;
  can_vote: boolean;
  verified: boolean;
}

export interface UserLotMemberships {
  lots: Array<{
    household_id: string;
    block: string;
    lot: string;
    address: string;
    lot_type: string;
    verified: boolean;
  }>;
  voteCount: number;
  totalVotes: number;
}

export interface UnassignedLot {
  id: string;
  block: string;
  lot: string;
  address: string;
  lot_type: string;
  lot_status: string;
}

export interface AssignMemberDto {
  household_id: string;
  user_id: string;
  member_type: 'primary_owner' | 'secondary';
  notes?: string;
}

// Lot Members API
export const lotMembersApi = {
  // Get current user's memberships
  getMyMemberships: async (): Promise<UserLotMemberships> => {
    return api.get('/lot-members/my');
  },

  // Get all members of a household
  getHouseholdMembers: async (householdId: string): Promise<{ householdId: string; members: HouseholdMember[] }> => {
    return api.get(`/lot-members/household/${householdId}`);
  },

  // Admin: Assign member to household
  assignMember: async (data: AssignMemberDto): Promise<LotMember> => {
    return api.post('/admin/lot-members', data);
  },

  // Admin: Verify membership
  verifyMember: async (id: string, notes?: string): Promise<LotMember> => {
    return api.put(`/admin/lot-members/${id}/verify`, { notes });
  },

  // Admin: Remove membership
  removeMember: async (id: string): Promise<{ success: boolean }> => {
    return api.delete(`/admin/lot-members/${id}`);
  },

  // Admin: Get unassigned lots
  getUnassignedLots: async (): Promise<{ lots: UnassignedLot[] }> => {
    return api.get('/admin/lot-members/lots/unassigned');
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(api-client): add lot members API methods"
```

---

## Chunk 4: Phase 1 - Admin UI Components

### Task 5: Create types file

**Files:**
- Create: `src/components/admin/lots/types.ts`

- [ ] **Step 1: Create admin lots types**

```typescript
export interface AdminLot {
  id: string;
  block: string;
  lot: string;
  address: string;
  lot_type: 'residential' | 'resort' | 'commercial' | 'community' | 'utility' | 'open_space';
  lot_status: 'built' | 'vacant_lot' | 'under_construction';
  ownership_status: 'owned' | 'pending' | 'unowned';
  primaryOwner?: {
    id: string;
    name: string;
    email: string;
  };
  memberCount: number;
}

export interface LotMemberDetail {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_type: 'primary_owner' | 'secondary';
  can_vote: boolean;
  verified: boolean;
  verified_at?: string;
  notes?: string;
}

export interface AssignMemberForm {
  household_id: string;
  user_id: string;
  user_email: string;
  member_type: 'primary_owner' | 'secondary';
  notes?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/lots/types.ts
git commit -m "feat(admin-lots): add TypeScript types"
```

---

### Task 6: Create AssignMemberDialog component

**Files:**
- Create: `src/components/admin/lots/AssignMemberDialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { lotMembersApi } from '@/lib/api';
import { AssignMemberForm } from './types';

interface AssignMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  onSuccess: () => void;
}

export function AssignMemberDialog({ open, onOpenChange, householdId, onSuccess }: AssignMemberDialogProps) {
  const [formData, setFormData] = useState<AssignMemberForm>({
    household_id: householdId,
    user_id: '',
    user_email: '',
    member_type: 'primary_owner',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await lotMembersApi.assignMember({
        household_id: householdId,
        user_id: formData.user_id,
        member_type: formData.member_type,
        notes: formData.notes
      });
      onSuccess();
      onOpenChange(false);
      setFormData({
        household_id: householdId,
        user_id: '',
        user_email: '',
        member_type: 'primary_owner',
        notes: ''
      });
    } catch (err: any) {
      setError(err.message || 'Failed to assign member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Household Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user_email">User Email</Label>
              <Input
                id="user_email"
                type="email"
                value={formData.user_email}
                onChange={(e) => setFormData({ ...formData, user_email: e.target.value, user_id: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Member Type</Label>
              <RadioGroup
                value={formData.member_type}
                onValueChange={(value: 'primary_owner' | 'secondary') =>
                  setFormData({ ...formData, member_type: value })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="primary_owner" id="primary_owner" />
                  <Label htmlFor="primary_owner">Primary Owner (can vote)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="secondary" id="secondary" />
                  <Label htmlFor="secondary">Secondary Member (no vote)</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="e.g., Title deed presented 2026-03-10"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Assigning...' : 'Assign Member'}
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
git add src/components/admin/lots/AssignMemberDialog.tsx
git commit -m "feat(admin-lots): add assign member dialog"
```

---

### Task 7: Create VerifyMemberDialog component

**Files:**
- Create: `src/components/admin/lots/VerifyMemberDialog.tsx`

- [ ] **Step 1: Create the verification dialog**

```typescript
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { lotMembersApi } from '@/lib/api';
import { LotMemberDetail } from './types';

interface VerifyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: LotMemberDetail | null;
  onSuccess: () => void;
}

export function VerifyMemberDialog({ open, onOpenChange, member, onSuccess }: VerifyMemberDialogProps) {
  const [notes, setNotes] = useState(member?.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!member) return;
    setLoading(true);
    setError(null);

    try {
      await lotMembersApi.verifyMember(member.id, notes);
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Failed to verify member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Verify Ownership</DialogTitle>
        </DialogHeader>
        {member && (
          <div className="py-4">
            <div className="space-y-2 mb-4">
              <p><strong>Name:</strong> {member.first_name} {member.last_name}</p>
              <p><strong>Email:</strong> {member.email}</p>
              <p><strong>Type:</strong> {member.member_type === 'primary_owner' ? 'Primary Owner' : 'Secondary'}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Verification Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Title deed verified 2026-03-10"
              />
            </div>
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleVerify} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Ownership'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/lots/VerifyMemberDialog.tsx
git commit -m "feat(admin-lots): add verify member dialog"
```

---

### Task 8: Create LotMembersList component

**Files:**
- Create: `src/components/admin/lots/LotMembersList.tsx`

- [ ] **Step 1: Create the members list component**

```typescript
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, MoreVertical } from 'lucide-react';
import { lotMembersApi } from '@/lib/api';
import { LotMemberDetail } from './types';
import { VerifyMemberDialog } from './VerifyMemberDialog';

interface LotMembersListProps {
  householdId: string;
  members: LotMemberDetail[];
  onRefresh: () => void;
}

export function LotMembersList({ householdId, members, onRefresh }: LotMembersListProps) {
  const [selectedMember, setSelectedMember] = useState<LotMemberDetail | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleVerify = (member: LotMemberDetail) => {
    setSelectedMember(member);
    setVerifyDialogOpen(true);
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    setLoading(memberId);
    try {
      await lotMembersApi.removeMember(memberId);
      onRefresh();
    } catch (err) {
      console.error('Failed to remove member:', err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Household Members</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members assigned</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {member.verified ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-yellow-600" />
                    )}
                    <div>
                      <p className="font-medium">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={member.member_type === 'primary_owner' ? 'default' : 'secondary'}>
                      {member.member_type === 'primary_owner' ? 'Primary Owner' : 'Secondary'}
                    </Badge>
                    {!member.verified && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerify(member)}
                      >
                        Verify
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemove(member.id)}
                      disabled={loading === member.id}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {selectedMember && (
        <VerifyMemberDialog
          open={verifyDialogOpen}
          onOpenChange={setVerifyDialogOpen}
          member={selectedMember}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/lots/LotMembersList.tsx
git commit -m "feat(admin-lots): add lot members list component"
```

---

### Task 9: Create LotsManagementPage component

**Files:**
- Create: `src/components/admin/lots/LotsManagementPage.tsx`

- [ ] **Step 1: Create the main lots management page**

```typescript
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Building, UserCheck, UserX, Home } from 'lucide-react';
import { lotMembersApi } from '@/lib/api';
import { AdminLot, LotMemberDetail, UnassignedLot } from './types';
import { AssignMemberDialog } from './AssignMemberDialog';
import { LotMembersList } from './LotMembersList';

export function LotsManagementPage() {
  const [lots, setLots] = useState<AdminLot[]>([]);
  const [unassignedLots, setUnassignedLots] = useState<UnassignedLot[]>([]);
  const [selectedLot, setSelectedLot] = useState<AdminLot | null>(null);
  const [members, setMembers] = useState<LotMemberDetail[]>([]);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [unassignedResp] = await Promise.all([
        lotMembersApi.getUnassignedLots()
      ]);
      setUnassignedLots(unassignedResp.lots);
      // Load lots with ownership info
      // This would need a new endpoint or we extend the unassigned one
    } catch (err) {
      console.error('Failed to load lots:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (householdId: string) => {
    try {
      const resp = await lotMembersApi.getHouseholdMembers(householdId);
      setMembers(resp.members);
    } catch (err) {
      console.error('Failed to load members:', err);
    }
  };

  const handleLotSelect = (lot: AdminLot) => {
    setSelectedLot(lot);
    loadMembers(lot.id);
  };

  const getOwnershipBadge = (lot: AdminLot) => {
    switch (lot.ownership_status) {
      case 'owned':
        return <Badge variant="default" className="gap-1"><UserCheck className="h-3 w-3" /> Owned</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><UserX className="h-3 w-3" /> Pending</Badge>;
      default:
        return <Badge variant="outline">Unowned</Badge>;
    }
  };

  const filteredUnassigned = unassignedLots.filter(lot => {
    const matchesSearch = !searchTerm ||
      lot.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${lot.block}-${lot.lot}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || lot.lot_type === filterType;
    const matchesStatus = filterStatus === 'all' || lot.lot_status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Lots Management</h1>
        <p className="text-muted-foreground">Manage lot ownership and household members</p>
      </div>

      <Tabs defaultValue="unassigned">
        <TabsList>
          <TabsTrigger value="unassigned">
            Unassigned ({unassignedLots.length})
          </TabsTrigger>
          <TabsTrigger value="assigned">
            Assigned Lots
          </TabsTrigger>
          <TabsTrigger value="all">
            All Lots
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unassigned" className="space-y-4">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by address or lot number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Lot type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="resort">Resort</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="built">Built</SelectItem>
                <SelectItem value="vacant_lot">Vacant Lot</SelectItem>
                <SelectItem value="under_construction">Under Construction</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredUnassigned.map((lot) => (
              <Card key={lot.id} className="cursor-pointer hover:bg-accent/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{lot.block}-{lot.lot}</CardTitle>
                    <Home className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">{lot.address}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{lot.lot_type}</Badge>
                    <Badge variant="secondary">{lot.lot_status}</Badge>
                  </div>
                  <Button
                    className="w-full mt-3"
                    size="sm"
                    onClick={() => {
                      setSelectedLot(lot as any);
                      setAssignDialogOpen(true);
                    }}
                  >
                    Assign Owner
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredUnassigned.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No unassigned lots match your filters
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assigned">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Assigned lots view - to be implemented with full lots list
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              All lots view - to be implemented
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedLot && (
        <>
          <LotMembersList
            householdId={selectedLot.id}
            members={members}
            onRefresh={() => {
              loadData();
              if (selectedLot) loadMembers(selectedLot.id);
            }}
          />
          <AssignMemberDialog
            open={assignDialogOpen}
            onOpenChange={setAssignDialogOpen}
            householdId={selectedLot.id}
            onSuccess={() => {
              loadData();
              if (selectedLot) loadMembers(selectedLot.id);
            }}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/lots/LotsManagementPage.tsx
git commit -m "feat(admin-lots): add main lots management page"
```

---

### Task 10: Add navigation and routing

**Files:**
- Modify: `src/pages/AdminPanel.tsx`
- Modify: `src/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add lots route to AdminPanel**

Add to `src/pages/AdminPanel.tsx`:

```typescript
// Import the component
import { LotsManagementPage } from '@/components/admin/lots/LotsManagementPage';

// Add to routes in the appropriate section
{
  path: '/admin/lots',
  element: <LotsManagementPage />
}
```

- [ ] **Step 2: Add sidebar navigation item**

Add to `src/components/layout/AdminSidebar.tsx`:

```typescript
// In the Properties section
{
  title: 'Lots',
  href: '/admin/lots',
  icon: Home,
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/AdminPanel.tsx src/components/layout/AdminSidebar.tsx
git commit -m "feat(admin): add lots management navigation"
```

---

## Chunk 5: Phase 2 - Data Backfill

### Task 11: Create backfill script

**Files:**
- Create: `scripts/backfill-lot-members.sql`

- [ ] **Step 1: Create the backfill script**

```sql
-- ================================================================
-- Phase 2 Backfill Script
-- Migrate existing ownership data to lot_members table
-- Run this after Phase 1 is verified in production
-- ================================================================

-- Verify counts before backfill
SELECT 'Current state:' as step;
SELECT
  (SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL AND lot_type IN ('residential','resort','commercial')) AS current_primary_owners,
  (SELECT COUNT(*) FROM residents WHERE user_id IS NOT NULL AND is_primary = 0) AS current_secondary_members;

-- Backfill primary owners from households.owner_id → lot_members
-- Each becomes a verified primary_owner
INSERT OR IGNORE INTO lot_members
  (id, household_id, user_id, member_type, can_vote,
   verified, verified_at, notes, created_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  h.id,
  h.owner_id,
  'primary_owner',
  1,
  1,
  h.created_at,
  'Migrated from households.owner_id',
  CURRENT_TIMESTAMP
FROM households h
WHERE h.owner_id IS NOT NULL
  AND h.lot_type IN ('residential','resort','commercial');

-- Backfill secondary members from residents table
-- Non-primary residents with user accounts become secondary members
INSERT OR IGNORE INTO lot_members
  (id, household_id, user_id, member_type, can_vote,
   verified, verified_at, notes, created_at)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
  lower(hex(randomblob(6))),
  r.household_id,
  r.user_id,
  'secondary',
  0,
  1,
  r.created_at,
  'Migrated from residents table',
  CURRENT_TIMESTAMP
FROM residents r
WHERE r.user_id   IS NOT NULL
  AND r.is_primary = 0;

-- Verification queries
SELECT 'Verification after backfill:' as step;

-- 1. Check lot_members counts
SELECT
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') AS backfilled_primary,
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'secondary') AS backfilled_secondary;

-- 2. Verify all primary_owners have can_vote = 1 and verified = 1
SELECT COUNT(*) AS primary_issues
FROM lot_members
WHERE member_type = 'primary_owner'
  AND (can_vote != 1 OR verified != 1);
-- Should return 0

-- 3. Verify no community/utility/open_space lots were migrated
SELECT COUNT(*) AS community_issues, h.lot_type
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space')
GROUP BY h.lot_type;
-- Should return 0 rows

-- 4. Show sample of migrated data
SELECT 'Sample migrated data:' as step;
SELECT
  h.block,
  h.lot,
  h.address,
  h.lot_type,
  u.email,
  lm.member_type,
  lm.can_vote,
  lm.verified,
  lm.notes
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
JOIN users u ON lm.user_id = u.id
LIMIT 10;
```

- [ ] **Step 2: Run backfill locally first**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./scripts/backfill-lot-members.sql --local
```

Expected: Output showing counts match and verification queries pass

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-lot-members.sql
git commit -m "feat(migration): add Phase 2 backfill script"
```

---

## Chunk 6: Phase 2 - API Query Updates

### Task 12: Update polls voting query

**Files:**
- Modify: `functions/routes/polls.ts`

- [ ] **Step 1: Update vote count query**

Find the vote count query and update it to use `lot_members`:

```typescript
// Old query (to be replaced)
// SELECT COUNT(*) FROM households WHERE owner_id = ? AND lot_type NOT IN ('community', 'utility', 'open_space')

// New query using lot_members
async function getUserVoteCount(userId: string, env: Env): Promise<number> {
  const stmt = env.db.prepare(`
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
  return result?.count ?? 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/routes/polls.ts
git commit -m "feat(polls): update vote count to use lot_members"
```

---

### Task 13: Update access control across all routes

**Files:**
- Modify: `functions/routes/service-requests.ts`
- Modify: `functions/routes/reservations.ts`
- Modify: `functions/routes/payments.ts`
- Modify: `functions/routes/passes.ts`

- [ ] **Step 1: Update access control pattern**

Replace the existing dual-check pattern with the new helper:

```typescript
// Import the helper
import { canAccessHousehold } from '../lib/lot-access';

// In each route that checks household access
// Old pattern:
// const household = await env.db.prepare('SELECT * FROM households WHERE id = ? AND owner_id = ?')
//   .bind(householdId, authUser.userId).first();
// if (!household && authUser.role !== 'admin') {
//   return c.json({ error: 'Access denied' }, 403);
// }

// New pattern:
const access = await canAccessHousehold(authUser.userId, householdId, env);
if (!access.hasAccess && authUser.role !== 'admin') {
  return c.json({ error: 'Access denied' }, 403);
}
```

- [ ] **Step 2: Commit**

```bash
git add functions/routes/service-requests.ts functions/routes/reservations.ts functions/routes/payments.ts functions/routes/passes.ts
git commit -m "feat(access-control): use unified lot_members access check"
```

---

## Chunk 7: Phase 3 - Cleanup Migration

### Task 14: Create cleanup migration

**Files:**
- Create: `migrations/0018_cleanup_legacy.sql`

- [ ] **Step 1: Create the cleanup migration**

```sql
-- ================================================================
-- Migration 0018: Cleanup legacy columns and tables
-- ONLY RUN AFTER PHASE 2 IS VERIFIED IN PRODUCTION
-- ================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Create new households table without legacy columns
CREATE TABLE households_new (
  id                 TEXT     PRIMARY KEY,
  address            TEXT     NOT NULL,
  street             TEXT,
  block              TEXT,
  lot                TEXT,
  latitude           REAL,
  longitude          REAL,
  map_marker_x       REAL,
  map_marker_y       REAL,
  lot_status         TEXT     DEFAULT 'vacant_lot'
                     CHECK(lot_status IN ('built','vacant_lot','under_construction')),
  lot_type           TEXT     DEFAULT 'residential'
                     CHECK(lot_type IN ('residential','resort','commercial',
                                        'community','utility','open_space')),
  lot_size_sqm       REAL,
  lot_label          TEXT,
  lot_description    TEXT,
  created_at         DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Copy data (excluding legacy columns)
INSERT INTO households_new SELECT
  id, address, street, block, lot, latitude, longitude,
  map_marker_x, map_marker_y, lot_status, lot_type,
  lot_size_sqm, lot_label, lot_description, created_at
FROM households;

-- Drop old table and rename
DROP TABLE households;
ALTER TABLE households_new RENAME TO households;

-- Recreate indexes
CREATE INDEX idx_households_block_lot  ON households(block, lot);
CREATE INDEX idx_households_street     ON households(street);
CREATE INDEX idx_households_lot_type   ON households(lot_type);

-- Drop residents table (replaced by lot_members)
DROP TABLE residents;

-- Verification
SELECT 'Cleanup complete. Verifying schema:' as step;
PRAGMA table_info(households);
SELECT 'lot_members table preserved:' as step;
SELECT COUNT(*) FROM lot_members;
```

- [ ] **Step 2: Commit**

```bash
git add migrations/0018_cleanup_legacy.sql
git commit -m "feat(migration): add Phase 3 cleanup migration"
```

---

## Chunk 8: Testing and Verification

### Task 15: Create verification script

**Files:**
- Create: `scripts/verify-migration.sql`

- [ ] **Step 1: Create verification script**

```sql
-- ================================================================
-- Migration Verification Script
-- Run after each phase to verify data integrity
-- ================================================================

.mode column
.headers on

SELECT '=== Phase 1 Verification ===' as phase;
SELECT '1. lot_members table exists:' as check;
SELECT COUNT(*) FROM lot_members;

SELECT '2. users.profile_complete column exists:' as check;
SELECT COUNT(*) FROM users WHERE profile_complete = 1;

SELECT '=== Phase 2 Verification (after backfill) ===' as phase;
SELECT '3. Primary owners migrated:' as check;
SELECT
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner') AS lot_members_primary,
  (SELECT COUNT(*) FROM households WHERE owner_id IS NOT NULL AND lot_type IN ('residential','resort','commercial')) AS households_with_owner;

SELECT '4. All primary_owners have can_vote = 1:' as check;
SELECT COUNT(*) AS issues FROM lot_members WHERE member_type = 'primary_owner' AND can_vote != 1;

SELECT '5. No community lots in lot_members:' as check;
SELECT COUNT(*) AS issues
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space');

SELECT '6. Vote count query test:' as check;
SELECT
  (SELECT COUNT(*) FROM lot_members WHERE member_type = 'primary_owner' AND can_vote = 1 AND verified = 1) AS eligible_voters;

SELECT '=== Phase 3 Verification (after cleanup) ===' as phase;
SELECT '7. owner_id column removed:' as check;
-- This will error if column still exists (expected behavior)
-- PRAGMA table_info(households) should not show owner_id

SELECT '8. residents table removed:' as check;
-- This will error if table still exists (expected behavior)
-- SELECT COUNT(*) FROM residents;

SELECT '9. lot_members still accessible:' as check;
SELECT COUNT(*) FROM lot_members;

SELECT '=== Verification Complete ===' as phase;
```

- [ ] **Step 2: Commit**

```bash
git add scripts/verify-migration.sql
git commit -m "test: add migration verification script"
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Run all migrations locally
- [ ] Run verification script locally
- [ ] Test admin UI for lot management
- [ ] Create test lot membership
- [ ] Verify access control works

### Phase 1 Deployment

- [ ] Deploy migration 0017 to production
- [ ] Deploy new API endpoints
- [ ] Deploy admin UI
- [ ] Test with real production data
- [ ] Create manual test memberships

### Phase 2 Deployment

- [ ] Run backfill script on production (backup first!)
- [ ] Verify row counts match expected
- [ ] Deploy updated API queries
- [ ] Test voting with migrated data
- [ ] Test all household-dependent features
- [ ] Monitor for errors for 1 week

### Phase 3 Deployment

- [ ] Confirm Phase 2 stable for 1+ week
- [ ] Create production backup
- [ ] Deploy cleanup migration
- [ ] Verify all features still work
- [ ] Remove transitional code

---

## Rollback Procedures

### Phase 1 Rollback

```bash
# Drop lot_members table (safe - no critical data yet)
npx wrangler d1 execute laguna_hills_hoa --local --command="DROP TABLE IF EXISTS lot_members;"
npx wrangler d1 execute laguna_hills_hoa --local --command="ALTER TABLE users DROP COLUMN profile_complete;"

# Revert code changes
git revert <commit-hash>
```

### Phase 2 Rollback

```bash
# Delete backfilled rows (safe - legacy data still exists)
DELETE FROM lot_members WHERE notes LIKE '%Migrated from%';

# Revert API changes
git revert <commit-hash>
```

### Phase 3 Rollback

```bash
# Requires restoring from backup
npx wrangler d1 execute laguna_hills_hoa --local --command="DROP TABLE households;"
# Restore households and residents from backup
```

---

## Success Criteria

- [ ] Phase 1: Migration runs without errors
- [ ] Phase 1: Admin UI functional for lot management
- [ ] Phase 2: All ownership data migrated correctly
- [ ] Phase 2: Vote counts match expected totals
- [ ] Phase 2: All household features work with new access control
- [ ] Phase 3: Legacy columns/tables dropped without issues
- [ ] Final: All tests pass, no regressions
- [ ] Final: Verification script passes all checks
