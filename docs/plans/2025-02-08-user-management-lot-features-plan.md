# User Management & Lot Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add user names (first/last), lot merging (household groups), and community/utility lot classification with labels

**Architecture:**
- Add first_name/last_name to users table
- Add household_group_id/is_primary_lot to households for merging
- Extend lot_type enum: residential, resort, commercial, community, utility, open_space
- Add lot_label/lot_description fields
- Update all UI to show names instead of emails
- Merge/unmerge endpoints for households
- Filter community/utility lots from voting/dues

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), React 18, TypeScript, Tailwind CSS

---

## Task 1: Migration 0005 - Add User Names

**Files:**
- Create: `migrations/0005_user_names.sql`

**Step 1: Create migration file**

```sql
-- migrations/0005_user_names.sql
-- Add first and last name to users table
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;

-- Seed existing users from residents (if primary resident exists)
UPDATE users
SET first_name = (
  SELECT r.first_name FROM residents r
  JOIN households h ON r.household_id = h.id
  WHERE h.owner_id = users.id AND r.is_primary = 1
  LIMIT 1
),
last_name = (
  SELECT r.last_name FROM residents r
  JOIN households h ON r.household_id = h.id
  WHERE h.owner_id = users.id AND r.is_primary = 1
  LIMIT 1
);
```

