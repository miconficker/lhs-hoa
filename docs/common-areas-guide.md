# Adding Common Areas to Laguna Hills HOA

This guide explains how to add and manage common areas (HOA-owned properties like parks, utilities, and open spaces) in the Laguna Hills HOA system.

## What Are Common Areas?

Common areas are HOA-owned properties that:
- Are **not** owned by individual residents
- **Do not** pay dues
- **Do not** have voting rights
- Include: parks, playgrounds, water towers, drainage canals, open spaces, etc.

## How to Add Common Areas

### Method 1: Via Lot Management Page (Easiest!)

1. **Navigate to Lot Management**
   - Log in as admin
   - Go to **Admin Panel** → **Lot Management** (or visit `/admin/lots`)

2. **Select the Lot to Mark as Common Area**
   - Click on the lot on the map
   - The lot details will appear in the side panel

3. **Set Owner to "No Owner"**
   - In the "Owner" dropdown, select **"No Owner (HOA-Owned / Common Area)"**
   - This sets `owner_user_id = 'developer-owner'` in the database

4. **Set the Lot Type**
   - In the "Lot Type" dropdown, select the appropriate type:
     - **Community** → Parks, playgrounds, basketball courts, etc.
     - **Utility** → Water towers, drainage canals, pump stations, etc.
     - **Open Space** → Gardens, green belts, landscaping areas, etc.
   - A helpful note will appear: "HOA-owned lots don't pay dues or vote"

5. **Click Save**
   - That's it! The lot is now marked as a common area

### Method 2: Direct Database Update

5. **Click Save**
   - That's it! The lot is now marked as a common area

### Method 2: Direct Database Update (Advanced / Batch Operations)

For batch updates or advanced users, you can modify the database directly:

```sql
-- Mark a lot as a common area (e.g., park, playground)
UPDATE households
SET lot_type = 'community',
    lot_label = 'Basketball Court',
    lot_description = 'Multi-use sport court with basketball and volleyball hoops',
    owner_user_id = 'developer-owner'
WHERE block = 'B' AND lot = '01';

-- Mark a lot as utility (e.g., water tower, drainage)
UPDATE households
SET lot_type = 'utility',
    lot_label = 'Water Tower #1',
    lot_description = 'Pressurized water system for the subdivision',
    owner_user_id = 'developer-owner'
WHERE block = 'U' AND lot = '01';

-- Mark a lot as open space (e.g., garden, green belt)
UPDATE households
SET lot_type = 'open_space',
    lot_label = 'Central Park',
    lot_description = 'Main garden area with walking paths',
    owner_user_id = 'developer-owner'
WHERE block = 'C' AND lot = '02';

-- Batch: Mark all lots with block "C" as community areas
UPDATE households
SET lot_type = 'community',
    owner_user_id = 'developer-owner'
WHERE block = 'C';
```

## Lot Types Explained

| Type | Description | Pays Dues | Can Vote |
|------|-------------|-----------|----------|
| `residential` | Private homes | ✅ | ✅ |
| `resort` | Commercial/resort lots | ✅ | ✅ |
| `commercial` | Business lots | ✅ | ✅ |
| `community` | HOA parks, facilities | ❌ | ❌ |
| `utility` | Infrastructure (water, drainage) | ❌ | ❌ |
| `open_space` | Green spaces, gardens | ❌ | ❌ |

## Viewing Common Areas

Once added, common areas appear in several places:

1. **Common Areas Page** (`/admin/common-areas`)
   - Lists all community, utility, and open space lots
   - Shows labels and descriptions
   - Only visible to admins

2. **Subdivision Map**
   - Common areas are visible on the map
   - They appear with different styling than residential lots

3. **Voting Calculations**
   - Common areas are automatically excluded from vote totals
   - They don't count toward the "lots voted" number

4. **Dues Calculations**
   - Common areas are excluded from dues calculations
   - They don't appear in "My Lots" for residents

## Adding Labels and Descriptions

Labels and descriptions help identify common areas on the map and admin pages:

```sql
-- Add a helpful label
UPDATE households
SET lot_label = 'Basketball Court & Playground'
WHERE block = 'C' AND lot = '01';

-- Add a detailed description
UPDATE households
SET lot_description = 'Multi-purpose recreational area with:
- Full basketball court
- Children''s playground with swings and slides
- Benches and shaded seating areas
- Night lighting until 10 PM'
WHERE block = 'C' AND lot = '01';
```

## Best Practices

1. **Use Descriptive Labels**
   - "Basketball Court" is better than "Court #1"
   - "Water Tower - North Section" is better than "WT-1"

2. **Include Utility Details**
   - For utilities, mention capacity or function
   - Example: "Water Tower - 50,000 gallon capacity"

3. **Track Maintenance Needs**
   - Use descriptions to note maintenance schedules
   - Example: "Drainage canal - cleaned quarterly before rainy season"

4. **Keep Ownership Clear**
   - Always set `owner_user_id = 'developer-owner'` for common areas
   - This prevents them from appearing in resident accounts

## Troubleshooting

**Q: A common area is still showing up in "My Lots"**
- Make sure `lot_type` is set to `community`, `utility`, or `open_space`
- Verify `owner_id` is NULL

**Q: Common area is still included in voting totals**
- Check that the lot_type matches one of the non-voting types
- Restart the worker to ensure changes take effect

**Q: Label isn't showing on the map**
- Labels are currently admin-only
- They appear on the Common Areas page, not on the public map

## Migration Script Example

Here's a helpful script to mark multiple lots as common areas:

```sql
-- Example: Mark all lots with block "C" as community areas
UPDATE households
SET lot_type = 'community',
    owner_user_id = 'developer-owner'
WHERE block = 'C';

-- Example: Mark specific lots as utility
UPDATE households
SET lot_type = 'utility',
    owner_user_id = 'developer-owner'
WHERE block IN ('U') AND lot IN ('01', '02', '03');
```
