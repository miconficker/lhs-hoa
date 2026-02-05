import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReferenceImageViewerProps {
  imageUrl?: string;
}

const DEFAULT_IMAGE_URL = "/reference.png";

export function ReferenceImageViewer({
  imageUrl = DEFAULT_IMAGE_URL,
}: ReferenceImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageError, setImageError] = useState(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Reference Image</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={handleRotate}>
            <RotateCw className="h-4 w-4" />
          </Button>
          {(zoom !== 1 || rotation !== 0) && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
          )}
        </div>
      </div>
      <div
        className="relative bg-gray-100 overflow-auto"
        style={{ height: "600px" }}
      >
        {imageError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-6">
              <p className="text-gray-500 mb-2">Reference image not found</p>
              <p className="text-sm text-gray-400">
                Place your reference image at{" "}
                <code className="bg-gray-200 px-1 rounded">/reference.png</code>
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center min-h-full p-4">
            <img
              src={imageUrl}
              alt="Reference"
              onError={handleImageError}
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: "center",
                maxWidth: "none",
                transition: "transform 0.2s ease-out",
              }}
              className="shadow-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
