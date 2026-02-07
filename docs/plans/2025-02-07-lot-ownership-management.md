# Lot Ownership Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add admin functionality to associate lots with homeowners, support multiple lots per owner, and display lot ownership on the map with proper security.

**Architecture:**
- Add `owner_user_id`, `lot_status`, `lot_size_sqm` columns to households table
- Create admin-only API endpoints for lot ownership management
- Build two UI approaches: map-based lot selector and admin table view
- Secure personal data: only admins see owner information

**Tech Stack:**
- Backend: Cloudflare Workers + Hono + D1 (SQLite)
- Frontend: React + TypeScript + Leaflet + React Leaflet
- Auth: JWT-based role checking (admin/staff/resident/guest)

---

## Task 1: Database Migration - Add Lot Ownership Fields

**Files:**
- Create: `migrations/0002_add_lot_ownership.sql`

**Step 1: Create migration file**

```sql
-- Migration: Add lot ownership fields to households table
-- Date: 2025-02-07

-- Add new columns to households table
ALTER TABLE households
  ADD COLUMN owner_user_id TEXT NOT NULL DEFAULT 'developer-owner',
  ADD COLUMN lot_status TEXT DEFAULT 'vacant_lot' CHECK (lot_status IN ('built', 'vacant_lot', 'under_construction')),
  ADD COLUMN lot_size_sqm NUMBER;

-- Create developer owner account if not exists
INSERT OR IGNORE INTO users (id, email, role, password_hash)
VALUES ('developer-owner', 'developer@lagunahills.com', 'admin',
        -- This is a placeholder; admin should set a real password
        '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');

-- Create index on owner_user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_households_owner_user_id ON households(owner_user_id);

-- Create index on lot_status for filtering
CREATE INDEX IF NOT EXISTS idx_households_lot_status ON households(lot_status);
```

**Step 2: Apply migration locally**

```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0002_add_lot_ownership.sql --local
```

**Step 3: Verify migration applied**

```bash
npx wrangler d1 execute laguna_hills_hoa --local --command "PRAGMA table_info(households);"
```

Expected: Columns `owner_user_id`, `lot_status`, `lot_size_sqm` listed

**Step 4: Commit**

```bash
git add migrations/0002_add_lot_ownership.sql
git commit -m "feat: add lot ownership fields to households table"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types**

After the `Household` interface (around line 22), add:

```typescript
// Lot Status enum
export type LotStatus = "built" | "vacant_lot" | "under_construction";

// Update Household interface with new fields
export interface Household {
  id: string;
  address: string;
  block?: string;
  lot?: string;
  latitude?: number;
  longitude?: number;
  map_marker_x?: number;
  map_marker_y?: number;
  owner_user_id: string;       // NEW: Always required, defaults to developer-owner
  lot_status: LotStatus;       // NEW: built, vacant_lot, under_construction
  lot_size_sqm?: number;       // NEW: Lot size in m² (nullable)
  created_at: string;
}

// New: Household with owner information populated
export interface HouseholdWithOwner extends Household {
  owner_name?: string;         // Populated by JOIN
  owner_email?: string;
  owner_role?: UserRole;
}

// New: Lot ownership data for admin
export interface LotOwnership {
  lot_id: string;
  lot_number: string;
  block_number: string;
  owner_user_id: string;
  owner_name: string;
  owner_email: string;
  lot_status: LotStatus;
  lot_size_sqm?: number;
  address?: string;
}

// New: Array of lot ownership for admin list
export type LotOwnershipList = LotOwnership[];
```

**Step 2: Update LotFeatureProperties**

Update the `LotFeatureProperties` interface (around line 194):

```typescript
export interface LotFeatureProperties {
  path_id: string;
  lot_number: string | null;
  block_number: string | null;
  area_sqm: number | null;
  status: LotStatus;           // CHANGED: now uses LotStatus
  owner_user_id?: string;      // NEW
  owner_name?: string;         // NEW: only included for admin users
  lot_size_sqm?: number;       // NEW
  household_id?: string;
  residents?: string;
}
```

**Step 3: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add lot ownership and status types"
```

---

## Task 3: Backend - Admin API Endpoints for Lot Ownership

