import { useEffect, useState } from "react";
import { MapContainer, ImageOverlay, GeoJSON } from "react-leaflet";
import { LatLngBoundsExpression } from "leaflet";
import L from "leaflet";
import { LotMapping } from "@/types";

// Map dimensions
const MAP_WIDTH = 2304;
const MAP_HEIGHT = 3456;

// Map bounds [[y1, x1], [y2, x2]]
const mapBounds: LatLngBoundsExpression = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH],
];

interface LotAnnotationMapProps {
  selectedPathId: string | null;
  onLotSelect: (pathId: string) => void;
  mappings: LotMapping[];
}

export function LotAnnotationMap({
  selectedPathId,
  onLotSelect,
  mappings,
}: LotAnnotationMapProps) {
  const [lotsData, setLotsData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Create a mapping set for quick lookup
  const annotatedPathIds = new Set(mappings.map((m) => m.path_id));

  useEffect(() => {
    async function loadLotsData() {
      try {
        const cacheBust = Date.now();
        const response = await fetch(`/data/lots.geojson?t=${cacheBust}`);
        if (response.ok) {
          const data = await response.json();
          setLotsData(data);
        }
      } catch (err) {
        console.error("Error loading lots data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLotsData();
  }, []);

  const style = (
    feature?: GeoJSON.Feature<GeoJSON.Geometry, { path_id?: string }>,
  ) => {
    const isSelected = feature?.properties?.path_id === selectedPathId;
    const isAnnotated = feature?.properties?.path_id
      ? annotatedPathIds.has(feature.properties.path_id)
      : false;

    if (isSelected) {
      return {
        color: "#f59e0b", // Amber for selected
        weight: 3,
        fillColor: "#fbbf24",
        fillOpacity: 0.5,
      };
    }

    if (isAnnotated) {
      return {
        color: "#22c55e", // Green for annotated
        weight: 2,
        fillColor: "#86efac",
        fillOpacity: 0.3,
      };
    }

    return {
      color: "#6b7280", // Gray for unannotated
      weight: 2,
      fillColor: "#d1d5db",
      fillOpacity: 0.2,
    };
  };

  const onEachFeature = (
    feature: GeoJSON.Feature<GeoJSON.Geometry, { path_id?: string }>,
    layer: L.Layer,
  ) => {
    const pathId = feature.properties?.path_id;
    if (pathId) {
      layer.on({
        click: () => {
          onLotSelect(pathId);
        },
        mouseover: (e) => {
          const layer = e.target as L.Polygon;
          const currentStyle = layer.options;
          layer.setStyle({
            fillOpacity: (currentStyle.fillOpacity || 0.2) + 0.2,
          });
        },
        mouseout: (e) => {
          const layer = e.target as L.Polygon;
          layer.setStyle(style(feature));
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="relative h-[600px] w-full">
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
          {lotsData && (
            <GeoJSON
              data={lotsData}
              style={style}
              onEachFeature={onEachFeature}
            />
          )}
        </MapContainer>
      </div>
      <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-400 border-2 border-amber-500"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-300 border-2 border-green-500"></div>
            <span>Annotated</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-300 border-2 border-gray-500"></div>
            <span>Unannotated</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">Click on a lot to select it</p>
      </div>
    </div>
  );
}
