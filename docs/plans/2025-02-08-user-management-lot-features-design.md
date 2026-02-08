# User Management & Lot Features Design

**Document Version:** 1.0
**Date:** 2025-02-08
**Status:** Ready for Implementation

---

## Overview

This design enhances the HOA system with improved user management (names instead of emails), lot merging capabilities (single household spanning multiple lots), and classification of community/utility lots.

## Part 1: User Names

### Problem
Current system displays email addresses for lot ownership (e.g., "admin-user@lagunahills.com"). This is not user-friendly and doesn't reflect how HOA members identify each other.

### Solution
Add name fields to the users table and display names throughout the system.

### Database Changes

```sql
-- Add name fields to users table
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

### API Changes

**Modified endpoints to return owner_name:**
- `/api/admin/lots/ownership` - Returns `owner_name` (first_name + last_name)
- `/api/households/map/locations` - Returns owner names for admin users
- `/api/admin/homeowners` - Returns users with names

### UI Changes

**Map popups:**
```
Owner: Juan Santos
```

**Admin dropdowns:**
```
Select Owner:
[ ] Juan Santos (admin@lagunahills.com)
[ ] Maria Reyes (maria@email.com)
```

---

## Part 2: Merged Lots

### Problem
A single house can be built across multiple lots (e.g., B01-L01 and B01-L02). For household recording, this should be one entry, but dues and voting are still calculated per lot.

### Solution
Add household grouping functionality to the households table.

### Database Changes

```sql
-- Add grouping fields to households table
ALTER TABLE households ADD COLUMN household_group_id TEXT;
ALTER TABLE households ADD COLUMN is_primary_lot BOOLEAN DEFAULT 1;
CREATE INDEX idx_household_group ON households(household_group_id);
```

### Data Model

**Example merged household:**
```
| lot_id | household_group_id | is_primary_lot | owner_id |
|--------|-------------------|----------------|----------|
| B01-L01 | grp-001           | TRUE          | user-123 |
| B01-L02 | grp-001           | FALSE         | user-123 |
| B03-L05 | NULL              | TRUE          | user-456 |
```

### API Endpoints

**POST /api/admin/households/merge**
- Merges multiple lots into one household group
- Validates all lots have same owner
- Returns new household_group_id

```json
Request: {
  primary_lot_id: "B01-L01",
  lot_ids_to_merge: ["B01-L02", "B01-L03"]
}
Response: {
  household_group_id: "grp-001",
  merged_count: 3,
  lots: [{ lot_id, address }, ...]
}
```

**POST /api/admin/households/unmerge**
- Removes a lot from a merged group
- Makes it an independent household

```json
Request: { lot_id: "B01-L02" }
Response: { success: true, lot_id: "B01-L02" }
```

**GET /api/households (modified)**
- Returns merged lots as single entries

```json
{
  households: [{
    id: "B01-L01",
    household_group_id: "grp-001",
    is_primary_lot: true,
    merged_lots: ["B01-L01", "B01-L02"],
    address: "Block 1, Lot 1-2",
    owner_name: "Juan Santos",
    residents: [{ first_name, last_name }]
  }]
}
```

### UI Changes

**Admin Panel → Households:**
- Multi-select lots from list or map
- "Merge Lots" button when 2+ lots selected
- Modal to select primary lot
- "Unmerge" button for secondary lots

**Map Display:**
- Merged lots highlighted with same color
- Badge: "🔗 Merged"
- Primary lot shows full popup with residents
- Secondary lots: "Merged with B01-L01"

**My Lots Page:**
- Grouped display: "Your Lots (5 properties, 7 lots)"
- Merged lots shown as one card

---

## Part 3: Community & Utility Lots

### Problem
HOAs own and maintain common areas (parks, water towers, drainage) that should be tracked but aren't member-owned and don't pay dues or vote.

### Solution
Extend lot_type classification and add labeling system for community/utility lots.

### Database Changes

```sql
-- Extend lot_type enum
ALTER TABLE households MODIFY COLUMN lot_type TEXT
  CHECK (lot_type IN (
    'residential',   -- Private homes
    'resort',        -- Commercial/resort lots
    'commercial',    -- Business lots
    'community',     -- HOA-owned common areas
    'utility',       -- Infrastructure
    'open_space'     -- Green spaces
  ));

-- Add labeling fields
ALTER TABLE households ADD COLUMN lot_label TEXT;
ALTER TABLE households ADD COLUMN lot_description TEXT;
```

### Lot Type Behaviors

| lot_type    | Dues | Voting | Owner | Shown In |
|-------------|------|--------|-------|-----------|
| residential | ✅   | ✅     | Required | My Lots, Map |
| resort      | ✅   | ✅     | Required | My Lots, Map |
| commercial  | ✅   | ✅     | Required | My Lots, Map |
| community   | ❌   | ❌     | NULL (HOA) | Admin, Map |
| utility     | ❌   | ❌     | NULL (HOA) | Admin, Map |
| open_space  | ❌   | ❌     | NULL (HOA) | Admin, Map |

### Examples

```
| lot_id | lot_type     | lot_label           | lot_description        |
|--------|-------------|---------------------|-----------------------|
| B01-L01 | residential | NULL                | Private residence      |
| C01    | community   | "Basketball Court"  | Multi-use sport court |
| C02    | open_space  | "Central Park"      | Main garden area      |
| U01    | utility     | "Water Tower #1"    | Pressurized system    |
| U02    | utility     | "Drainage Canal"    | Flood control         |
```

### UI Changes

**Map Styling:**
- Community: Green border, park icon
- Utility: Gray border, infrastructure icon
- Open Space: Light green, tree icon
- Badge: "HOA-Owned" or "Common Area"

**Admin Panel → Common Areas:**
- List all community/utility lots
- Edit labels and descriptions
- Track maintenance schedules

---

## Implementation Checklist

### Phase 1: Database Migrations
- [ ] Migration 0005: Add user names (first_name, last_name)
- [ ] Migration 0006: Add household grouping (household_group_id, is_primary_lot)
- [ ] Migration 0007: Extend lot_type enum and add label fields
- [ ] Seed user names from existing residents

### Phase 2: Backend API
- [ ] Add merge/unmerge endpoints to households
- [ ] Modify households list to group merged lots
- [ ] Update ownership endpoints to return owner_name
- [ ] Exclude community lots from voting/dues calculations
- [ ] Add community lots CRUD for admin

### Phase 3: Frontend
- [ ] Update MapPage to show owner names
- [ ] Add merge/unmerge UI to AdminLotsPage
- [ ] Update map styling for merged lots
- [ ] Update MyLotsPage to show grouped lots
- [ ] Add Common Areas admin page
- [ ] Update all dropdowns to show "Name (email)"

### Phase 4: Testing
- [ ] Test lot merging/unmerging
- [ ] Test name display across all pages
- [ ] Test community lot exclusion from voting
- [ ] Verify map displays for all lot types

---

## Open Questions

1. Should there be a visual distinction in the admin panel between "Merged" and "Single Lot" households?
2. For notification history, should merged lots show notifications for all lots or just the primary?
3. Should lot labels be visible to non-admin users on the map, or admin-only?
