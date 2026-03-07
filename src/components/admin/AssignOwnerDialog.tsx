import { useState } from "react";
import type { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignOwnerDialogProps {
  homeowners: User[];
  lotCount: number;
  onConfirm: (ownerId: string) => void;
  onCancel: () => void;
}

export function AssignOwnerDialog({
  homeowners,
  lotCount,
  onConfirm,
  onCancel,
}: AssignOwnerDialogProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("");

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Owner</DialogTitle>
          <DialogDescription>
            Select a homeowner to assign to {lotCount} lot
            {lotCount > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label
            htmlFor="owner-select"
            className="block text-sm font-medium mb-2"
          >
            Select Owner
          </label>
          <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
            <SelectTrigger id="owner-select">
              <SelectValue placeholder="Choose a homeowner..." />
            </SelectTrigger>
            <SelectContent>
              {homeowners.map((owner) => (
                <SelectItem key={owner.id} value={owner.id}>
                  {owner.first_name} {owner.last_name} ({owner.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(selectedOwnerId)}
            disabled={!selectedOwnerId}
          >
            Next
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
