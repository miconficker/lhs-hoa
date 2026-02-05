import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LotMapping } from "@/types";
import { Save, X, ChevronLeft, ChevronRight } from "lucide-react";

interface LotAnnotationFormProps {
  selectedPathId: string | null;
  currentMapping: LotMapping | null;
  onSave: (pathId: string, lotNumber: string, blockNumber?: string) => void;
  onClear: () => void;
  onNextUnannotated: () => void;
  onPrevUnannotated: () => void;
  hasUnannotated: boolean;
  totalLots: number;
  annotatedCount: number;
}

export function LotAnnotationForm({
  selectedPathId,
  currentMapping,
  onSave,
  onClear,
  onNextUnannotated,
  onPrevUnannotated,
  hasUnannotated,
  totalLots,
  annotatedCount,
}: LotAnnotationFormProps) {
  const [lotNumber, setLotNumber] = useState("");
  const [blockNumber, setBlockNumber] = useState("");

  // Update form when selection changes
  useEffect(() => {
    if (currentMapping) {
      setLotNumber(currentMapping.lot_number);
      setBlockNumber(currentMapping.block_number || "");
    } else {
      setLotNumber("");
      setBlockNumber("");
    }
  }, [currentMapping]);

  const handleSave = () => {
    if (!selectedPathId || !lotNumber.trim()) return;
    onSave(selectedPathId, lotNumber.trim(), blockNumber.trim() || undefined);
    setLotNumber("");
    setBlockNumber("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  if (!selectedPathId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Lot Details
        </h2>
        <div className="text-center py-8 text-gray-500">
          <p>Select a lot from the map to annotate</p>
          <p className="text-sm mt-2">
            {annotatedCount} of {totalLots} lots annotated
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Lot Details</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-sm text-gray-600">Path ID</p>
          <p className="font-mono text-sm font-medium text-gray-900">
            {selectedPathId}
          </p>
        </div>

        <div>
          <Label htmlFor="lot-number">Lot Number *</Label>
          <Input
            id="lot-number"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 1B, 2A"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="block-number">Block Number</Label>
          <Input
            id="block-number"
            value={blockNumber}
            onChange={(e) => setBlockNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., 1, 2"
            className="mt-1"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSave}
            disabled={!lotNumber.trim()}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={onPrevUnannotated}
            disabled={!hasUnannotated}
            className="flex-1"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={onNextUnannotated}
            disabled={!hasUnannotated}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center">
          Press Enter to save • Use arrow buttons to navigate unannotated lots
        </p>
      </div>
    </div>
  );
}