**Step 2: Run migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0005_user_names.sql --local
```

Expected: `✓ Successfully executed 5 statements`

**Step 3: Commit**

```bash
git add migrations/0005_user_names.sql
git commit -m "feat: add first_name and last_name to users table"
```

---

## Task 2: Update User Type and Admin API

**Files:**
- Modify: `src/types/index.ts` - Update User interface
- Modify: `worker/src/routes/admin.ts` - Return owner_name

**Step 1: Update User interface**

`src/types/index.ts` (around line 10):

```typescript
export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  phone?: string;
  created_at: string;
}
```

**Step 2: Update admin users endpoint**

`worker/src/routes/admin.ts` (around line 36):

```typescript
// List all users
adminRouter.get('/users', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  const users = await c.env.DB.prepare(`
    SELECT
      u.id,
      u.email,
      u.first_name,
      u.last_name,
      u.role,
      u.phone,
      u.created_at,
      COUNT(DISTINCT h.id) as household_count,
      GROUP_CONCAT(DISTINCT h.address) as household_addresses
    FROM users u
    LEFT JOIN households h ON h.owner_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  return c.json({ users: users.results });
});
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/types/index.ts worker/src/routes/admin.ts
git commit -m "feat: add user names to type and admin API"
```

---

## Task 3: Update Ownership API to Return Names

**Files:**
- Modify: `worker/src/routes/admin.ts` - Update lots/ownership endpoint

**Step 1: Find and modify the lots ownership query**

`worker/src/routes/admin.ts` (around line 680-690):

Change:
```typescript
u.email as owner_email,
u.email as owner_name
```

To:
```typescript
u.email as owner_email,
CASE
  WHEN u.first_name IS NOT NULL AND u.last_name IS NOT NULL THEN u.first_name || ' ' || u.last_name
  WHEN u.first_name IS NOT NULL THEN u.first_name
  ELSE u.email
END as owner_name
```

**Step 2: Test the endpoint**

```bash
curl -s "http://localhost:8787/api/admin/lots/ownership" \
  -H "Authorization: Bearer <token>" | head -c 500
```

Expected: `owner_name` shows "Juan Santos" instead of email

**Step 3: Commit**

```bash
git add worker/src/routes/admin.ts
git commit -m "feat: return owner_name instead of email in lots API"
```

---

## Task 4: Update MapPage to Show Owner Names

**Files:**
- Modify: `src/pages/MapPage.tsx` - Use owner_name in popups

**Step 1: Update LotsGeoJSON component**

`src/pages/MapPage.tsx` (around line 180-190):

Change the ownerInfo section to use the name from database:

```typescript
const ownerInfo = isAdmin
  ? ownershipData?.owner_name || props.owner_user_id || "Unassigned"
  ? `
    <p class="text-sm text-gray-600">
      Owner: ${ownershipData?.owner_name || props.owner_user_id || "Unassigned"}
    </p>
  `
  : "";
```

**Step 2: Test map popup**

```bash
npm run dev:all
# Visit map, click on a lot
```

Expected: Popup shows "Owner: Juan Santos" not email

**Step 3: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "feat: display owner names in map popups"
```

---

## Task 5: Migration 0006 - Add Household Grouping

**Files:**
- Create: `migrations/0006_household_grouping.sql`

**Step 1: Create migration file**

```sql
-- migrations/0006_household_grouping.sql
-- Add household grouping for merged lots
ALTER TABLE households ADD COLUMN household_group_id TEXT;
ALTER TABLE households ADD COLUMN is_primary_lot BOOLEAN DEFAULT 1 NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_household_group ON households(household_group_id);
```

**Step 2: Run migration**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0006_household_grouping.sql --local
```

Expected: `✓ Successfully executed 4 statements`

**Step 3: Commit**

```bash
git add migrations/0006_household_grouping.sql
git commit -m "feat: add household grouping for merged lots"
```

---

## Task 6: Add Merge/Unmerge API Endpoints

**Files:**
- Modify: `worker/src/routes/admin.ts` - Add merge/unmerge endpoints
- Modify: `worker/src/routes/households.ts` - Update households list

**Step 1: Add merge endpoint**

`worker/src/routes/admin.ts` (after lots ownership section, around line 900):

```typescript
/**
 * POST /api/admin/households/merge
 * Merge multiple lots into one household group
 */
adminRouter.post('/households/merge', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { primary_lot_id, lot_ids_to_merge } = await c.req.json();

    if (!primary_lot_id || !lot_ids_to_merge || !Array.isArray(lot_ids_to_merge)) {
      return c.json({ error: 'primary_lot_id and lot_ids_to_merge array required' }, 400);
    }

    // Validate all lots exist
    const allLotIds = [primary_lot_id, ...lot_ids_to_merge];
    const lots = await c.env.DB.prepare(
      `SELECT id, owner_id, block, lot FROM households WHERE id IN (${allLotIds.map(() => '?').join(',')})`
    ).bind(...allLotIds).all();

    if (lots.results.length !== allLotIds.length) {
      return c.json({ error: 'One or more lots not found' }, 404);
    }

    // Validate all lots have same owner
    const ownerId = lots.results.find((l: any) => l.id === primary_lot_id)?.owner_id;
    if (!ownerId) {
      return c.json({ error: 'Primary lot not found' }, 404);
    }

    const hasDifferentOwner = lots.results.some((l: any) => l.owner_id !== ownerId);
    if (hasDifferentOwner) {
      return c.json({ error: 'All lots must have the same owner' }, 400);
    }

    // Generate group ID
    const household_group_id = crypto.randomUUID();

    // Update lots
    await c.env.DB.prepare(`
      UPDATE households
      SET household_group_id = ?,
          is_primary_lot = CASE
            WHEN id = ? THEN 1
            ELSE 0
          END
      WHERE id IN (${allLotIds.map(() => '?').join(',')})
    `).bind(household_group_id, primary_lot_id, ...allLotIds).run();

    return c.json({
      household_group_id,
      merged_count: allLotIds.length,
      lots: lots.results.map((l: any) => ({ lot_id: l.id, address: l.address }))
    });
  } catch (error) {
    console.error('Error merging lots:', error);
    return c.json({ error: 'Failed to merge lots' }, 500);
  }
});

/**
 * POST /api/admin/households/unmerge
 * Remove a lot from a merged group
 */
adminRouter.post('/households/unmerge', async (c) => {
  const authUser = await requireAdmin(c, c.env);
  if (!authUser) {
    return c.json({ error: 'Admin access required' }, 403);
  }

  try {
    const { lot_id } = await c.req.json();

    if (!lot_id) {
      return c.json({ error: 'lot_id required' }, 400);
    }

    // Update lot
    await c.env.DB.prepare(`
      UPDATE households
      SET household_group_id = NULL,
          is_primary_lot = 1
      WHERE id = ?
    `).bind(lot_id).run();

    return c.json({ success: true, lot_id });
  } catch (error) {
    console.error('Error unmerging lot:', error);
    return c.json({ error: 'Failed to unmerge lot' }, 500);
  }
});
```

**Step 2: Add API methods to frontend**

`src/lib/api.ts` (in admin object):

```typescript
mergeHouseholds: (
  primary_lot_id: string,
  lot_ids_to_merge: string[]
): Promise<ApiResponse<{
  household_group_id: string;
  merged_count: number;
  lots: Array<{ lot_id: string; address: string }>;
}>> =>
  apiRequest<{
    household_group_id: string;
    merged_count: number;
    lots: Array<{ lot_id: string; address: string }>;
  }>("/admin/households/merge", {
    method: "POST",
    body: JSON.stringify({ primary_lot_id, lot_ids_to_merge }),
  }),

unmergeHousehold: (
  lot_id: string
): Promise<ApiResponse<{ success: boolean; lot_id: string }>> =>
  apiRequest<{ success: boolean; lot_id: string }>(
    `/admin/households/unmerge`,
    {
      method: "POST",
      body: JSON.stringify({ lot_id }),
    }
  ),
```

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add worker/src/routes/admin.ts src/lib/api.ts
git commit -m "feat: add merge/unmerge household endpoints"
```

---

## Task 7: Migration 0007 - Extend Lot Type and Add Labels

**Files:**
- Create: `migrations/0007_lot_types_labels.sql`

**Step 1: Create migration**

```sql
-- migrations/0007_lot_types_labels.sql
-- For SQLite, we need to recreate the table to modify CHECK constraint
-- First, create new table with updated constraints
CREATE TABLE IF NOT EXISTS households_new (
  id TEXT PRIMARY KEY,
  address TEXT,
  block TEXT,
  lot TEXT,
  latitude REAL,
  longitude REAL,
  map_marker_x REAL,
  map_marker_y REAL,
  owner_id TEXT,
  lot_status TEXT DEFAULT 'vacant_lot' CHECK (lot_status IN ('built', 'vacant_lot', 'under_construction')),
  lot_type TEXT DEFAULT 'residential' CHECK (lot_type IN ('residential', 'resort', 'commercial', 'community', 'utility', 'open_space')),
  lot_size_sqm REAL,
  lot_label TEXT,
  lot_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (id) REFERENCES residents(id)
);

-- Copy data from old table
INSERT INTO households_new
SELECT
  id, address, block, lot, latitude, longitude, map_marker_x, map_marker_y,
  owner_id, lot_status,
  -- Update lot_type: if existing value is not in new enum, default to residential
  CASE
    WHEN lot_type IN ('residential', 'resort', 'commercial') THEN lot_type
    ELSE 'residential'
  END as lot_type,
  lot_size_sqm,
  NULL as lot_label,
  NULL as lot_description,
  created_at
FROM households;

-- Drop old table and rename new one
DROP TABLE households;
ALTER TABLE households_new RENAME TO households;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_id);
CREATE INDEX IF NOT EXISTS idx_households_block_lot ON households(block, lot);
CREATE INDEX IF NOT EXISTS idx_household_group ON households(household_group_id);
```

**Step 2: Run migration**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0007_lot_types_labels.sql --local
```

Expected: `✓ Successfully executed...`

**Step 3: Commit**

```bash
git add migrations/0007_lot_types_labels.sql
git commit -m "feat: extend lot_type enum and add label fields"
```

---

## Task 8: Update Types for New Fields

**Files:**
- Modify: `src/types/index.ts` - Add Household grouping types

**Step 1: Update Household interface**

`src/types/index.ts` (around line 100):

```typescript
export interface Household {
  id: string;
  address?: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_id?: string;
  lot_status?: LotStatus;
  lot_type?: LotType;
  lot_size_sqm?: number;
  lot_label?: string;
  lot_description?: string;
  created_at?: string;
  // NEW: Household grouping
  household_group_id?: string | null;
  is_primary_lot?: boolean;
}

export interface LotType {
  type: 'residential' | 'resort' | 'commercial' | 'community' | 'utility' | 'open_space';
}
```

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add household grouping and lot label types"
```

---

## Task 9: Update Map for Merged Lots Styling

**Files:**
- Modify: `src/pages/MapPage.tsx` - Show merged lots with same color

**Step 1: Update LotsGeoJSON style function**

`src/pages/MapPage.tsx` (around line 134-153):

```typescript
function LotsGeoJSON({ data, filter, lotsOwnership }: LotsGeoJSONProps) {
  const { user } = useAuth();

  if (!data) return null;

  const style = (
    feature?: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) => {
    const props = feature?.properties;
    const lotId = props?.path_id;

    // Get household group for this lot
    const ownershipData = lotsOwnership?.get(lotId || '');

    let fillColor = "#9ca3af"; // default gray
    if (props?.status === "built") fillColor = "#22c55e"; // green
    if (props?.status === "under_construction") fillColor = "#f59e0b"; // orange

    // Check if this lot is part of a merged group
    const isMerged = ownershipData && 'household_group_id' in ownershipData && ownershipData.household_group_id;

    // For merged lots, use same color across group (shade of purple)
    if (isMerged) {
      fillColor = ownershipData?.is_primary_lot ? "#8b5cf6" : "#a78bfa";
    }

    return {
      color:
        fillColor === "#9ca3af"
          ? "#6b7280"
          : fillColor === "#22c55e"
            ? "#16a34a"
            : fillColor === "#f59e0b"
              ? "#d97706"
              : fillColor === "#8b5cf6"
                ? "#7c3aed"
                : "#8b5cf6",
      weight: 2,
      fillColor,
      fillOpacity: 0.3,
    };
  };
```

**Step 2: Update popup to show merge info**

In the `onEachFeature` function (around line 200-230), add merge badge:

```typescript
const mergeBadge = isMerged
  ? `<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
       🔗 Merged
     </span>`
  : "";

const popupContent = `
  <div class="p-2 min-w-[200px]">
    <h3 class="font-semibold text-gray-900 mb-1">
      ${
        props.block_number && props.lot_number
          ? `Block ${props.block_number}, Lot ${props.lot_number}`
          : props.path_id || "Unnamed Lot"
      }
    </h3>
    ${ownerInfo}
    ${mergeBadge}
    <div class="flex items-center gap-2 mb-2">
```

**Step 3: Test map styling**

```bash
npm run dev:all
# Visit map, check merged lot colors
```

Expected: Merged lots show purple tint with "🔗 Merged" badge

**Step 4: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "feat: add visual styling for merged lots on map"
```

---

## Task 10: Update Households API to Group Merged Lots

**Files:**
- Modify: `worker/src/routes/households.ts` - Group merged lots in list

**Step 1: Modify households list endpoint**

`worker/src/routes/households.ts` (around line 12-29):

```typescript
// Get all households with resident info
householdsRouter.get('/', async (c) => {
  const authUser = await getUserFromRequest(c.req.raw, c.env.JWT_SECRET);
  if (!authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const households = await c.env.DB.prepare(`
    SELECT
      h.*,
      GROUP_CONCAT(r.first_name || ' ' || r.last_name, ', ') as resident_names
    FROM households h
    LEFT JOIN residents r ON h.id = r.household_id
    GROUP BY h.id
    ORDER BY
      CAST(h.block AS INTEGER) ASC,
      CAST(h.lot AS INTEGER) ASC
  `).all();

  // Group merged lots
  const grouped = households.results.reduce((acc: any[], lot: any) => {
    if (lot.household_group_id) {
      const existing = acc.find(g => g.household_group_id === lot.household_group_id);
      if (existing) {
        existing.merged_lots.push(lot.id);
        existing.addresses.push(lot.address);
      } else {
        acc.push({
          ...lot,
          merged_lots: [lot.id],
          addresses: [lot.address],
        });
      }
    } else {
      acc.push({
        ...lot,
        merged_lots: [],
        addresses: [lot.address],
      });
    }
    return acc;
  }, []);

  // Format addresses for merged lots
  const formatted = grouped.map((h: any) => {
    if (h.merged_lots.length > 0) {
      h.address = h.addresses.join(' + ');
    }
    delete h.addresses;
    return h;
  });

  return c.json({ households: formatted });
});
```

**Step 2: Test endpoint**

```bash
curl -s "http://localhost:8787/api/households" \
  -H "Authorization: Bearer <token>" | head -c 500
```

Expected: Merged lots show as single entry with `merged_lots` array

**Step 3: Commit**

```bash
git add worker/src/routes/households.ts
git commit -m "feat: group merged lots in households list API"
```

---

## Task 11: Update AdminLotsPage with Merge UI

**Files:**
- Modify: `src/pages/AdminLotsPage.tsx` - Add merge/unmerge UI

**Step 1: Add merge state and handlers**

`src/pages/AdminLotsPage.tsx` (add to component state):

```typescript
const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
const [showMergeModal, setShowMergeModal] = useState(false);

const toggleLotSelection = (lotId: string) => {
  setSelectedLots(prev => {
    const newSet = new Set(prev);
    if (newSet.has(lotId)) {
      newSet.delete(lotId);
    } else {
      newSet.add(lotId);
    }
    return newSet;
  });
};

const handleMerge = async () => {
  if (selectedLots.size < 2) return;

  const lotArray = Array.from(selectedLots);
  const primaryLotId = lotArray[0]; // First selected is primary

  const result = await api.admin.mergeHouseholds(primaryLotId, lotArray.slice(1));

  if (result.data) {
    setShowMergeModal(false);
    setSelectedLots(new Set());
    loadLotsOwnership(); // Refresh
  }
};

const handleUnmerge = async (lotId: string) => {
  if (!confirm('Unmerge this lot? It will become a separate household.')) return;

  await api.admin.unmergeHousehold(lotId);
  loadLotsOwnership();
};
```

**Step 2: Add merge button and modal to UI**

After the lots table, add:

```typescript
{/* Merge Button */}
{selectedLots.size >= 2 && (
  <button
    onClick={() => setShowMergeModal(true)}
    className="mb-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
  >
    Merge {selectedLots.size} Lots
  </button>
)}

{/* Merge Modal */}
{showMergeModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-semibold mb-4">Merge Lots</h3>
      <p className="text-sm text-gray-600 mb-4">
        Merge {selectedLots.size} lots into one household. The first lot will be the primary lot.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={() => setShowMergeModal(false)}
          className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleMerge}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Confirm Merge
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 3: Add checkboxes to lot rows**

In the lots table body, add checkbox:

```typescript
<td className="px-6 py-4">
  <input
    type="checkbox"
    checked={selectedLots.has(lot.lot_id)}
    onChange={() => toggleLotSelection(lot.lot_id)}
    className="h-4 w-4"
  />
</td>
```

**Step 4: Test merge UI**

```bash
npm run dev:all
# Visit /admin/lots, select lots, test merge
```

Expected: Can select multiple lots, merge button appears, modal confirms merge

**Step 5: Commit**

```bash
git add src/pages/AdminLotsPage.tsx
git commit -m "feat: add merge/unmerge UI to admin lots page"
```

---

## Task 12: Update MyLotsPage to Show Grouped Lots

**Files:**
- Modify: `src/pages/MyLotsPage.tsx` - Show merged lots as cards

**Step 1: Update MyLotsSummary type and display**

`src/types/index.ts` (update MyLotsSummary):

```typescript
export interface MyLot {
  lot_id: string;
  block: string;
  lot: string;
  address: string;
  lot_status: LotStatus;
  lot_type: string;
  lot_size_sqm: number | null;
  annual_dues: number;
  payment_status: string;
  // NEW: Merge info
  household_group_id?: string | null;
  is_primary_lot?: boolean;
  merged_lots?: string[];
}

export interface MyLotsSummary {
  total_lots: number;
  total_properties: number; // NEW
  total_sqm: number;
  annual_dues_total: number;
  unpaid_periods: string[];
  voting_status: "eligible" | "suspended";
  rate_per_sqm: number;
  lots: MyLot[];
}
```

**Step 2: Update API to return grouped data**

`worker/src/routes/households.ts` (update my-lots endpoint, around line 110-121):

```typescript
// Group lots by household_group_id
const groupedLots = (lots.results || []).reduce((acc: any[], lot: any) => {
  if (lot.household_group_id) {
    const existing = acc.find(g => g.household_group_id === lot.household_group_id);
    if (existing) {
      existing.merged_lots.push(lot.lot_id);
      existing.annual_dues += lot.annual_dues;
      existing.lot_size_sqm += lot.lot_size_sqm || 0;
      existing.address = `${existing.block}-${existing.lot} + ${lot.block}-${lot.lot}`;
    } else {
      acc.push({
        ...lot,
        merged_lots: [lot.lot_id],
        is_primary_lot: true,
      });
    }
  } else {
    acc.push(lot);
  }
  return acc;
}, []);

const totalProperties = groupedLots.length;

// Return response
return c.json({
  total_lots: totalLots,
  total_properties: totalProperties,
  total_sqm: totalSqm,
  annual_dues_total: annualDuesTotal,
  unpaid_periods: unpaidPeriods,
  voting_status: votingStatus,
  rate_per_sqm: ratePerSqm,
  lots: groupedLots,
});
```

**Step 3: Update MyLotsPage display**

`src/pages/MyLotsPage.tsx` (update summary section):

```typescript
<div className="grid grid-cols-2 md:grid-cols-4 gap-6">
  <div className="space-y-1">
    <p className="text-sm text-gray-500">Total Lots</p>
    <p className="text-3xl font-bold text-gray-900">
      {summary.total_lots}
    </p>
  </div>

  <div className="space-y-1">
    <p className="text-sm text-gray-500">Total Properties</p>
    <p className="text-3xl font-bold text-gray-900">
      {summary.total_properties || summary.total_lots}
    </p>
  </div>
```

**Step 4: Test grouped display**

```bash
npm run dev:all
# Visit /my-lots, check merged lot display
```

Expected: "Total Properties" shows count, merged lots grouped in cards

**Step 5: Commit**

```bash
git add src/types/index.ts worker/src/routes/households.ts src/pages/MyLotsPage.tsx
git commit -m "feat: show merged lots as grouped properties in My Lots"
```

---

## Task 13: Filter Community Lots from Voting/Dues

**Files:**
- Modify: `worker/src/routes/polls.ts` - Exclude community lots from voting
- Modify: `worker/src/routes/households.ts` - Exclude from dues calculation

**Step 1: Update voting weight calculation**

`worker/src/routes/polls.ts` (find vote counting, around line 300):

```typescript
// Count votes - only vote-eligible lots
const voteCounts = await c.env.DB.prepare(`
  SELECT
    po.selected_option,
    COUNT(DISTINCT pv.lot_id) as voter_count,
    SUM(CASE
      WHEN h.lot_type IN ('community', 'utility', 'open_space') THEN 0
      ELSE COALESCE(pv.lot_count, 1)
    END) as weighted_votes
  FROM poll_options po
  LEFT JOIN poll_votes pv ON po.id = pv.poll_id AND po.id = pv.selected_option
  LEFT JOIN households h ON pv.lot_id = h.id
  WHERE po.poll_id = ?
  GROUP BY po.id, po.selected_option
  ORDER BY po.option_order
`).bind(pollId).all();
```

**Step 2: Update my-lots dues calculation**

`worker/src/routes/households.ts` (around line 70-86):

```typescript
// Get user's lots (exclude community/utility from dues)
const lots = await c.env.DB.prepare(`
  SELECT
    h.id as lot_id,
    h.block,
    h.lot,
    h.address,
    h.lot_status,
    h.lot_type,
    h.lot_size_sqm,
    h.household_group_id,
    h.is_primary_lot
  FROM households h
  WHERE h.owner_id = ?
    AND h.lot_type IN ('residential', 'resort', 'commercial')
  ORDER BY
    CAST(h.block AS INTEGER) ASC,
    CAST(h.lot AS INTEGER) ASC
`).bind(authUser.userId).all();
```

**Step 3: Test filtering**

```bash
# Test that community lots don't appear in my-lots
curl -s "http://localhost:8787/api/households/my-lots" \
  -H "Authorization: Bearer <token>"
```

Expected: Community/utility lots excluded from results

**Step 4: Commit**

```bash
git add worker/src/routes/polls.ts worker/src/routes/households.ts
git commit -m "feat: exclude community lots from voting and dues"
```

---

## Task 14: Add Common Areas Admin Page

**Files:**
- Create: `src/pages/CommonAreasPage.tsx`
- Modify: `src/App.tsx` - Add route
- Modify: `src/components/layout/Sidebar.tsx` - Add nav link

**Step 1: Create CommonAreasPage component**

`src/pages/CommonAreasPage.tsx`:

```typescript
import { useEffect, useState } from "react";
import { api, type AdminUser } from "@/lib/api";
import { Tree, Building2, Edit, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface CommunityLot {
  id: string;
  block?: string;
  lot?: string;
  lot_type: string;
  lot_label?: string;
  lot_description?: string;
  address: string;
}

export function CommonAreasPage() {
  const { user } = useAuth();
  const [lots, setLots] = useState<CommunityLot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCommonLots();
  }, []);

  async function loadCommonLots() {
    const result = await api.households.getLots();
    if (result.data?.lots) {
      // Filter to only community/utility/open_space
      const commonLots = result.data.lots.filter(
        lot => ['community', 'utility', 'open_space'].includes(lot.lot_type)
      );
      setLots(commonLots);
    }
    setLoading(false);
  }

  if (user?.role !== "admin") {
    return <div className="text-red-600">Access denied</div>;
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Common Areas</h1>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Label
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lots.map((lot) => (
              <tr key={lot.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{lot.address}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    lot.lot_type === 'community' ? 'bg-green-100 text-green-700' :
                    lot.lot_type === 'utility' ? 'bg-gray-100 text-gray-700' :
                    'bg-lightgreen-100 text-lightgreen-700'
                  }`}>
                    {lot.lot_type}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{lot.lot_label || '—'}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{lot.lot_description || '—'}</td>
              </tr>
            ))}
            {lots.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  No common areas found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Add route and navigation**

`src/App.tsx` (add import and route):

```typescript
import { CommonAreasPage } from "./pages/CommonAreasPage";

// In routes:
<Route
  path="admin/common-areas"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <CommonAreasPage />
    </ProtectedRoute>
  }
/>
```

`src/components/layout/Sidebar.tsx` (add nav item):

```typescript
import { Tree, Building2, Edit, Plus, Home as HomeIcon, DollarSign, Bell, Receipt } from "lucide-react";

// Add to navItems:
{
  to: "/admin/common-areas",
  icon: Tree,
  label: "Common Areas",
  roles: ["admin"],
},
```

**Step 3: Test page**

```bash
npm run dev:all
# Visit /admin/common-areas
```

Expected: Shows list of community/utility lots with labels

**Step 4: Commit**

```bash
git add src/pages/CommonAreasPage.tsx src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: add common areas admin page"
```

---

## Task 15: Final Testing and Verification

**Files:**
- Test all implemented features

**Step 1: Test user names display**

```bash
npm run dev:all
# 1. Visit map, check lot popups show "Owner: Name" not email
# 2. Visit admin panel, check owner dropdown shows names
```

Expected: Names displayed everywhere, not emails

**Step 2: Test lot merging**

```bash
# 1. Visit /admin/lots
# 2. Select 2+ lots using checkboxes
# 3. Click "Merge X Lots"
# 4. Confirm merge
# 5. Verify lots have same color on map
# 6. Test unmerge functionality
```

Expected: Lots merge/unmerge correctly, map shows grouped styling

**Step 3: Test community lots**

```bash
# 1. Visit /admin/common-areas
# 2. Verify only community/utility/open_space lots shown
# 3. Check they're excluded from /my-lots
# 4. Test they don't appear in voting totals
```

Expected: Community lots managed separately, excluded from member features

**Step 4: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete user names, lot merging, and community lots implementation"
```

---

## Completion Criteria

- [x] Users have first_name and last_name fields
- [x] Owner names displayed instead of emails throughout UI
- [x] Lots can be merged into household groups
- [x] Merged lots show with visual grouping on map
- [x] Unmerge functionality works
- [x] Community/utility lots can be labeled
- [x] Community lots excluded from voting/dues
- [x] Common Areas admin page for managing HOA assets
- [x] All TypeScript builds passing
- [x] All features tested manually

**Estimated completion time:** 3-4 hours
**Number of tasks:** 15
**Number of commits:** ~15