**Files:**
- Modify: `src/index.ts` (Cloudflare Worker entry point)

**Step 1: Add admin lot ownership endpoints**

After the existing admin endpoints, add:

```typescript
// =============================================================================
// ADMIN: Lot Ownership Management
// =============================================================================

/**
 * GET /api/admin/lots/ownership
 * Get all lots with ownership information (admin only)
 */
app.get('/api/admin/lots/ownership', async (c) => {
  // Verify admin role
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    // Get lots with owner information
    const lots = await c.env.DB.prepare(`
      SELECT
        h.id as lot_id,
        h.block as block_number,
        h.lot as lot_number,
        h.address,
        h.owner_user_id,
        h.lot_status,
        h.lot_size_sqm,
        u.email as owner_email,
        u.first_name || ' ' || u.last_name as owner_name
      FROM households h
      LEFT JOIN users u ON h.owner_user_id = u.id
      ORDER BY
        CAST(h.block AS INTEGER) ASC,
        CAST(h.lot AS INTEGER) ASC
    `).all();

    return c.json({ data: { lots: lots.results || [] } });
  } catch (error) {
    console.error('Error fetching lot ownership:', error);
    return c.json({ error: 'Failed to fetch lot ownership' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/owner
 * Assign or change owner for a lot (admin only)
 */
app.put('/api/admin/lots/:lotId/owner', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const lotId = c.req.param('lotId');
  const { owner_user_id } = await c.req.json();

  if (!owner_user_id) {
    return c.json({ error: 'owner_user_id is required' }, 400);
  }

  try {
    // Verify lot exists
    const lot = await c.env.DB.prepare(
      'SELECT id FROM households WHERE id = ?'
    ).bind(lotId).first();

    if (!lot) {
      return c.json({ error: 'Lot not found' }, 404);
    }

    // Verify owner exists
    const owner = await c.env.DB.prepare(
      'SELECT id, role FROM users WHERE id = ?'
    ).bind(owner_user_id).first();

    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }

    // Update lot owner
    await c.env.DB.prepare(
      'UPDATE households SET owner_user_id = ? WHERE id = ?'
    ).bind(owner_user_id, lotId).run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error updating lot owner:', error);
    return c.json({ error: 'Failed to update lot owner' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/status
 * Update lot status (admin only)
 */
app.put('/api/admin/lots/:lotId/status', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const lotId = c.req.param('lotId');
  const { lot_status } = await c.req.json();

  if (!lot_status || !['built', 'vacant_lot', 'under_construction'].includes(lot_status)) {
    return c.json({ error: 'Invalid lot_status' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_status = ? WHERE id = ?'
    ).bind(lot_status, lotId).run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error updating lot status:', error);
    return c.json({ error: 'Failed to update lot status' }, 500);
  }
});

/**
 * PUT /api/admin/lots/:lotId/size
 * Update lot size (admin only)
 */
app.put('/api/admin/lots/:lotId/size', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const lotId = c.req.param('lotId');
  const { lot_size_sqm } = await c.req.json();

  // Allow null (clearing the value)
  if (lot_size_sqm !== null && lot_size_sqm !== undefined && (typeof lot_size_sqm !== 'number' || lot_size_sqm < 0)) {
    return c.json({ error: 'Invalid lot_size_sqm' }, 400);
  }

  try {
    await c.env.DB.prepare(
      'UPDATE households SET lot_size_sqm = ? WHERE id = ?'
    ).bind(lot_size_sqm ?? null, lotId).run();

    return c.json({ data: { success: true } });
  } catch (error) {
    console.error('Error updating lot size:', error);
    return c.json({ error: 'Failed to update lot size' }, 500);
  }
});

/**
 * GET /api/admin/homeowners
 * Get list of all homeowners for dropdown (admin only)
 */
app.get('/api/admin/homeowners', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  try {
    // Get all users with resident role, plus developer account
    const homeowners = await c.env.DB.prepare(`
      SELECT
        id,
        email,
        first_name,
        last_name,
        role
      FROM users
      WHERE role IN ('resident', 'admin')
      ORDER BY role DESC, last_name ASC, first_name ASC
    `).all();

    return c.json({ data: { homeowners: homeowners.results || [] } });
  } catch (error) {
    console.error('Error fetching homeowners:', error);
    return c.json({ error: 'Failed to fetch homeowners' }, 500);
  }
});

/**
 * PUT /api/admin/lots/batch/owner
 * Batch assign owner to multiple lots (admin only)
 */
app.put('/api/admin/lots/batch/owner', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { lot_ids, owner_user_id } = await c.req.json();

  if (!Array.isArray(lot_ids) || lot_ids.length === 0) {
    return c.json({ error: 'lot_ids must be a non-empty array' }, 400);
  }

  if (!owner_user_id) {
    return c.json({ error: 'owner_user_id is required' }, 400);
  }

  try {
    // Verify owner exists
    const owner = await c.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(owner_user_id).first();

    if (!owner) {
      return c.json({ error: 'Owner not found' }, 404);
    }

    // Batch update
    const placeholders = lot_ids.map(() => '?').join(',');
    await c.env.DB.prepare(
      `UPDATE households SET owner_user_id = ? WHERE id IN (${placeholders})`
    ).bind(owner_user_id, ...lot_ids).run();

    return c.json({ data: { success: true, count: lot_ids.length } });
  } catch (error) {
    console.error('Error batch updating lot owner:', error);
    return c.json({ error: 'Failed to batch update lot owner' }, 500);
  }
});
```

