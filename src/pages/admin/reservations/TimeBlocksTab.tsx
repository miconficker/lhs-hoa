import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Calendar, Plus, Pencil, Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TimeBlock,
  AmenityType,
  TimeBlockSlot,
  CreateTimeBlockInput,
} from "@/types";

interface TimeBlocksTabProps {
  amenityTypes: AmenityType[];
}

const amenityLabels: Record<AmenityType, string> = {
  clubhouse: "Clubhouse",
  pool: "Swimming Pool",
  "basketball-court": "Basketball Court",
  "tennis-court": "Tennis Court",
};

const slotLabels: Record<TimeBlockSlot, string> = {
  AM: "Morning (8AM - 12PM)",
  PM: "Afternoon (1PM - 5PM)",
  FULL_DAY: "Full Day (8AM - 5PM)",
};

interface FormData {
  amenity_type: AmenityType | "";
  date: string;
  slot: TimeBlockSlot | "";
  reason: string;
}

const emptyForm: FormData = {
  amenity_type: "",
  date: "",
  slot: "",
  reason: "",
};

export function TimeBlocksTab({ amenityTypes }: TimeBlocksTabProps) {
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);

  useEffect(() => {
    loadTimeBlocks();
  }, []);

  const loadTimeBlocks = async () => {
    try {
      setIsLoading(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch("/api/admin/time-blocks", {
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load time blocks");
      }

      const data = await response.json();
      setTimeBlocks(data.time_blocks || []);
    } catch (error) {
      console.error("Error loading time blocks:", error);
      toast.error("Failed to load time blocks");
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingBlock(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const openEditDialog = (block: TimeBlock) => {
    setEditingBlock(block);
    setFormData({
      amenity_type: block.amenity_type,
      date: block.date,
      slot: block.slot,
      reason: block.reason,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingBlock(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (
      !formData.amenity_type ||
      !formData.date ||
      !formData.slot ||
      !formData.reason.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);
      const hoa_token = localStorage.getItem("hoa_token");

      const input: CreateTimeBlockInput = {
        amenity_type: formData.amenity_type as AmenityType,
        date: formData.date,
        slot: formData.slot as TimeBlockSlot,
        reason: formData.reason.trim(),
      };

      const url = editingBlock
        ? `/api/admin/time-blocks/${editingBlock.id}`
        : "/api/admin/time-blocks";

      const response = await fetch(url, {
        method: editingBlock ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${hoa_token}`,
        },
        body: JSON.stringify(
          editingBlock ? { ...input, id: editingBlock.id } : input,
        ),
      });

      if (!response.ok) {
        throw new Error("Failed to save time block");
      }

      await loadTimeBlocks();
      closeDialog();
      toast.success(editingBlock ? "Time block updated" : "Time block created");
    } catch (error) {
      console.error("Error saving time block:", error);
      toast.error("Failed to save time block");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (blockId: string) => {
    if (!confirm("Are you sure you want to delete this time block?")) {
      return;
    }

    try {
      setIsDeleting(blockId);
      const hoa_token = localStorage.getItem("hoa_token");

      const response = await fetch(`/api/admin/time-blocks/${blockId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${hoa_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete time block");
      }

      setTimeBlocks((prev) => prev.filter((b) => b.id !== blockId));
      toast.success("Time block deleted");
    } catch (error) {
      console.error("Error deleting time block:", error);
      toast.error("Failed to delete time block");
    } finally {
      setIsDeleting(null);
    }
  };

  const updateForm = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading time blocks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Time Blocks</h2>
          <p className="text-muted-foreground">
            Block amenity time slots for maintenance, events, or other reasons
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Time Block
        </Button>
      </div>

      {/* Time Blocks Table */}
      {timeBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Ban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            No time blocks configured
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Create time blocks to prevent residents from booking specific
            amenity slots.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Amenity
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {timeBlocks
                  .sort(
                    (a, b) =>
                      new Date(a.date).getTime() - new Date(b.date).getTime(),
                  )
                  .map((block) => (
                    <tr key={block.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {new Date(block.date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {slotLabels[block.slot]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {amenityLabels[block.amenity_type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm">{block.reason}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(block.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(block)}
                            aria-label="Edit time block"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(block.id)}
                            disabled={isDeleting === block.id}
                            aria-label="Delete time block"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingBlock ? "Edit Time Block" : "Create Time Block"}
            </DialogTitle>
            <DialogDescription>
              {editingBlock
                ? "Update the time block details below."
                : "Block a time slot to prevent residents from booking it."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amenity">Amenity *</Label>
                <Select
                  value={formData.amenity_type}
                  onValueChange={(v) => updateForm("amenity_type", v)}
                >
                  <SelectTrigger id="amenity">
                    <SelectValue placeholder="Select amenity" />
                  </SelectTrigger>
                  <SelectContent>
                    {amenityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {amenityLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateForm("date", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slot">Time Slot *</Label>
                <Select
                  value={formData.slot}
                  onValueChange={(v) => updateForm("slot", v)}
                >
                  <SelectTrigger id="slot">
                    <SelectValue placeholder="Select time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AM">Morning (8AM - 12PM)</SelectItem>
                    <SelectItem value="PM">Afternoon (1PM - 5PM)</SelectItem>
                    <SelectItem value="FULL_DAY">
                      Full Day (8AM - 5PM)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Input
                  id="reason"
                  placeholder="e.g., Maintenance, Private Event, etc."
                  value={formData.reason}
                  onChange={(e) => updateForm("reason", e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingBlock
                    ? "Update"
                    : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
