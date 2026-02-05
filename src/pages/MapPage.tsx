import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { api } from "@/lib/api";
import { MapHousehold } from "@/types";
import { Map, Home, Building, Landmark } from "lucide-react";

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

interface MapControlsProps {
  filter: "all" | "owned" | "rented" | "vacant";
  onFilterChange: (filter: "all" | "owned" | "rented" | "vacant") => void;
}

function MapControls({ filter, onFilterChange }: MapControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">
        Filter by Status
      </h3>
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
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">Owned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-600">Rented</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-400"></div>
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
  const [map] = useState(() => {
    // Create custom icon based on status
    const color =
      household.status === "owned"
        ? "#22c55e"
        : household.status === "rented"
          ? "#3b82f6"
          : "#9ca3af";

    return L.divIcon({
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
  });

  if (!household.latitude || !household.longitude) {
    return null;
  }

  return (
    <Marker position={[household.latitude, household.longitude]} icon={map}>
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

export function MapPage() {
  const [households, setHouseholds] = useState<MapHousehold[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "owned" | "rented" | "vacant">(
    "all",
  );

  useEffect(() => {
    async function loadMapData() {
      setLoading(true);
      setError("");

      const result = await api.households.getMapLocations();

      if (result.error || !result.data) {
        setError(result.error || "Failed to load map data");
      } else {
        setHouseholds(result.data.households);
      }

      setLoading(false);
    }

    loadMapData();
  }, []);

  const filteredHouseholds = households.filter((h) => {
    if (filter === "all") return true;
    return h.status === filter;
  });

  // Calculate center point for map (default to Philippines coordinates if no data)
  const center =
    households.length > 0 && households[0].latitude && households[0].longitude
      ? ([households[0].latitude, households[0].longitude] as [number, number])
      : ([14.5, 121.0] as [number, number]);

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
            View household locations and status across the subdivision
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Map className="w-5 h-5" />
          <span>{filteredHouseholds.length} households displayed</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="relative h-[600px]">
          <MapContainer
            center={center}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filteredHouseholds.map((household) => (
              <HouseholdMarker key={household.id} household={household} />
            ))}
          </MapContainer>
          <MapControls filter={filter} onFilterChange={setFilter} />
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
