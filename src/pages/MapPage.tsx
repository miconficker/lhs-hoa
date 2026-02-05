import { useEffect, useState } from "react";
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
} from "@/types";
import { Map, Home, Building, Landmark, Eye, EyeOff } from "lucide-react";

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

interface MapControlsProps {
  filter: "all" | "owned" | "rented" | "vacant";
  onFilterChange: (filter: "all" | "owned" | "rented" | "vacant") => void;
  showLots: boolean;
  showBlocks: boolean;
  onToggleLots: () => void;
  onToggleBlocks: () => void;
}

function MapControls({
  filter,
  onFilterChange,
  showLots,
  showBlocks,
  onToggleLots,
  onToggleBlocks,
}: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4 w-56">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Map Controls</h3>

      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-500 mb-2">
          Filter by Status
        </h4>
        <div className="flex flex-col gap-2">
          {(["all", "owned", "rented", "vacant"] as const).map((status) => (
            <label
              key={status}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="status-filter"
                value={status}
                checked={filter === status}
                onChange={() => onFilterChange(status)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600 capitalize">{status}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-gray-500 mb-2">Layers</h4>
        <div className="flex flex-col gap-2">
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-600">Block Boundaries</span>
            <button
              onClick={onToggleBlocks}
              className="p-1 hover:bg-gray-100 rounded"
              title={showBlocks ? "Hide blocks" : "Show blocks"}
            >
              {showBlocks ? (
                <Eye className="w-4 h-4 text-gray-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <span className="text-sm text-gray-600">Lot Boundaries</span>
            <button
              onClick={onToggleLots}
              className="p-1 hover:bg-gray-100 rounded"
              title={showLots ? "Hide lots" : "Show lots"}
            >
              {showLots ? (
                <Eye className="w-4 h-4 text-gray-600" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </label>
        </div>
      </div>
    </div>
  );
}

interface MapLegendProps {
  className?: string;
}

function MapLegend({ className = "" }: MapLegendProps) {
  return (
    <div className={`bg-white rounded-lg shadow-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Legend</h3>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500 border border-green-600"></div>
          <span className="text-sm text-gray-600">Owned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-blue-500 border border-blue-600"></div>
          <span className="text-sm text-gray-600">Rented</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-400 border border-gray-500"></div>
          <span className="text-sm text-gray-600">Vacant</span>
        </div>
      </div>
    </div>
  );
}

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
            {household.block && household.lot
              ? `Block ${household.block}, Lot ${household.lot}`
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
  filter: "all" | "owned" | "rented" | "vacant";
}

function LotsGeoJSON({ data, filter }: LotsGeoJSONProps) {
  if (!data) return null;

  const style = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) => {
    const status = feature.properties?.status || "vacant";
    return {
      color:
        status === "owned"
          ? "#16a34a"
          : status === "rented"
            ? "#2563eb"
            : "#6b7280",
      weight: 2,
      fillColor:
        status === "owned"
          ? "#22c55e"
          : status === "rented"
            ? "#3b82f6"
            : "#9ca3af",
      fillOpacity: 0.3,
    };
  };

  const filterFeatures = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, LotFeatureProperties>,
  ) => {
    if (filter === "all") return true;
    return (feature.properties?.status || "vacant") === filter;
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
      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <h3 class="font-semibold text-gray-900 mb-1">
            ${
              props.lot_number && props.block_number
                ? `Block ${props.block_number}, Lot ${props.lot_number}`
                : props.path_id || "Unnamed Lot"
            }
          </h3>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2 py-1 text-xs font-medium rounded-full ${
              props.status === "owned"
                ? "bg-green-100 text-green-700"
                : props.status === "rented"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-700"
            }">
              ${props.status.charAt(0).toUpperCase() + props.status.slice(1)}
            </span>
          </div>
          ${props.area_sqm ? `<p class="text-xs text-gray-500">Area: ${Math.round(props.area_sqm).toLocaleString()} px²</p>` : ""}
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
  const [households, setHouseholds] = useState<MapHousehold[]>([]);
  const [lotsData, setLotsData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [blocksData, setBlocksData] =
    useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "owned" | "rented" | "vacant">(
    "all",
  );
  const [showLots, setShowLots] = useState(true); // Enable for debugging
  const [showBlocks, setShowBlocks] = useState(false);

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

        // Load GeoJSON data in parallel with cache-busting
        const cacheBust = Date.now();
        const [lotsResponse, blocksResponse] = await Promise.all([
          fetch(`/data/lots.geojson?t=${cacheBust}`),
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
  }, []);

  const filteredHouseholds = households.filter((h) => {
    if (filter === "all") return true;
    return h.status === filter;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subdivision Map</h1>
          <p className="text-sm text-gray-500 mt-1">
            View household locations and lot boundaries across the subdivision
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Map className="w-5 h-5" />
          <span>{filteredHouseholds.length} households displayed</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="relative h-[800px] w-full">
          <MapContainer
            crs={L.CRS.Simple}
            bounds={mapBounds}
            style={{ height: "100%", width: "100%" }}
          >
            {/* Base map image - PNG */}
            <ImageOverlay
              url="/LAGUNA-HILLS-MAP.svg.2026_01_23_14_02_46.0.png"
              bounds={mapBounds}
              opacity={1}
            />

            {/* Block boundaries overlay */}
            {showBlocks && <BlocksGeoJSON data={blocksData} />}

            {/* Lot boundaries overlay */}
            {showLots && <LotsGeoJSON data={lotsData} filter={filter} />}

            {/* Household markers */}
            {filteredHouseholds.map((household) => (
              <HouseholdMarker key={household.id} household={household} />
            ))}
          </MapContainer>

          <MapControls
            filter={filter}
            onFilterChange={setFilter}
            showLots={showLots}
            showBlocks={showBlocks}
            onToggleLots={() => setShowLots(!showLots)}
            onToggleBlocks={() => setShowBlocks(!showBlocks)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <Home className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {households.filter((h) => h.status === "owned").length}
              </p>
              <p className="text-sm text-gray-600">Owned Units</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {households.filter((h) => h.status === "rented").length}
              </p>
              <p className="text-sm text-gray-600">Rented Units</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Landmark className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {households.filter((h) => h.status === "vacant").length}
              </p>
              <p className="text-sm text-gray-600">Vacant Units</p>
            </div>
          </div>
        </div>
      </div>

      <MapLegend />
    </div>
  );
}
