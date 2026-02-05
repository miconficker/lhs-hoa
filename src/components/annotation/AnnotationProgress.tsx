import { CheckCircle2, Circle } from "lucide-react";
import { LotMapping } from "@/types";

interface AnnotationProgressProps {
  mappings: LotMapping[];
  totalLots: number;
}

export function AnnotationProgress({
  mappings,
  totalLots,
}: AnnotationProgressProps) {
  const annotatedCount = mappings.length;
  const unannotatedCount = totalLots - annotatedCount;
  const percentage = totalLots > 0 ? (annotatedCount / totalLots) * 100 : 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress</h2>

      <div className="space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">Completion</span>
            <span className="font-medium text-gray-900">
              {annotatedCount} / {totalLots}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary-600 h-full transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">
            {percentage.toFixed(1)}%
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-2xl font-bold text-green-700">
                {annotatedCount}
              </p>
              <p className="text-xs text-green-600">Annotated</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Circle className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-700">
                {unannotatedCount}
              </p>
              <p className="text-xs text-gray-600">Remaining</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
