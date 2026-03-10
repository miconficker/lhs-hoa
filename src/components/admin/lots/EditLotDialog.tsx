import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { LotOwnership } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface EditLotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: LotOwnership | null;
  onSuccess: () => void;
}

export function EditLotDialog({
  open,
  onOpenChange,
  lot,
  onSuccess,
}: EditLotDialogProps) {
  const [lotType, setLotType] = useState<
    | "residential"
    | "resort"
    | "commercial"
    | "community"
    | "utility"
    | "open_space"
  >((lot?.lot_type as any) || "residential");
  const [lotStatus, setLotStatus] = useState<
    "built" | "vacant_lot" | "under_construction"
  >((lot?.lot_status as any) || "vacant_lot");
  const [lotLabel, setLotLabel] = useState(lot?.lot_label || "");
  const [lotDescription, setLotDescription] = useState(
    (lot as any)?.lot_description || "",
  );
  const [lotSize, setLotSize] = useState(
    lot?.lot_size_sqm ? String(lot.lot_size_sqm) : "",
  );
  const [street, setStreet] = useState(lot?.street || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lot) {
      setLotType(lot.lot_type || "residential");
      setLotStatus(lot.lot_status || "vacant_lot");
      setLotLabel(lot.lot_label || "");
      setLotDescription((lot as any)?.lot_description || "");
      setLotSize(lot.lot_size_sqm ? String(lot.lot_size_sqm) : "");
      setStreet(lot.street || "");
    }
  }, [lot]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lot) return;

    setIsSubmitting(true);
    try {
      // Update lot type if changed
      if (lotType !== lot.lot_type) {
        const response = await api.admin.updateLotType(lot.lot_id, lotType);
        if (response.error) {
          throw new Error(response.error);
        }
      }

      // Update lot status if changed
      if (lotStatus !== lot.lot_status) {
        const response = await api.admin.updateLotStatus(lot.lot_id, lotStatus);
        if (response.error) {
          throw new Error(response.error);
        }
      }

      // Update lot label if changed
      const newLabel = lotLabel.trim() || null;
      if (newLabel !== (lot.lot_label || null)) {
        const response = await api.admin.updateLotLabel(lot.lot_id, newLabel);
        if (response.error) {
          throw new Error(response.error);
        }
      }

      // Update lot description if changed
      const newDescription = lotDescription.trim() || null;
      if (newDescription !== ((lot as any)?.lot_description || null)) {
        const response = await api.admin.updateLotDescription(
          lot.lot_id,
          newDescription,
        );
        if (response.error) {
          throw new Error(response.error);
        }
      }

      // Update lot size if changed
      const newSize = lotSize.trim() ? parseFloat(lotSize) : null;
      if (newSize !== (lot.lot_size_sqm || null)) {
        const response = await api.admin.updateLotSize(
          lot.lot_id,
          newSize as number | null,
        );
        if (response.error) {
          throw new Error(response.error);
        }
      }

      // Update street if changed
      const newStreet = street.trim() || null;
      if (newStreet !== (lot.street || null)) {
        const response = await api.admin.updateLotStreet(
          lot.lot_id,
          newStreet || "",
        );
        if (response.error) {
          throw new Error(response.error);
        }
      }

      toast.success("Lot updated successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating lot:", error);
      toast.error(error.message || "Failed to update lot");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!lot) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lot</DialogTitle>
          <DialogDescription>
            Edit properties for Block {lot.block_number}, Lot {lot.lot_number}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lot_type">Lot Type</Label>
              <Select
                value={lotType}
                onValueChange={(v) =>
                  setLotType(
                    v as
                      | "residential"
                      | "resort"
                      | "commercial"
                      | "community"
                      | "utility"
                      | "open_space",
                  )
                }
              >
                <SelectTrigger id="lot_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="resort">Resort</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="open_space">Open Space</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_status">Status</Label>
              <Select
                value={lotStatus}
                onValueChange={(v) =>
                  setLotStatus(
                    v as "built" | "vacant_lot" | "under_construction",
                  )
                }
              >
                <SelectTrigger id="lot_status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="built">Built</SelectItem>
                  <SelectItem value="vacant_lot">Vacant Lot</SelectItem>
                  <SelectItem value="under_construction">
                    Under Construction
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_label">Label</Label>
              <Input
                id="lot_label"
                placeholder="e.g., Clubhouse, Pool, Park"
                value={lotLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLotLabel(e.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                Optional display name for the lot
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_description">Description</Label>
              <Input
                id="lot_description"
                placeholder="e.g., Main clubhouse with pool access"
                value={lotDescription}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLotDescription(e.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="street">Street</Label>
              <Input
                id="street"
                placeholder="e.g., Mahogany Street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_size">Size (m²)</Label>
              <Input
                id="lot_size"
                type="number"
                placeholder="e.g., 150"
                value={lotSize}
                onChange={(e) => setLotSize(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
