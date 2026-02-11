import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  MapContainer,
  ImageOverlay,
  GeoJSON,
  Marker,
  Popup,
} from "react-leaflet";
import { LatLngBoundsExpression, LatLng } from "leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import {
  MapHousehold,
  LotFeatureProperties,
  BlockFeatureProperties,
  LotStatus,
} from "@/types";
import {
  Home,
  Building,
  Landmark,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Fix for default marker icons in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Map dimensions
const MAP_WIDTH = 2304;
const MAP_HEIGHT = 3456;

// Map bounds [[y1, x1], [y2, x2]]
const mapBounds: LatLngBoundsExpression = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
];

interface HouseholdMarkerProps {
  household: MapHousehold;
}

function HouseholdMarker({ household }: HouseholdMarkerProps) {
  const color =
    household.status === "owned"
      ? "#22c55e"
      : household.status === "rented"
        ? "#3b82f6"
        : "#9ca3af";

  const icon = L.divIcon({
    className: "custom-marker",
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });

  const position =
    household.map_marker_x !== undefined && household.map_marker_y !== undefined
      ? new LatLng(household.map_marker_y, household.map_marker_x)
      : household.latitude && household.longitude
        ? new LatLng(household.latitude, household.longitude)
        : null;

  if (!position) return null;

  return (
    <Marker position={position} icon={icon}>
      <Popup>
        <div className="p-2 min-w-[200px]">
          <h3 className="font-semibold text-gray-900 mb-1">
            {household.street || household.block || household.lot
              ? `${household.street ? household.street + ", " : ""}Block ${household.block}, Lot ${household.lot}`
              : household.address}
          </h3>
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${
                household.status === "owned"
                  ? "bg-green-100 text-green-700"
                  : household.status === "rented"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700"
              }`}
            >
              {household.status.charAt(0).toUpperCase() +
                household.status.slice(1)}
            </span>
          </div>
          {household.residents && household.residents.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                Residents:
              </p>
              <p className="text-sm text-gray-700">{household.residents}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No residents</p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}

interface LotsGeoJSONProps {
  data: GeoJSON.FeatureCollection | null;
  filter: "all" | LotStatus;
  lotsOwnership?: Map<
    string,
    {
      owner_user_id?: string;
      owner_name?: string;
      lot_status?: string;
      lot_type?: string;
      lot_label?: string;
      lot_description?: string;
      household_group_id?: string;
      is_primary_lot?: boolean;
    }
  >;
}

function LotsGeoJSON({ data, filter, lotsOwnership }: LotsGeoJSONProps) {
  const { user } = useAuth();

  if (!data) return null;

  const style = (
    feature?: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) => {
    const props = feature?.properties;
    const lotId = props?.path_id;

    // Get ownership data for this lot
    const ownershipData = lotsOwnership?.get(lotId || "");
    const lotType = ownershipData?.lot_type || props?.lot_type;
    const ownerId = ownershipData?.owner_user_id || props?.owner_user_id;
    const isMerged = ownershipData?.household_group_id;

    // Check if this lot is owned by the current user
    const isMyLot = user && ownerId === user.id;

    let fillColor = "#e5e7eb"; // Light gray (vacant/unowned)

    // Priority: my lots > HOA lots > other owned > status > default
    if (isMyLot) {
      fillColor = "#3b82f6"; // Blue - MY lots
    } else if (ownerId) {
      fillColor = "#d1d5db"; // Darker gray - other people's lots
    } else if (lotType === "community") {
      fillColor = "#a855f7"; // Purple - community areas
    } else if (lotType === "utility") {
      fillColor = "#ef4444"; // Red - utility areas
    } else if (lotType === "open_space") {
      fillColor = "#14b8a6"; // Teal - open space
    } else {
      // Unowned residential lots - color by status
      const status = ownershipData?.lot_status || props?.status;
      if (status === "built") fillColor = "#22c55e"; // Green
      if (status === "under_construction") fillColor = "#f59e0b"; // Orange
    }

    // For merged lots, use purple highlight
    if (isMerged) {
      fillColor = isMyLot ? fillColor : "#a78bfa"; // Light purple for merged (not primary)
    }

    // Map fill color to border color
    const borderColors: Record<string, string> = {
      "#9ca3af": "#6b7280", // gray
      "#22c55e": "#16a34a", // green
      "#3b82f6": "#2563eb", // blue
      "#ef4444": "#dc2626", // red
      "#f59e0b": "#d97706", // amber
      "#8b5cf6": "#7c3aed", // purple
      "#ec4899": "#db2777", // pink
      "#14b8a6": "#0d9488", // teal
      "#f97316": "#ea580c", // orange
      "#06b6d4": "#0891b2", // cyan
      "#84cc16": "#65a30d", // lime
      "#6366f1": "#4f46e5", // indigo
      "#eab308": "#ca8a04", // yellow
      "#a78bfa": "#8b5cf6", // light purple
    };

    return {
      color: borderColors[fillColor] || "#6b7280",
      weight: 2,
      fillColor,
      fillOpacity: 0.3,
    };
  };

  const filterFeatures = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) => {
    if (filter === "all") return true;
    return (feature.properties?.status || "vacant_lot") === filter;
  };

  const onEachFeature = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
    layer: L.Layer,
  ) => {
    layer.on({
      mouseover: (e) => {
        const layer = e.target as L.Polygon;
        layer.setStyle({ fillOpacity: 0.6 });
      },
      mouseout: (e) => {
        const layer = e.target as L.Polygon;
        layer.setStyle({ fillOpacity: 0.3 });
      },
    });

    const props = feature.properties;
    if (props) {
      const isAdmin = user?.role === "admin";
      const lotId = props.path_id;

      // Get current ownership data from database instead of static GeoJSON
      const ownershipData = lotsOwnership?.get(lotId);
      const ownerId = ownershipData?.owner_user_id || props.owner_user_id;
      const ownerName = ownershipData?.owner_name;
      const lotStatus = ownershipData?.lot_status || props.status;
      const lotLabel = ownershipData?.lot_label;
      const lotDescription = ownershipData?.lot_description;
      const lotType = ownershipData?.lot_type;

      const ownerInfo = isAdmin
        ? `
        <p class="text-sm text-gray-600">
          Owner: ${!ownerName && !ownerId ? "HOA-Owned" : ownerName || ownerId || "Unassigned"}
        </p>
      `
        : "";

      const isMerged = ownershipData?.household_group_id;
      const mergeBadge = isMerged
        ? `<span class="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700 ml-2">
             🔗 Merged
           </span>`
        : "";

      const editLink = isAdmin
        ? `
        <a href="/admin/lots" class="text-xs text-blue-600 hover:text-blue-800">
          Edit Ownership →
        </a>
      `
        : "";

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-semibold text-gray-900 mb-1">
            ${
              lotLabel ||
              (props.block_number && props.lot_number
                ? `Block ${props.block_number}, Lot ${props.lot_number}`
                : props.path_id || "Unnamed Lot")
            }
          </h3>
          ${ownerInfo}
          ${lotType ? `<p class="text-xs text-gray-500">Type: ${lotType}</p>` : ""}
          ${mergeBadge}
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-1 text-xs font-medium rounded-full ${
              lotStatus === "built"
                ? "bg-green-100 text-green-700"
                : lotStatus === "under_construction"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-700"
            }">
              ${
                lotStatus === "built"
                  ? "Built"
                  : lotStatus === "under_construction"
                    ? "Under Construction"
                    : "Vacant Lot"
              }
            </span>
          </div>
          ${
            props.lot_size_sqm
              ? `<p class="text-xs text-gray-500">Size: ${Math.round(props.lot_size_sqm)} m²</p>`
              : ""
          }
          ${
            lotDescription
              ? `<p class="text-xs text-gray-600 mt-1">${lotDescription}</p>`
              : ""
          }
          ${editLink}
        </div>
      `;
      layer.bindPopup(popupContent);
    }
  };

  return (
    <GeoJSON
      data={data}
      style={style}
      onEachFeature={onEachFeature}
      filter={filterFeatures}
    />
  );
}