**Step 2: Commit**

```bash
git add src/index.ts
git commit -m "feat: add admin lot ownership API endpoints"
```

---

## Task 4: Frontend - Update API Client

**Files:**
- Modify: `src/lib/api.ts`

**Step 1: Add lot ownership API methods**

Find the `admin` object in the API and add these methods:

```typescript
// Inside the admin object, add:

// Get all lots with ownership information
getLotsWithOwnership: async (): Promise<ApiResponse<LotOwnershipList>> => {
  return apiGet<LotOwnershipList>('/admin/lots/ownership');
},

// Assign owner to a lot
assignLotOwner: async (lotId: string, ownerId: string): Promise<ApiResponse<{ success: boolean }>> => {
  return apiPut<{ success: boolean }>(`/admin/lots/${lotId}/owner`, { owner_user_id: ownerId });
},

// Update lot status
updateLotStatus: async (lotId: string, status: LotStatus): Promise<ApiResponse<{ success: boolean }>> => {
  return apiPut<{ success: boolean }>(`/admin/lots/${lotId}/status`, { lot_status: status });
},

// Update lot size
updateLotSize: async (lotId: string, size: number | null): Promise<ApiResponse<{ success: boolean }>> => {
  return apiPut<{ success: boolean }>(`/admin/lots/${lotId}/size`, { lot_size_sqm: size });
},

// Get list of homeowners
getHomeowners: async (): Promise<ApiResponse<User[]>> => {
  return apiGet<User[]>('/admin/homeowners');
},

// Batch assign owner to multiple lots
batchAssignOwner: async (lotIds: string[], ownerId: string): Promise<ApiResponse<{ success: boolean; count: number }>> => {
  return apiPut<{ success: boolean; count: number }>('/admin/lots/batch/owner', {
    lot_ids: lotIds,
    owner_user_id: ownerId
  });
},
```

