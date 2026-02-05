import { useEffect, useState } from "react";
import {
  LotAnnotationMap,
  LotAnnotationForm,
  ReferenceImageViewer,
  AnnotationProgress,
} from "@/components/annotation";
import { Button } from "@/components/ui/button";
import { LotMapping, LotMappingFile } from "@/types";
import { Download, Upload, Map as MapIcon } from "lucide-react";

// Default lot-mapping.json content for initialization
const DEFAULT_MAPPING_FILE: LotMappingFile = {
  version: "1.0",
  created_at: new Date().toISOString(),
  mappings: [],
};

export function AnnotateLotsPage() {
  const [mappings, setMappings] = useState<LotMapping[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [lotsData, setLotsData] = useState<GeoJSON.FeatureCollection | null>(
    null,
  );
  const [totalLots, setTotalLots] = useState(0);

  // Load lots data to get total count and path IDs
  useEffect(() => {
    async function loadLotsData() {
      try {
        const cacheBust = Date.now();
        const response = await fetch(`/data/lots.geojson?t=${cacheBust}`);
        if (response.ok) {
          const data = await response.json();
          setLotsData(data);
          setTotalLots(data.features?.length || 0);
        }
      } catch (err) {
        console.error("Error loading lots data:", err);
      }
    }

    loadLotsData();
  }, []);

  // Load mappings from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("lot-mappings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as LotMappingFile;
        setMappings(parsed.mappings || []);
      } catch (err) {
        console.error("Error parsing stored mappings:", err);
      }
    }
  }, []);

  // Save mappings to localStorage whenever they change
  useEffect(() => {
    if (mappings.length > 0 || localStorage.getItem("lot-mappings")) {
      const mappingFile: LotMappingFile = {
        ...DEFAULT_MAPPING_FILE,
        mappings,
      };
      localStorage.setItem("lot-mappings", JSON.stringify(mappingFile));
    }
  }, [mappings]);

  const currentMapping = selectedPathId
    ? mappings.find((m) => m.path_id === selectedPathId) || null
    : null;

  const handleSave = (
    pathId: string,
    lotNumber: string,
    blockNumber?: string,
  ) => {
    setMappings((prev) => {
      const existingIndex = prev.findIndex((m) => m.path_id === pathId);
      const newMapping: LotMapping = {
        path_id: pathId,
        lot_number: lotNumber,
        block_number: blockNumber,
        annotated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = newMapping;
        return updated;
      }

      return [...prev, newMapping];
    });
  };

  const handleClear = () => {
    setSelectedPathId(null);
  };

  const getNextUnannotatedLot = (
    currentPathId: string | null,
  ): string | null => {
    if (!lotsData?.features) return null;

    const annotatedIds = new Set(mappings.map((m) => m.path_id));
    const features = lotsData.features as Array<
      GeoJSON.Feature<GeoJSON.Geometry, { path_id?: string }>
    >;

    // Find the index of current selection
    let startIndex = 0;
    if (currentPathId) {
      startIndex = features.findIndex(
        (f) => f.properties?.path_id === currentPathId,
      );
      if (startIndex < 0) startIndex = 0;
    }

    // Search forward from current position
    for (let i = startIndex + 1; i < features.length; i++) {
      const pathId = features[i]?.properties?.path_id;
      if (pathId && !annotatedIds.has(pathId)) {
        return pathId;
      }
    }

    // Wrap around and search from beginning
    for (let i = 0; i < startIndex; i++) {
      const pathId = features[i]?.properties?.path_id;
      if (pathId && !annotatedIds.has(pathId)) {
        return pathId;
      }
    }

    return null;
  };

  const getPrevUnannotatedLot = (
    currentPathId: string | null,
  ): string | null => {
    if (!lotsData?.features) return null;

    const annotatedIds = new Set(mappings.map((m) => m.path_id));
    const features = lotsData.features as Array<
      GeoJSON.Feature<GeoJSON.Geometry, { path_id?: string }>
    >;

    // Find the index of current selection
    let startIndex = features.length - 1;
    if (currentPathId) {
      startIndex = features.findIndex(
        (f) => f.properties?.path_id === currentPathId,
      );
      if (startIndex < 0) startIndex = features.length - 1;
    }

    // Search backward from current position
    for (let i = startIndex - 1; i >= 0; i--) {
      const pathId = features[i]?.properties?.path_id;
      if (pathId && !annotatedIds.has(pathId)) {
        return pathId;
      }
    }

    // Wrap around and search from end
    for (let i = features.length - 1; i > startIndex; i--) {
      const pathId = features[i]?.properties?.path_id;
      if (pathId && !annotatedIds.has(pathId)) {
        return pathId;
      }
    }

    return null;
  };

  const handleNextUnannotated = () => {
    const next = getNextUnannotatedLot(selectedPathId);
    if (next) setSelectedPathId(next);
  };

  const handlePrevUnannotated = () => {
    const prev = getPrevUnannotatedLot(selectedPathId);
    if (prev) setSelectedPathId(prev);
  };

  const handleExport = () => {
    const mappingFile: LotMappingFile = {
      ...DEFAULT_MAPPING_FILE,
      mappings,
    };

    const blob = new Blob([JSON.stringify(mappingFile, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lot-mapping-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(
              e.target?.result as string,
            ) as LotMappingFile;
            if (parsed.mappings && Array.isArray(parsed.mappings)) {
              setMappings(parsed.mappings);
            }
          } catch (err) {
            console.error("Error parsing imported file:", err);
            alert("Error importing file. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const hasUnannotated = mappings.length < totalLots;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <MapIcon className="w-8 h-8 text-primary-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Lot Annotation Tool
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Assign lot numbers to map polygons
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Map */}
        <div className="lg:col-span-2">
          <LotAnnotationMap
            selectedPathId={selectedPathId}
            onLotSelect={setSelectedPathId}
            mappings={mappings}
          />
        </div>

        {/* Right column: Form, Reference, Progress */}
        <div className="space-y-6">
          <LotAnnotationForm
            selectedPathId={selectedPathId}
            currentMapping={currentMapping}
            onSave={handleSave}
            onClear={handleClear}
            onNextUnannotated={handleNextUnannotated}
            onPrevUnannotated={handlePrevUnannotated}
            hasUnannotated={hasUnannotated}
            totalLots={totalLots}
            annotatedCount={mappings.length}
          />

          <AnnotationProgress mappings={mappings} totalLots={totalLots} />

          <ReferenceImageViewer />
        </div>
      </div>
    </div>
  );
}