interface BlocksGeoJSONProps {
  data: GeoJSON.FeatureCollection | null;
}

function BlocksGeoJSON({ data }: BlocksGeoJSONProps) {
  if (!data) return null;

  const style = () => ({
    color: "#7c3aed", // Purple color for blocks
    weight: 3,
    fillColor: "#a78bfa",
    fillOpacity: 0.15,
  });

  const onEachFeature = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, BlockFeatureProperties>,
    layer: L.Layer,
  ) => {
    layer.on({
      mouseover: (e) => {
        const layer = e.target as L.Polygon;
        layer.setStyle({ fillOpacity: 0.3 });
      },
      mouseout: (e) => {
        const layer = e.target as L.Polygon;
        layer.setStyle({ fillOpacity: 0.15 });
      },
    });

    const props = feature.properties;
    if (props) {
      const blockId = feature.id?.toString().replace("block-", "") || "?";
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-semibold text-gray-900 mb-1">
            Block ${blockId}
          </h3>
          ${props.area_sqm ? `<p class="text-xs text-gray-500">Area: ${Math.round(props.area_sqm).toLocaleString()} px²</p>` : ""}
        </div>
      `;
      layer.bindPopup(popupContent);
    }
  };

  return <GeoJSON data={data} style={style} onEachFeature={onEachFeature} />;
}

export function MapPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [households, setHouseholds] = useState<MapHousehold[]>([]);
  const [lotsData, setLotsData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [blocksData, setBlocksData] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [lotsOwnership, setLotsOwnership] = useState<
    Map<
      string,
      { owner_user_id?: string; owner_name?: string; lot_status?: string }
    >
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | LotStatus>("all");
  const [showLots, setShowLots] = useState(true);
  const [showBlocks, setShowBlocks] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        // Load household data
        const householdResult = await api.households.getMapLocations();
        if (householdResult.data) {
          setHouseholds(householdResult.data.households);
        }

        // Load lot ownership data from database (not GeoJSON)
        // For admin users, get detailed ownership info; for others, get their lots highlighted
        if (user?.role === "admin") {
          const ownershipResult = await api.admin.getLotsWithOwnership();
          if (ownershipResult.data?.lots) {
            const ownershipMap = new Map();
            ownershipResult.data.lots.forEach((lot) => {
              ownershipMap.set(lot.lot_id, {
                owner_user_id: lot.owner_user_id,
                owner_name: lot.owner_name,
                lot_status: lot.lot_status,
                lot_type: lot.lot_type,
                lot_label: lot.lot_label,
                lot_description: lot.lot_description,
                household_group_id: lot.household_group_id,
                is_primary_lot: lot.is_primary_lot,
              });
            });
            setLotsOwnership(ownershipMap);
          }
        } else {
          // For non-admin users, get basic lot info (owner_user_id only for their own lots)
          const lotsResult = await api.households.getLots();
          if (lotsResult.data?.lots) {
            const ownershipMap = new Map();
            lotsResult.data.lots.forEach((lot) => {
              ownershipMap.set(lot.lot_id, {
                owner_user_id: lot.owner_user_id, // Only set for user's own lots
                lot_status: lot.lot_status,
                lot_type: lot.lot_type,
                lot_label: lot.lot_label,
                lot_description: lot.lot_description,
              });
            });
            setLotsOwnership(ownershipMap);
          }
        }

        // Load GeoJSON data in parallel with cache-busting
        const cacheBust = Date.now();
        const [lotsResponse, blocksResponse] = await Promise.all([
          fetch(`/api/data/lots.geojson?t=${cacheBust}`),
          fetch(`/data/blocks.geojson?t=${cacheBust}`),
        ]);

        if (lotsResponse.ok) {
          const lots = await lotsResponse.json();
          setLotsData(lots);
        }

        if (blocksResponse.ok) {
          const blocks = await blocksResponse.json();
          setBlocksData(blocks);
        }
      } catch (err) {
        console.error("Error loading map data:", err);
        setError("Failed to load map data");
      }

      setLoading(false);
    }

    loadData();
  }, [user]);

  // Refresh ownership data when returning to map page (e.g., from admin)
  useEffect(() => {
    if (location.pathname === "/map") {
      const refreshOwnershipData = async () => {
        if (user?.role === "admin") {
          const ownershipResult = await api.admin.getLotsWithOwnership();
          if (ownershipResult.data?.lots) {
            const ownershipMap = new Map();
            ownershipResult.data.lots.forEach((lot) => {
              ownershipMap.set(lot.lot_id, {
                owner_user_id: lot.owner_user_id,
                owner_name: lot.owner_name,
                lot_status: lot.lot_status,
              });
            });
            setLotsOwnership(ownershipMap);
          }
        }
      };
      refreshOwnershipData();
    }
  }, [location.pathname, user]);

  const filteredHouseholds = households.filter(() => {
    // For now, show all households regardless of lot status filter
    // since household status and lot status are different concepts
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="fixed top-16 left-64 right-0 bottom-0 z-40">
      {/* Fullscreen Map */}
      <div className="absolute inset-0">
        <MapContainer
          crs={L.CRS.Simple}
          bounds={mapBounds}
          style={{ height: "100%", width: "100%" }}
        >
          <ImageOverlay
            url="/LAGUNA-HILLS-MAP-v2.svg"
            bounds={mapBounds}
            opacity={1}
          />

          {showBlocks && <BlocksGeoJSON data={blocksData} />}
          {showLots && (
            <LotsGeoJSON
              data={lotsData}
              filter={filter}
              lotsOwnership={lotsOwnership}
            />
          )}

          {filteredHouseholds.map((household) => (
            <HouseholdMarker key={household.id} household={household} />
          ))}
        </MapContainer>
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 right-4 z-[9999] bg-white rounded-full shadow-xl p-3 hover:bg-gray-50 transition-all duration-300 border-2 border-gray-200"
        title={sidebarOpen ? "Hide panel" : "Show panel"}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? (
          <ChevronRight className="w-6 h-6 text-gray-700" />
        ) : (
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        )}
      </button>

      {/* Collapsible Sidebar */}
      <div
        className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[9500] transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ width: "100%", maxWidth: "320px" }}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Subdivision Map
                </h1>
                <p className="text-xs text-gray-500">
                  {filteredHouseholds.length} households
                </p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                aria-label="Close sidebar"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Map Controls */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Filter by Status
                </h4>
                <div className="flex flex-col gap-2">
                  {(
                    [
                      "all",
                      "built",
                      "vacant_lot",
                      "under_construction",
                    ] as const
                  ).map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 cursor-pointer text-sm"
                    >
                      <input
                        type="radio"
                        name="status-filter"
                        value={status}
                        checked={filter === status}
                        onChange={() => setFilter(status)}
                        className="w-4 h-4 text-primary-600"
                      />
                      <span className="text-gray-700">
                        {status === "all"
                          ? "All"
                          : status === "built"
                            ? "Built"
                            : status === "vacant_lot"
                              ? "Vacant Lot"
                              : "Under Construction"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Layers
                </h4>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-between cursor-pointer text-sm p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">Block Boundaries</span>
                    <input
                      type="checkbox"
                      checked={showBlocks}
                      onChange={() => setShowBlocks(!showBlocks)}
                      className="w-4 h-4 text-primary-600"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer text-sm p-2 hover:bg-gray-50 rounded">
                    <span className="text-gray-700">Lot Boundaries</span>
                    <input
                      type="checkbox"
                      checked={showLots}
                      onChange={() => setShowLots(!showLots)}
                      className="w-4 h-4 text-primary-600"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Stats */}
            <div className="space-y-3">
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <Home className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {lotsData?.features.filter((f: any) => {
                        const lotId = f.properties?.path_id;
                        const ownership = lotsOwnership?.get(lotId || "");
                        // Count only private lots (has owner) that are built
                        return (
                          ownership?.owner_user_id &&
                          (ownership.lot_status === "built" ||
                            f.properties?.status === "built")
                        );
                      }).length || 0}
                    </p>
                    <p className="text-sm text-gray-600">Built (Private)</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-4 border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {lotsData?.features.filter((f: any) => {
                        const lotId = f.properties?.path_id;
                        const ownership = lotsOwnership?.get(lotId || "");
                        // Count only private lots (has owner) that are under construction
                        return (
                          ownership?.owner_user_id &&
                          (ownership.lot_status === "under_construction" ||
                            f.properties?.status === "under_construction")
                        );
                      }).length || 0}
                    </p>
                    <p className="text-sm text-gray-600">
                      Under Construction (Private)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-500 rounded-lg">
                    <Landmark className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {lotsData?.features.filter((f: any) => {
                        const lotId = f.properties?.path_id;
                        const ownership = lotsOwnership?.get(lotId || "");
                        // Count only private lots (has owner) that are vacant
                        return (
                          ownership?.owner_user_id &&
                          (!ownership.lot_status ||
                            ownership.lot_status === "vacant_lot" ||
                            !f.properties?.status ||
                            f.properties?.status === "vacant_lot")
                        );
                      }).length || 0}
                    </p>
                    <p className="text-sm text-gray-600">Vacant (Private)</p>
                  </div>
                </div>
              </div>

              {/* HOA-Owned Common Areas - only show if there are any */}
              {(lotsData?.features ?? []).filter((f: any) => {
                const lotId = f.properties?.path_id;
                const ownership = lotsOwnership?.get(lotId || "");
                // Count HOA-owned lots (no owner)
                return !ownership?.owner_user_id;
              }).length > 0 && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <Landmark className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {(lotsData?.features ?? []).filter((f: any) => {
                          const lotId = f.properties?.path_id;
                          const ownership = lotsOwnership?.get(lotId || "");
                          // Count HOA-owned lots (no owner)
                          return !ownership?.owner_user_id;
                        }).length || 0}
                      </p>
                      <p className="text-sm text-gray-600">
                        HOA-Owned Common Areas
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Legend
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-green-500 border-2 border-green-600"></div>
                  <span className="text-sm text-gray-700">Built</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-orange-500 border-2 border-orange-600"></div>
                  <span className="text-sm text-gray-700">
                    Under Construction
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-gray-400 border-2 border-gray-500"></div>
                  <span className="text-sm text-gray-700">Vacant Lot</span>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <p className="text-xs text-gray-500 mb-2 font-medium">
                    HOA-Owned Areas
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-purple-500 border-2 border-purple-600"></div>
                  <span className="text-sm text-gray-700">Community</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-orange-600 border-2 border-orange-700"></div>
                  <span className="text-sm text-gray-700">Utility</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-teal-500 border-2 border-teal-600"></div>
                  <span className="text-sm text-gray-700">Open Space</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