**Step 2: Verify types**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat: add lot ownership API methods"
```

---

## Task 5: Frontend - Create Admin Lots Page (Map-Based)

**Files:**
- Create: `src/pages/AdminLotsPage.tsx`

**Step 1: Create the component**

```typescript
import { useEffect, useState } from "react";
import {
  MapContainer,
  ImageOverlay,
  GeoJSON,
  Popup,
} from "react-leaflet";
import { LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import {
  LotOwnership,
  LotStatus,
  User,
  LotFeatureProperties,
} from "@/types";
import {
  Map,
  Save,
  X,
  Home,
  Building2,
  Search,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MAP_WIDTH = 2304;
const MAP_HEIGHT = 3456;
const mapBounds: LatLngBoundsExpression = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
];

interface LotWithOwnership extends LotOwnership {
  featureId?: string;
}

export function AdminLotsPage() {
  const { user } = useAuth();
  const [lots, setLots] = useState<LotWithOwnership[]>([]);
  const [homeowners, setHomeowners] = useState<User[]>([]);
  const [geojsonData, setGeojsonData] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedLot, setSelectedLot] = useState<LotWithOwnership | null>(
    null,
  );
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<LotStatus>("vacant_lot");
  const [lotSize, setLotSize] = useState<number>("");
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [highlightOwnerId, setHighlightOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [lotsResult, homeownersResult, geoResponse] = await Promise.all([
        api.admin.getLotsWithOwnership(),
        api.admin.getHomeowners(),
        fetch(`/data/lots.geojson?t=${Date.now()}`),
      ]);

      if (lotsResult.data) {
        setLots(lotsResult.data.lots);
      }

      if (homeownersResult.data) {
        setHomeowners(homeownersResult.data.homeowners);
      }

      if (geoResponse.ok) {
        const geo = await geoResponse.json();
        setGeojsonData(geo);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  }

  function handleLotClick(lotId: string) {
    const lot = lots.find((l) => l.lot_id === lotId);
    if (lot) {
      setSelectedLot(lot);
      setSelectedOwner(lot.owner_user_id);
      setSelectedStatus(lot.lot_status);
      setLotSize(lot.lot_size_sqm?.toString() || "");
    }
  }

  function handleLotToggle(lotId: string) {
    const newSelected = new Set(selectedLots);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedLots(newSelected);
  }

  async function handleSave() {
    if (!selectedLot) return;

    setSaving(true);
    try {
      await Promise.all([
        api.admin.assignLotOwner(selectedLot.lot_id, selectedOwner),
        api.admin.updateLotStatus(selectedLot.lot_id, selectedStatus),
        api.admin.updateLotSize(
          selectedLot.lot_id,
          lotSize ? parseFloat(lotSize) : null,
        ),
      ]);

      // Reload data
      await loadData();
      setSelectedLot(null);
    } catch (error) {
      console.error("Error saving lot:", error);
      alert("Failed to save lot changes");
    }
    setSaving(false);
  }

  async function handleBatchAssign() {
    if (selectedLots.size === 0 || !selectedOwner) return;

    if (
      !confirm(
        `Assign ${selectedLots.size} lot(s) to ${
          homeowners.find((h) => h.id === selectedOwner)?.email ||
          "this owner"
        }?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await api.admin.batchAssignOwner(
        Array.from(selectedLots),
        selectedOwner,
      );

      await loadData();
      setSelectedLots(new Set());
    } catch (error) {
      console.error("Error batch assigning:", error);
      alert("Failed to batch assign lots");
    }
    setSaving(false);
  }

  function getLotStyle(
    feature: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) {
    const props = feature.properties;
    const lotId = props?.path_id;

    const isSelected = selectedLot?.lot_id === lotId;
    const isMultiSelected = selectedLots.has(lotId || "");
    const isHighlighted = highlightOwnerId && props?.owner_user_id === highlightOwnerId;

    let fillColor = "#9ca3af"; // default gray
    if (props?.lot_status === "built") fillColor = "#22c55e"; // green
    if (props?.lot_status === "under_construction") fillColor = "#f59e0b"; // orange

    return {
      color: isSelected
        ? "#2563eb"
        : isHighlighted
          ? "#eab308"
          : "#6b7280",
      weight: isSelected || isMultiSelected || isHighlighted ? 3 : 2,
      fillColor,
      fillOpacity: isSelected || isMultiSelected ? 0.5 : isHighlighted ? 0.4 : 0.2,
    };
  }

  if (user?.role !== "admin") {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-4 rounded-lg">
        Access denied. Admin privileges required.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lot Ownership Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Click lots to assign owners and update status
          </p>
        </div>
        {selectedLots.size > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">
              {selectedLots.size} lot(s) selected
            </span>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select owner...</option>
              {homeowners.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.email}
                </option>
              ))}
            </select>
            <button
              onClick={handleBatchAssign}
              disabled={!selectedOwner || saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Assign to {selectedLots.size} lots
            </button>
            <button
              onClick={() => setSelectedLots(new Set())}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden">
          <div className="relative h-[700px]">
            <MapContainer
              crs={L.CRS.Simple}
              bounds={mapBounds}
              style={{ height: "100%", width: "100%" }}
            >
              <ImageOverlay
                url="/LAGUNA-HILLS-MAP.svg.2026_01_23_14_02_46.0.png"
                bounds={mapBounds}
                opacity={1}
              />
              {geojsonData && (
                <GeoJSON
                  data={geojsonData}
                  style={getLotStyle}
                  onEachFeature={(feature, layer) => {
                    const props = feature.properties as LotFeatureProperties;
                    const lotId = props?.path_id;

                    if (lotId) {
                      layer.on({
                        click: (e) => {
                          L.DomEvent.stopPropagation(e);
                          if (e.originalEvent.ctrlKey) {
                            handleLotToggle(lotId);
                          } else {
                            handleLotClick(lotId);
                          }
                        },
                      });
                    }

                    // Popup with info
                    const lot = lots.find((l) => l.lot_id === lotId);
                    if (lot || props) {
                      const popupContent = `
                        <div class="p-2 min-w-[200px]">
                          <h3 class="font-semibold text-gray-900 mb-1">
                            ${lot?.block_number && lot?.lot_number
                              ? `Block ${lot.block_number}, Lot ${lot.lot_number}`
                              : props?.path_id || "Unnamed Lot"}
                          </h3>
                          <p class="text-sm text-gray-600">
                            Owner: ${lot?.owner_name || "Unknown"}
                          </p>
                          <p class="text-sm text-gray-600">
                            Status: ${lot?.lot_status || "vacant_lot"}
                          </p>
                          ${lot?.lot_size_sqm
                            ? `<p class="text-sm text-gray-600">Size: ${lot.lot_size_sqm} m²</p>`
                            : ""}
                          ${selectedLots.has(lotId || "")
                            ? '<p class="text-xs text-blue-600 mt-1">✓ Selected</p>'
                            : ""}
                          <p class="text-xs text-gray-500 mt-2">Ctrl+click to multi-select</p>
                        </div>
                      `;
                      layer.bindPopup(popupContent);
                    }
                  }}
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {selectedLot ? (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Lot
                </h3>
                <button
                  onClick={() => setSelectedLot(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedLot.block_number && selectedLot.lot_number
                      ? `Block ${selectedLot.block_number}, Lot ${selectedLot.lot_number}`
                      : selectedLot.address || "Unnamed Lot"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner
                  </label>
                  <select
                    value={selectedOwner}
                    onChange={(e) => setSelectedOwner(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {homeowners.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.email}
                      </option>
                    ))}
                  </select>
                  {selectedOwner && (
                    <button
                      onClick={() => setHighlightOwnerId(selectedOwner)}
                      className="mt-2 text-xs text-blue-600 hover:text-blue-800"
                    >
                      Highlight all {homeowners.find((h) => h.id === selectedOwner)
                        ?.email}'s lots
                    </button>
                  )}
                  {highlightOwnerId && (
                    <button
                      onClick={() => setHighlightOwnerId(null)}
                      className="mt-2 ml-2 text-xs text-gray-600 hover:text-gray-800"
                    >
                      Clear highlight
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Status
                  </label>
                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(e.target.value as LotStatus)
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="built">🏠 Built</option>
                    <option value="vacant_lot">📐 Vacant Lot</option>
                    <option value="under_construction">🚧 Under Construction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lot Size (m²)
                  </label>
                  <input
                    type="number"
                    value={lotSize}
                    onChange={(e) => setLotSize(e.target.value)}
                    placeholder="Not measured"
                    className="w-full px-3 py-2 border rounded-lg"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setSelectedLot(null)}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center text-gray-500">
                <Map className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Click a lot on the map to edit</p>
                <p className="text-sm mt-2">Ctrl+click for multi-select</p>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              Lot Status Legend
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span className="text-sm text-gray-600">Built</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-400"></div>
                <span className="text-sm text-gray-600">Vacant Lot</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-orange-500"></div>
                <span className="text-sm text-gray-600">Under Construction</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-400 border-2 border-yellow-500"></div>
                <span className="text-sm text-gray-600">Highlighted Owner</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-blue-500"></div>
                <span className="text-sm text-gray-600">Selected Lot</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Add route**

Update `src/App.tsx` to add the route:

```typescript
// Add import
import { AdminLotsPage } from "./pages/AdminLotsPage";

// Add route in the router (within admin check)
<Route path="/admin/lots" element={<AdminLotsPage />} />
```

**Step 3: Add navigation link**

Update `src/components/layout/Navigation.tsx` to add admin link:

```tsx
// Add to admin menu
{user?.role === "admin" && (
  <Link to="/admin/lots">
    <button className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100">
      <Map className="w-5 h-5 inline mr-3" />
      Lot Management
    </button>
  </Link>
)}
```

**Step 4: Verify compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/pages/AdminLotsPage.tsx src/App.tsx src/components/layout/Navigation.tsx
git commit -m "feat: add admin lot ownership management page"
```

---

## Task 6: Frontend - Add Lots Table to Admin Panel

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

**Step 1: Add Lots tab component**

Add this component before the main AdminPanelPage function:

```typescript
interface AdminLotsTabProps {
  lots: LotOwnership[];
  homeowners: User[];
  onRefresh: () => void;
}

function AdminLotsTab({ lots, homeowners, onRefresh }: AdminLotsTabProps) {
  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterBlock, setFilterBlock] = useState<string>("");
  const [editingLot, setEditingLot] = useState<LotOwnership | null>(null);

  const filteredLots = lots.filter((lot) => {
    if (filterOwner && lot.owner_user_id !== filterOwner) return false;
    if (filterStatus && lot.lot_status !== filterStatus) return false;
    if (filterBlock && lot.block_number !== filterBlock) return false;
    return true;
  });

  async function handleSave() {
    if (!editingLot) return;

    try {
      await Promise.all([
        api.admin.assignLotOwner(editingLot.lot_id, editingLot.owner_user_id),
        api.admin.updateLotStatus(editingLot.lot_id, editingLot.lot_status),
        editingLot.lot_size_sqm !== undefined &&
          api.admin.updateLotSize(editingLot.lot_id, editingLot.lot_size_sqm),
      ]);

      setEditingLot(null);
      onRefresh();
    } catch (error) {
      console.error("Error saving lot:", error);
      alert("Failed to save");
    }
  }

  const blocks = Array.from(
    new Set(lots.map((l) => l.block_number).filter(Boolean)),
  ).sort((a, b) => parseInt(a || "0") - parseInt(b || "0"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={filterBlock}
          onChange={(e) => setFilterBlock(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Blocks</option>
          {blocks.map((b) => (
            <option key={b} value={b}>
              Block {b}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Statuses</option>
          <option value="built">Built</option>
          <option value="vacant_lot">Vacant Lot</option>
          <option value="under_construction">Under Construction</option>
        </select>

        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">All Owners</option>
          {homeowners.map((h) => (
            <option key={h.id} value={h.id}>
              {h.email}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-600">
          Showing {filteredLots.length} of {lots.length} lots
        </span>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Block
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Lot
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Size (m²)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLots.map((lot) => (
              <tr key={lot.lot_id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {lot.block_number || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {lot.lot_number || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      lot.lot_status === "built"
                        ? "bg-green-100 text-green-700"
                        : lot.lot_status === "under_construction"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {lot.lot_status === "built"
                      ? "Built"
                      : lot.lot_status === "under_construction"
                        ? "Under Construction"
                        : "Vacant Lot"}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {lot.owner_name || "Unknown"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {lot.lot_size_sqm || "—"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setEditingLot(lot)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingLot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Edit Lot - {editingLot.block_number}, {editingLot.lot_number}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner
                </label>
                <select
                  value={editingLot.owner_user_id}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      owner_user_id: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {homeowners.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={editingLot.lot_status}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      lot_status: e.target.value as LotStatus,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="built">Built</option>
                  <option value="vacant_lot">Vacant Lot</option>
                  <option value="under_construction">Under Construction</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Size (m²)
                </label>
                <input
                  type="number"
                  value={editingLot.lot_size_sqm || ""}
                  onChange={(e) =>
                    setEditingLot({
                      ...editingLot,
                      lot_size_sqm: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleSave}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingLot(null)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add state and integrate into AdminPanelPage**

Add to the component state:

```typescript
const [lots, setLots] = useState<LotOwnership[]>([]);
const [homeowners, setHomeowners] = useState<User[]>([]);
const [activeTab, setActiveTab] = useState<"users" | "households" | "lots">("users");
```

Add to loadData:

```typescript
// Load lots and homeowners for admin
const lotsResult = await api.admin.getLotsWithOwnership();
if (lotsResult.data) {
  setLots(lotsResult.data.lots);
}

const homeownersResult = await api.admin.getHomeowners();
if (homeownersResult.data) {
  setHomeowners(homeownersResult.data.homeowners);
}
```

Add tab selector:

```tsx
<div className="flex gap-2 mb-6">
  {(["users", "households", "lots"] as const).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-lg capitalize ${
        activeTab === tab
          ? "bg-blue-600 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`}
    >
      {tab}
    </button>
  ))}
</div>
```

Add conditional rendering:

```tsx
{activeTab === "lots" && (
  <AdminLotsTab lots={lots} homeowners={homeowners} onRefresh={loadData} />
)}
```

**Step 3: Verify compiles**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat: add lots table to admin panel"
```

---

## Task 7: Update SVG to GeoJSON Conversion

**Files:**
- Modify: `scripts/svg-to-geojson.ts`

**Step 1: Update to read from organized SVG with new group structure**

The script needs to:
1. Read lots from `id="lots"` group
2. Read blocks from `id="blocks"` group
3. Read common areas from `id="common-areas"` group (if exists)
4. Use the `inkscape:label` as the lot ID (e.g., B14-L25)
5. Parse block and lot numbers from the label

**Step 2: Update conversion to include new fields**

The GeoJSON output should include placeholders for the new fields:
- `owner_user_id`: defaults to "developer-owner"
- `lot_status`: defaults to "vacant_lot"
- `lot_size_sqm`: null

**Step 3: Test conversion**

```bash
node scripts/svg-to-geojson.ts --mapping scripts/lot-mapping.json
```

**Step 4: Commit**

```bash
git add scripts/svg-to-geojson.ts
git commit -m "feat: update SVG to GeoJSON conversion for new lot structure"
```

---

## Task 8: Update Map Page for Admin Users

**Files:**
- Modify: `src/pages/MapPage.tsx`

**Step 1: Add admin-specific features**

When user is admin, show:
- Lot owner info in popups
- "Edit Ownership" button
- Link to admin lots page

**Step 2: Commit**

```bash
git add src/pages/MapPage.tsx
git commit -m "feat: show lot ownership info for admin users on map"
```

---

## Task 9: Set Developer Owner Password

**Step 1: Set a real password for the developer-owner account**

```sql
UPDATE users
SET password_hash = '$2a$10$...' -- Real bcrypt hash
WHERE id = 'developer-owner';
```

**Step 2: Document the developer owner credentials**

Add to project docs or secure credentials file.

---

## Verification Steps

After completing all tasks:

1. **Test API endpoints:**
   ```bash
   # Login as admin and get token
   curl -X POST http://localhost:8787/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@lagunahills.com","password":"admin123"}'

   # Get lots with ownership
   curl http://localhost:8787/api/admin/lots/ownership \
     -H "Authorization: Bearer <token>"
   ```

2. **Test admin UI:**
   - Login as admin
   - Navigate to `/admin/lots`
   - Click a lot on the map
   - Change owner and status
   - Save and verify changes persist

3. **Test table view:**
   - Navigate to `/admin`
   - Click "Lots" tab
   - Filter by status, owner, block
   - Edit a lot
   - Verify changes

4. **Test security:**
   - Logout and try accessing `/admin/lots` - should be denied
   - Login as resident - should not see lot ownership on map

5. **Test multi-lot owners:**
   - Assign same owner to multiple lots
   - Use "Highlight all lots" feature
   - Verify all lots highlight

6. **Test batch assignment:**
   - Ctrl+click multiple lots
   - Assign to single owner
   - Verify all lots updated

---

**End of Plan**
