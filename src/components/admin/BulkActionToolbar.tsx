import { Button } from "@/components/ui/button";

interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "ghost" | "outline";
}

interface BulkActionToolbarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkAction[];
}

export function BulkActionToolbar({
  selectedCount,
  onClear,
  actions,
}: BulkActionToolbarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-4">
      <span
        className="text-sm font-medium text-blue-900 dark:text-blue-100"
        aria-live="polite"
      >
        {selectedCount} selected
      </span>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant || "default"}
            size="sm"
            onClick={action.onClick}
            className="w-full sm:w-auto"
          >
            {action.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="w-full sm:w-auto"
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
