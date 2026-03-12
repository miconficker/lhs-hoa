// src/pages/admin/financials/DemandGenerationModal.tsx
import { useState } from "react";
import { api } from "@/lib/api";
import type { DemandGenerationResponse } from "@/types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Receipt } from "lucide-react";

interface DemandGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function DemandGenerationModal({
  open,
  onOpenChange,
  onComplete,
}: DemandGenerationModalProps) {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [dueDate, setDueDate] = useState(`${new Date().getFullYear()}-01-31`);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    generated: number;
    skipped: number;
    rate_per_sqm: number;
  } | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setResult(null);

    try {
      const response = await api.delinquency.generateDemands({
        year: parseInt(year),
        due_date: dueDate,
      });

      if (response.error) {
        toast.error(response.error);
        setGenerating(false);
        return;
      }

      if (response.data) {
        setResult(response.data as DemandGenerationResponse);
        toast.success(
          `Generated ${response.data.generated} demands, skipped ${response.data.skipped} existing`,
        );
        onComplete?.();
      }
    } catch (error) {
      console.error("Error generating demands:", error);
      toast.error("Failed to generate demands");
    } finally {
      setGenerating(false);
    }
  }

  function handleClose() {
    setResult(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Generate Payment Demands
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="year">Fiscal Year *</Label>
              <Input
                id="year"
                type="number"
                min="2000"
                max="2100"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date *</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Payment demands will be due on this date (30 days from Jan 1 by
                default)
              </p>
            </div>

            <div className="bg-muted p-3 rounded-lg text-sm">
              <p className="font-medium">This will:</p>
              <ul className="list-disc list-inside mt-1 text-muted-foreground">
                <li>Create demands for all residential lots</li>
                <li>Calculate amount: lot_size × rate × 12</li>
                <li>Skip lots that already have demands for this year</li>
              </ul>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={generating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generating}>
                {generating ? "Generating..." : "Generate Demands"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="font-medium text-green-900 dark:text-green-100">
                Demands Generated Successfully
              </p>
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                <p>✓ {result.generated} new demands created</p>
                {result.skipped > 0 && (
                  <p>○ {result.skipped} skipped (already exists)</p>
                )}
                <p className="mt-2">
                  Rate: ₱{result.rate_per_sqm.toLocaleString()}/sqm/year
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
