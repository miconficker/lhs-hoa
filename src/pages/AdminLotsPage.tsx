import { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import { FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw";
import "react-leaflet-draw";
import union from "@turf/union";
import { featureCollection } from "@turf/helpers";
import { useTheme } from "next-themes";
import {
  red, orange, amber, lime, green,
  teal, cyan, blue, indigo, violet,
  purple, pink, crimson, tomato, brown,
  redDark, orangeDark, amberDark, limeDark, greenDark,
  tealDark, cyanDark, blueDark, indigoDark, violetDark,
  purpleDark, pinkDark, crimsonDark, tomatoDark, brownDark,
} from "@radix-ui/colors";
import { api } from "@/lib/api";
import {
  LotOwnership,
  LotStatus,
  LotType,
  User,
  LotFeatureProperties,
} from "@/types";
import { Map, Save, X, Link2, Unlink, MousePointer2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

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

// Extend Leaflet types for leaflet-draw
declare module "leaflet" {
  namespace Draw {
    enum Event {
      CREATED = "draw:created",
      EDITED = "draw:edited",
      DELETED = "draw:deleted",
    }
  }
}

const MAP_WIDTH = 2304;
const MAP_HEIGHT = 3456;
const mapBounds: LatLngBoundsExpression = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
];

// Radix step 9 — WCAG AA compliant on white backgrounds (light mode)
// Radix dark step 9 — WCAG AA compliant on dark backgrounds (dark mode)
const lightPalette = [
  red.red9,
  orange.orange9,
  amber.amber9,
  lime.lime9,
  green.green9,
  teal.teal9,
  cyan.cyan9,
  blue.blue9,
  indigo.indigo9,
  violet.violet9,
  purple.purple9,
  pink.pink9,
  crimson.crimson9,
  tomato.tomato9,
  brown.brown9,
];

const darkPalette = [
  redDark.red9,
  orangeDark.orange9,
  amberDark.amber9,
  limeDark.lime9,
  greenDark.green9,
  tealDark.teal9,
  cyanDark.cyan9,
  blueDark.blue9,
  indigoDark.indigo9,
  violetDark.violet9,
  purpleDark.purple9,
  pinkDark.pink9,
  crimsonDark.crimson9,
  tomatoDark.tomato9,
  brownDark.brown9,
];

function groupIdToColor(groupId: string, isDark: boolean): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = groupId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const palette = isDark ? darkPalette : lightPalette;
  return palette[Math.abs(hash) % palette.length];
}

interface LotWithOwnership extends LotOwnership {
  featureId?: string;
}

export function AdminLotsPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [lots, setLots] = useState<LotWithOwnership[]>([]);
  const [homeowners, setHomeowners] = useState<User[]>([]);
  const [geojsonData, setGeojsonData] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [selectedLot, setSelectedLot] = useState<LotWithOwnership | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<LotStatus>("vacant_lot");
  const [selectedLotType, setSelectedLotType] =
    useState<LotType>("residential");
  const [lotSize, setLotSize] = useState<string>("");
  const [lotLabel, setLotLabel] = useState<string>("");
  const [lotDescription, setLotDescription] = useState<string>("");
  const [lotStreet, setLotStreet] = useState<string>("");
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [highlightOwnerId, setHighlightOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  // Refs to fix stale closures in Leaflet callbacks.
  // Leaflet registers onEachFeature/style once at mount and never re-registers,
  // so any state read inside those callbacks must be accessed via a ref.
  const selectedLotsRef = useRef(selectedLots);
  const lotsRef = useRef(lots);
  const selectedLotRef = useRef(selectedLot);
  const highlightOwnerIdRef = useRef(highlightOwnerId);
  const isMultiSelectModeRef = useRef(isMultiSelectMode);

  useEffect(() => {
    selectedLotsRef.current = selectedLots;
  }, [selectedLots]);

  useEffect(() => {
    lotsRef.current = lots;
  }, [lots]);

  useEffect(() => {
    selectedLotRef.current = selectedLot;
  }, [selectedLot]);

  useEffect(() => {
    highlightOwnerIdRef.current = highlightOwnerId;
  }, [highlightOwnerId]);

  useEffect(() => {
    isMultiSelectModeRef.current = isMultiSelectMode;
  }, [isMultiSelectMode]);

  // Compute union outlines for merged lots (groups with household_group_id)
  const mergedOutlines = useMemo(() => {
    if (!geojsonData || !lots) return null;

    const groups = new globalThis.Map<string, string[]>();
    for (const lot of lots) {
      if (lot.household_group_id) {
        const existing = groups.get(lot.household_group_id) ?? [];
        existing.push(lot.lot_id);
        groups.set(lot.household_group_id, existing);
      }
    }

    const outlineFeatures: GeoJSON.Feature[] = [];

    for (const [groupId, lotIds] of groups.entries()) {
      if (lotIds.length < 2) continue;

      const features = geojsonData.features.filter((f) =>
        lotIds.includes(f.properties?.path_id),
      ) as GeoJSON.Feature<GeoJSON.Polygon>[];

      if (features.length < 2) continue;

      let merged: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> =
        features[0];
      for (let i = 1; i < features.length; i++) {
        const result = union(featureCollection([merged, features[i]]));
        if (result) merged = result;
      }

      merged.properties = { household_group_id: groupId };
      outlineFeatures.push(merged);
    }

    return {
      type: "FeatureCollection" as const,
      features: outlineFeatures,
    };
  }, [geojsonData, lots]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [lotsResult, homeownersResult, geoResponse] = await Promise.all([
        api.admin.getLotsWithOwnership(),
        api.admin.getHomeowners(),
        fetch(`/api/data/lots.geojson?t=${Date.now()}`),
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
      logger.error("Error loading data", error, { component: "AdminLotsPage" });
    }
    setLoading(false);
  }

  function handleLotClick(lotId: string) {
    const lot = lots.find((l) => l.lot_id === lotId);
    if (lot) {
      setSelectedLot(lot);
      setSelectedOwner(lot.owner_user_id || "");
      setSelectedStatus(lot.lot_status);
      setSelectedLotType((lot.lot_type as LotType) || "residential");
      setLotSize(lot.lot_size_sqm?.toString() || "");
      setLotLabel(lot.lot_label || "");
      setLotDescription(lot.lot_description || "");
      setLotStreet(lot.street || "");
    }
  }

  function handleLotToggle(lotId: string) {
    const newSelected = new Set(selectedLotsRef.current);
    if (newSelected.has(lotId)) {
      newSelected.delete(lotId);
    } else {
      newSelected.add(lotId);
    }
    setSelectedLots(newSelected);
  }

  function handleLotBoundaryCreated(e: any) {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0];
    const polygon = latlngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
    console.log("Lot boundary created:", polygon);

    if (selectedLot) {
      api.admin.updateLotPolygon(selectedLot.lot_id, polygon);
    }
  }

  function handleLotBoundaryEdited(e: any) {
    const layers = e.layers.getLayers();
    layers.forEach((layer: any) => {
      const latlngs = layer.getLatLngs()[0];
      const polygon = latlngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
      console.log("Lot boundary edited:", polygon);
    });
  }

  async function handleSave() {
    if (!selectedLot) return;

    setSaving(true);
    try {
      await Promise.all([
        api.admin.assignLotOwner(selectedLot.lot_id, selectedOwner),
        api.admin.updateLotStatus(selectedLot.lot_id, selectedStatus),
        api.admin.updateLotType(selectedLot.lot_id, selectedLotType),
        api.admin.updateLotSize(
          selectedLot.lot_id,
          lotSize ? parseFloat(lotSize) : null,
        ),
        api.admin.updateLotLabel(selectedLot.lot_id, lotLabel || null),
        api.admin.updateLotDescription(
          selectedLot.lot_id,
          lotDescription || null,
        ),
        api.admin.updateLotStreet(selectedLot.lot_id, lotStreet),
      ]);

      await loadData();
      setSelectedLot(null);
    } catch (error) {
      logger.error("Error saving lot", error, { component: "AdminLotsPage" });
      alert("Failed to save lot changes");
    }
    setSaving(false);
  }

  async function handleBatchAssign() {
    if (selectedLots.size === 0 || !selectedOwner) return;

    if (
      !confirm(
        `Assign ${selectedLots.size} lot(s) to ${
          homeowners.find((h) => h.id === selectedOwner)?.email || "this owner"
        }?`,
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await api.admin.batchAssignOwner(Array.from(selectedLots), selectedOwner);
      await loadData();
      setSelectedLots(new Set());
    } catch (error) {
      logger.error("Error batch assigning", error, {
        component: "AdminLotsPage",
      });
      alert("Failed to batch assign lots");
    }
    setSaving(false);
  }

  async function handleMerge() {
    if (selectedLots.size < 2) return;

    const lotArray = Array.from(selectedLots);
    const primaryLotId = lotArray[0];

    setSaving(true);
    try {
      await api.admin.mergeHouseholds(primaryLotId, lotArray.slice(1));
      setShowMergeModal(false);
      setSelectedLots(new Set());
      await loadData();
    } catch (error) {
      logger.error("Error merging lots", error, { component: "AdminLotsPage" });
      alert("Failed to merge lots");
    }
    setSaving(false);
  }

  async function handleUnmerge(lotId: string) {
    if (!confirm("Unmerge this lot? It will become a separate household."))
      return;

    setSaving(true);
    try {
      await api.admin.unmergeHousehold(lotId);
      await loadData();
    } catch (error) {
      logger.error("Error unmerging lot", error, {
        component: "AdminLotsPage",
      });
      alert("Failed to unmerge lot");
    }
    setSaving(false);
  }

  // Border colors map matching the map page
  const borderColors: Record<string, string> = {
    "#9ca3af": "#6b7280",
    "#22c55e": "#16a34a",
    "#3b82f6": "#2563eb",
    "#ef4444": "#dc2626",
    "#f59e0b": "#d97706",
    "#8b5cf6": "#7c3aed",
    "#ec4899": "#db2777",
    "#14b8a6": "#0d9488",
    "#f97316": "#ea580c",
    "#06b6d4": "#0891b2",
    "#84cc16": "#65a30d",
    "#6366f1": "#4f46e5",
    "#eab308": "#ca8a04",
    "#a78bfa": "#8b5cf6",
  };

  function getLotStyle(feature?: GeoJSON.Feature<any, any>) {
    if (!feature) return {};

    const props = feature.properties as LotFeatureProperties;
    const lotId = props?.path_id;

    // Read all state from refs to avoid stale closure
    const isSelected = selectedLotRef.current?.lot_id === lotId;
    const isMultiSelected = selectedLotsRef.current.has(lotId || "");
    const isHighlighted =
      highlightOwnerIdRef.current &&
      props?.owner_user_id === highlightOwnerIdRef.current;

    const lot = lotsRef.current.find((l) => l.lot_id === lotId);
    const lotType = lot?.lot_type || props?.lot_type;
    const ownerId = lot?.owner_user_id || props?.owner_user_id;
    const lotStatus = lot?.lot_status || props?.status;
    const isMerged = lot?.household_group_id;

    const isMyLot = user && ownerId === user.id;

    let fillColor = "#e5e7eb";

    if (isMyLot) {
      fillColor = "#3b82f6";
    } else if (lotType === "community") {
      fillColor = "#a855f7";
    } else if (lotType === "utility") {
      fillColor = "#ef4444";
    } else if (lotType === "open_space") {
      fillColor = "#14b8a6";
    } else {
      if (lotStatus === "built") fillColor = "#22c55e";
      if (lotStatus === "under_construction") fillColor = "#f59e0b";
    }

    return {
      color: isSelected
        ? "#1d4ed8"
        : isMultiSelected
          ? "#7c3aed"
          : isHighlighted
            ? "#eab308"
            : isMerged
              ? "#7c3aed"
              : borderColors[fillColor] || "#6b7280",
      weight:
        isSelected || isMultiSelected || isHighlighted ? 3 : isMerged ? 1 : 1.5,
      dashArray:
        isMerged && !isSelected && !isMultiSelected ? "4 3" : undefined,
      fillColor: isMultiSelected ? "#a855f7" : fillColor,
      fillOpacity: isSelected
        ? 0.6
        : isMultiSelected
          ? 0.55
          : isMyLot
            ? 0.4
            : 0.25,
    };
  }

  if (user?.role !== "admin") {
    return (
      <div className="bg-yellow-50/50 dark:bg-yellow-400/10 border border-yellow-200 dark:border-yellow-400/20 text-yellow-700 dark:text-yellow-400 p-4 rounded-lg">
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
      <div>
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Lot Ownership Management
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Click lots to assign owners and update status. Map updates
                automatically.
              </p>
            </div>
            <button
              onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isMultiSelectMode
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground border border-border"
              }`}
              title={
                isMultiSelectMode
                  ? "Disable multi-select mode"
                  : "Enable multi-select mode - click multiple lots to select them"
              }
            >
              <MousePointer2 className="w-4 h-4" />
              {isMultiSelectMode ? "Multi-select ON" : "Multi-select OFF"}
            </button>
          </div>
        </div>
      </div>

      <div className="fixed top-16 left-0 right-0 bottom-0 z-40 lg:left-64">
        {/* Floating selection toolbar over the map */}
        {selectedLots.size > 0 && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9600] bg-card shadow-lg rounded-lg px-4 py-3 flex items-center gap-3 border border-border">
            <span className="text-sm text-muted-foreground">
              {selectedLots.size} lot(s) selected
            </span>
            <select
              value={selectedOwner}
              onChange={(e) => setSelectedOwner(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Remove owner (HOA-Owned)</option>
              {homeowners.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.email}
                </option>
              ))}
            </select>
            <button
              onClick={handleBatchAssign}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {selectedOwner === ""
                ? `Remove owner from ${selectedLots.size} lot(s)`
                : `Assign to ${selectedLots.size} lots`}
            </button>
            {selectedLots.size >= 2 && (
              <button
                onClick={() => setShowMergeModal(true)}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Link2 className="w-4 h-4" />
                Merge {selectedLots.size} lots
              </button>
            )}
            <button
              onClick={() => setSelectedLots(new Set())}
              className="px-4 py-2 text-muted-foreground hover:text-foreground text-sm"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Fullscreen Map */}
        <div className="absolute inset-0">
          <div className="relative h-full">
            <MapContainer
              crs={L.CRS.Simple}
              bounds={mapBounds}
              style={{ height: "100%", width: "100%" }}
              className="dark-map"
            >
              <ImageOverlay
                url="/LAGUNA-HILLS-MAP-v2.svg"
                bounds={mapBounds}
                opacity={1}
              />
              <FeatureGroup>
                <EditControl
                  position="topright"
                  draw={{
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false,
                  }}
                  onCreated={handleLotBoundaryCreated}
                  onEdited={handleLotBoundaryEdited}
                />
              </FeatureGroup>
              {geojsonData && (
                <GeoJSON
                  key={`geojson-${Array.from(selectedLots).sort().join(",")}-${selectedLot?.lot_id ?? ""}`}
                  data={geojsonData}
                  style={getLotStyle}
                  onEachFeature={(feature, layer) => {
                    const props = feature.properties as LotFeatureProperties;
                    const lotId = props?.path_id;

                    if (lotId) {
                      layer.on("click", (e: L.LeafletMouseEvent) => {
                        const isMultiSelect =
                          isMultiSelectModeRef.current ||
                          e.originalEvent.ctrlKey ||
                          e.originalEvent.metaKey;

                        if (isMultiSelect) {
                          L.DomEvent.stopPropagation(e);
                          e.originalEvent.preventDefault();
                          handleLotToggle(lotId);
                        } else {
                          handleLotClick(lotId);
                        }
                      });
                    }

                    const lot = lots.find((l) => l.lot_id === lotId);
                    if (lot || props) {
                      const popupContent = `
                        <div class="p-2 min-w-[200px]">
                          <h3 class="font-semibold text-gray-900 mb-1">
                            ${
                              lot?.lot_label ||
                              (lot?.block_number && lot?.lot_number
                                ? `${lot.street || ""}${lot.street ? ", " : ""}Block ${lot.block_number}, Lot ${lot.lot_number}`
                                : props?.path_id || "Unnamed Lot")
                            }
                          </h3>
                          <p class="text-sm text-gray-600">
                            Owner: ${!lot?.owner_name && !lot?.owner_user_id ? "HOA-Owned" : lot?.owner_name || lot?.owner_email || "Unknown"}
                          </p>
                          <p class="text-sm text-gray-600">
                            Type: ${lot?.lot_type || "residential"}
                          </p>
                          <p class="text-sm text-gray-600">
                            Status: ${lot?.lot_status || "vacant_lot"}
                          </p>
                          ${
                            lot?.lot_size_sqm
                              ? `<p class="text-sm text-gray-600">Size: ${lot.lot_size_sqm} m²</p>`
                              : ""
                          }
                          ${
                            lot?.lot_description
                              ? `<p class="text-sm text-gray-600">${lot.lot_description}</p>`
                              : ""
                          }
                          ${
                            selectedLots.has(lotId || "")
                              ? '<p class="text-xs text-blue-600 mt-1">✓ Selected</p>'
                              : ""
                          }
                          <p class="text-xs text-gray-500 mt-2">Ctrl+click to multi-select</p>
                        </div>
                      `;
                      layer.bindPopup(popupContent);
                    }
                  }}
                />
              )}

              {/* Merged group union outlines — one WCAG AA color per group */}
              {mergedOutlines && mergedOutlines.features.length > 0 && (
                <GeoJSON
                  key={`merged-outlines-${isDark ? "dark" : "light"}-${lots
                    .filter((l) => l.household_group_id)
                    .map((l) => l.household_group_id)
                    .sort()
                    .join(",")}`}
                  data={mergedOutlines}
                  style={(feature) => ({
                    color: groupIdToColor(
                      feature?.properties?.household_group_id ?? "",
                      isDark,
                    ),
                    weight: 4,
                    fillOpacity: 0,
                    interactive: false,
                  })}
                />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Side Panel Overlay */}
        <div
          className={`absolute top-0 right-0 h-full bg-card shadow-2xl z-[9500] transition-transform duration-300 ease-in-out ${
            selectedLot ? "translate-x-0" : "translate-x-full"
          } w-96`}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold text-card-foreground">
                Edit Lot
              </h3>
              <button
                onClick={() => setSelectedLot(null)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedLot ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-card-foreground">
                    {selectedLot.block_number && selectedLot.lot_number
                      ? `${selectedLot.street || ""}${selectedLot.street ? ", " : ""}Block ${selectedLot.block_number}, Lot ${selectedLot.lot_number}`
                      : selectedLot.address || "Unnamed Lot"}
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
                      Owner
                    </label>
                    <select
                      value={selectedOwner}
                      onChange={(e) => setSelectedOwner(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="">
                        No Owner (HOA-Owned / Common Area)
                      </option>
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
                        Highlight all{" "}
                        {homeowners.find((h) => h.id === selectedOwner)?.email}
                        's lots
                      </button>
                    )}
                    {highlightOwnerId && (
                      <button
                        onClick={() => setHighlightOwnerId(null)}
                        className="mt-2 ml-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear highlight
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
                      Street
                    </label>
                    <input
                      type="text"
                      value={lotStreet}
                      onChange={(e) => setLotStreet(e.target.value)}
                      placeholder="e.g., Main Street"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
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
                      <option value="under_construction">
                        🚧 Under Construction
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
                      Lot Type
                    </label>
                    <select
                      value={selectedLotType}
                      onChange={(e) =>
                        setSelectedLotType(e.target.value as LotType)
                      }
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="residential">🏠 Residential</option>
                      <option value="resort">🏨 Resort</option>
                      <option value="commercial">🏢 Commercial</option>
                      <option value="community">
                        🌳 Community (HOA-Owned)
                      </option>
                      <option value="utility">⚡ Utility (HOA-Owned)</option>
                      <option value="open_space">
                        💧 Open Space (HOA-Owned)
                      </option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedLotType === "community" ||
                      selectedLotType === "utility" ||
                      selectedLotType === "open_space"
                        ? "HOA-owned lots don't pay dues or vote"
                        : "Private property"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
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

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={lotLabel}
                      onChange={(e) => setLotLabel(e.target.value)}
                      placeholder="e.g., Clubhouse, Water Tower, Tennis Court"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Short name for community/utility lots
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={lotDescription}
                      onChange={(e) => setLotDescription(e.target.value)}
                      placeholder="e.g., Multi-purpose court with basketball and volleyball hoops"
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Detailed description for amenities or common areas
                    </p>
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
                      onClick={() => handleUnmerge(selectedLot.lot_id)}
                      disabled={saving}
                      className="px-4 py-2 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-50 disabled:opacity-50 flex items-center gap-2"
                      title="Unmerge this lot from its household group"
                    >
                      <Unlink className="w-4 h-4" />
                      Unmerge
                    </button>
                    <button
                      onClick={() => setSelectedLot(null)}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-muted"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Map className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p>Click a lot on the map to edit</p>
                  <p className="text-sm mt-2">Ctrl+click for multi-select</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
          <div className="bg-card rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-600" />
              Merge Lots
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Merge {selectedLots.size} lots into one household. The first
              selected lot will be the primary lot.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 text-card-foreground border border-border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Merging..." : "Confirm Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}