import { useEffect, useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import { FeatureGroup } from "react-leaflet";
import { EditControl } from "react-leaflet-draw";
import "leaflet-draw";
import "react-leaflet-draw";
import { api } from "@/lib/api";
import {
  LotOwnership,
  LotStatus,
  LotType,
  User,
  LotFeatureProperties,
} from "@/types";
import { Map, Save, X, Link2, Unlink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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

interface LotWithOwnership extends LotOwnership {
  featureId?: string;
}

export function AdminLotsPage() {
  const { user } = useAuth();
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
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [highlightOwnerId, setHighlightOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

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
      console.error("Error loading data:", error);
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

  function handleLotBoundaryCreated(e: any) {
    const layer = e.layer;
    const latlngs = layer.getLatLngs()[0];
    const polygon = latlngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
    console.log("Lot boundary created:", polygon);

    // If a lot is selected, save its polygon
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

      // Find the lot that matches this polygon and update it
      // For now, this is a simplified implementation
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
      ]);

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
      console.error("Error batch assigning:", error);
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
      console.error("Error merging lots:", error);
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
      console.error("Error unmerging lot:", error);
      alert("Failed to unmerge lot");
    }
    setSaving(false);
  }

  function getLotStyle(feature?: GeoJSON.Feature<any, any>) {
    if (!feature) return {};

    const props = feature.properties as LotFeatureProperties;
    const lotId = props?.path_id;

    const isSelected = selectedLot?.lot_id === lotId;
    const isMultiSelected = selectedLots.has(lotId || "");
    const isHighlighted =
      highlightOwnerId && props?.owner_user_id === highlightOwnerId;

    let fillColor = "#9ca3af";
    if (props?.status === "built") fillColor = "#22c55e";
    if (props?.status === "under_construction") fillColor = "#f59e0b";

    return {
      color: isSelected ? "#2563eb" : isHighlighted ? "#eab308" : "#6b7280",
      weight: isSelected || isMultiSelected || isHighlighted ? 3 : 2,
      fillColor,
      fillOpacity:
        isSelected || isMultiSelected ? 0.5 : isHighlighted ? 0.4 : 0.2,
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
      <div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Lot Ownership Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Click lots to assign owners and update status. Map updates
            automatically.
          </p>
        </div>
        {selectedLots.size > 0 && (
          <div className="flex items-center gap-3 mt-4">
            <span className="text-sm text-gray-600">
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
              className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              Clear selection
            </button>
          </div>
        )}
      </div>

      <div className="fixed top-16 left-64 right-0 bottom-0 z-40">
        {/* Fullscreen Map */}
        <div className="absolute inset-0">
          <div className="relative h-full">
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
            </MapContainer>
          </div>
        </div>

        {/* Side Panel Overlay */}
        <div
          className={`absolute top-0 right-0 h-full bg-white shadow-2xl z-[9500] transition-transform duration-300 ease-in-out ${
            selectedLot ? "translate-x-0" : "translate-x-full"
          } w-96`}
        >
          <div className="h-full flex flex-col">
            <div className="p-6 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Lot</h3>
              <button
                onClick={() => setSelectedLot(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {selectedLot ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-gray-700">
                    {selectedLot.block_number && selectedLot.lot_number
                      ? `${selectedLot.street || ""}${selectedLot.street ? ", " : ""}Block ${selectedLot.block_number}, Lot ${selectedLot.lot_number}`
                      : selectedLot.address || "Unnamed Lot"}
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      <option value="under_construction">
                        🚧 Under Construction
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedLotType === "community" ||
                      selectedLotType === "utility" ||
                      selectedLotType === "open_space"
                        ? "HOA-owned lots don't pay dues or vote"
                        : "Private property"}
                    </p>
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Label (optional)
                    </label>
                    <input
                      type="text"
                      value={lotLabel}
                      onChange={(e) => setLotLabel(e.target.value)}
                      placeholder="e.g., Clubhouse, Water Tower, Tennis Court"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Short name for community/utility lots
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={lotDescription}
                      onChange={(e) => setLotDescription(e.target.value)}
                      placeholder="e.g., Multi-purpose court with basketball and volleyball hoops"
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
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
                      className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Map className="w-12 h-12 mx-auto mb-3 text-gray-400" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-600" />
              Merge Lots
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Merge {selectedLots.size} lots into one household. The first
              selected lot will be the primary lot.
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
