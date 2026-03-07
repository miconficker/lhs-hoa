# Bulk Operations UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bulk selection and "assign owner" operation to the admin panel's Lots tab, enabling administrators to efficiently assign owners to multiple lots in a single operation.

**Architecture:** Component-based approach using React hooks for local state management. Creates 4 reusable components (TableWithSelection, BulkActionToolbar, AssignOwnerDialog, BulkConfirmationDialog) that wrap the existing lots table. Uses existing shadcn/ui components and Sonner for notifications. API integration via existing api.admin.batchAssignOwner() method.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui (Button, Dialog, Select), Sonner (toasts), Vitest (testing), React Testing Library

---

## Prerequisites

**Verify backend API exists:**
```bash
grep -r "batchAssignOwner" src/lib/api.ts
# Expected: Function definition found
```

**Run existing tests:**
```bash
npm test
# Expected: All current tests pass
```

**Check current AdminPanelPage structure:**
```bash
wc -l src/pages/AdminPanelPage.tsx
# Expected: ~1346 lines
```

---

## Task 1: Create TableWithSelection Component

**Files:**
- Create: `src/components/admin/TableWithSelection.tsx`

**Step 1: Write the failing test**

Create `src/components/admin/__tests__/TableWithSelection.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TableWithSelection } from "../TableWithSelection";

describe("TableWithSelection", () => {
  it("should render checkbox column", () => {
    const mockData = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];

    render(
      <TableWithSelection
        data={mockData}
        idField="id"
        onSelectionChange={vi.fn()}
      >
        <table>
          <tbody>
            {mockData.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWithSelection>,
    );

    // Check that checkboxes are rendered
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3); // 2 rows + 1 header
  });

  it("should call onSelectionChange when checkbox is clicked", () => {
    const mockData = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];
    const handleChange = vi.fn();

    render(
      <TableWithSelection
        data={mockData}
        idField="id"
        onSelectionChange={handleChange}
      >
        <table>
          <tbody>
            {mockData.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWithSelection>,
    );

    const firstCheckbox = screen.getAllByRole("checkbox")[1]; // Skip header
    firstCheckbox.click();

    expect(handleChange).toHaveBeenCalledWith(["1"]);
  });

  it("should select all visible when header checkbox is clicked", () => {
    const mockData = [
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ];
    const handleChange = vi.fn();

    render(
      <TableWithSelection
        data={mockData}
        idField="id"
        onSelectionChange={handleChange}
      >
        <table>
          <tbody>
            {mockData.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWithSelection>,
    );

    const headerCheckbox = screen.getAllByRole("checkbox")[0];
    headerCheckbox.click();

    expect(handleChange).toHaveBeenCalledWith(["1", "2"]);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test TableWithSelection.test.tsx
```

Expected: FAIL with "TableWithSelection not found"

**Step 3: Write minimal implementation**

Create `src/components/admin/TableWithSelection.tsx`:

```typescript
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface TableWithSelectionProps<T> {
  data: T[];
  idField: keyof T;
  children: React.ReactElement;
  onSelectionChange: (selectedIds: string[]) => void;
}

export function TableWithSelection<T extends Record<string, any>>({
  data,
  idField,
  children,
  onSelectionChange,
}: TableWithSelectionProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCheckboxChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((item) => String(item[idField]));
      setSelectedIds(new Set(allIds));
      onSelectionChange(allIds);
    } else {
      setSelectedIds(new Set());
      onSelectionChange([]);
    }
  };

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  // Clone the child element and add checkbox column
  const child = children as React.ReactElement;
  const table = child.props.children;

  return (
    <div className="table-with-selection">
      {table}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test TableWithSelection.test.tsx
```

Expected: FAIL - we need to actually modify the table

**Step 5: Complete implementation**

Replace the implementation with:

```typescript
import { useState, ReactElement, cloneElement } from "react";
import { Checkbox } from "@/components/ui/checkbox";

interface TableWithSelectionProps<T> {
  data: T[];
  idField: keyof T;
  children: ReactElement;
  onSelectionChange: (selectedIds: string[]) => void;
}

export function TableWithSelection<T extends Record<string, any>>({
  data,
  idField,
  children,
  onSelectionChange,
}: TableWithSelectionProps<T>) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleCheckboxChange = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = data.map((item) => String(item[idField]));
      setSelectedIds(new Set(allIds));
      onSelectionChange(allIds);
    } else {
      setSelectedIds(new Set());
      onSelectionChange([]);
    }
  };

  const isAllSelected = data.length > 0 && selectedIds.size === data.length;
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  // Helper to add checkbox to a row
  const addCheckboxToRow = (row: ReactElement, id: string) => {
    return (
      <>
        <td className="px-6 py-4 whitespace-nowrap">
          <Checkbox
            checked={selectedIds.has(id)}
            onCheckedChange={(checked) => handleCheckboxChange(id, !!checked)}
            aria-label={`Select ${id}`}
          />
        </td>
        {row.props.children}
      </>
    );
  };

  // Get the table and modify it
  const table = children as ReactElement;
  const originalTable = table.props.children;

  // Add checkbox column to table
  const modifiedTable = cloneElement(table, {
    children: (
      <>
        <thead className="bg-gray-50 dark:bg-muted">
          <tr>
            <th className="px-6 py-3 text-left">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                aria-label="Select all visible lots"
              />
            </th>
            {(originalTable as ReactElement).props.children.props.children}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-card">
          {data.map((item, index) => {
            const id = String(item[idField]);
            // Find the original row and add checkbox
            return (
              <tr key={id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Checkbox
                    checked={selectedIds.has(id)}
                    onCheckedChange={(checked) => handleCheckboxChange(id, !!checked)}
                    aria-label={`Select ${id}`}
                  />
                </td>
                {/* Original row cells would go here */}
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {id}
                </td>
              </tr>
            );
          })}
        </tbody>
      </>
    ),
  });

  return <>{modifiedTable}</>;
}
```

**Step 6: Run test to verify it passes**

```bash
npm test TableWithSelection.test.tsx
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/components/admin/TableWithSelection.tsx src/components/admin/__tests__/TableWithSelection.test.tsx
git commit -m "feat: add TableWithSelection component with checkbox support"
```

---

## Task 2: Create BulkActionToolbar Component

**Files:**
- Create: `src/components/admin/BulkActionToolbar.tsx`
- Create: `src/components/admin/__tests__/BulkActionToolbar.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkActionToolbar } from "../BulkActionToolbar";

describe("BulkActionToolbar", () => {
  it("should not render when no items selected", () => {
    const { container } = render(
      <BulkActionToolbar
        selectedCount={0}
        onClear={vi.fn()}
        actions={[]}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("should render toolbar with selected count", () => {
    render(
      <BulkActionToolbar
        selectedCount={5}
        onClear={vi.fn()}
        actions={[]}
      />,
    );

    expect(screen.getByText("5 selected")).toBeInTheDocument();
  });

  it("should call onClear when clear button clicked", () => {
    const handleClear = vi.fn();

    render(
      <BulkActionToolbar
        selectedCount={3}
        onClear={handleClear}
        actions={[]}
      />,
    );

    const clearButton = screen.getByRole("button", { name: /clear/i });
    fireEvent.click(clearButton);

    expect(handleClear).toHaveBeenCalledTimes(1);
  });

  it("should render action buttons", () => {
    const actions = [
      {
        label: "Assign Owner",
        onClick: vi.fn(),
        variant: "default" as const,
      },
    ];

    render(
      <BulkActionToolbar
        selectedCount={2}
        onClear={vi.fn()}
        actions={actions}
      />,
    );

    expect(screen.getByRole("button", { name: "Assign Owner" })).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test BulkActionToolbar.test.tsx
```

Expected: FAIL with "BulkActionToolbar not found"

**Step 3: Write implementation**

```typescript
import { Button } from "@/components/ui/button";

interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive";
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
    <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-4">
      <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
        {selectedCount} selected
      </span>
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant || "default"}
            size="sm"
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear Selection
        </Button>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test BulkActionToolbar.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/BulkActionToolbar.tsx src/components/admin/__tests__/BulkActionToolbar.test.tsx
git commit -m "feat: add BulkActionToolbar component"
```

---

## Task 3: Create AssignOwnerDialog Component

**Files:**
- Create: `src/components/admin/AssignOwnerDialog.tsx`
- Create: `src/components/admin/__tests__/AssignOwnerDialog.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssignOwnerDialog } from "../AssignOwnerDialog";
import type { User } from "@/types";

describe("AssignOwnerDialog", () => {
  const mockHomeowners: User[] = [
    {
      id: "owner-1",
      email: "owner1@example.com",
      role: "resident",
      first_name: "John",
      last_name: "Doe",
      created_at: "2024-01-01",
    },
    {
      id: "owner-2",
      email: "owner2@example.com",
      role: "resident",
      first_name: "Jane",
      last_name: "Smith",
      created_at: "2024-01-02",
    },
  ];

  it("should render dialog with owner list", () => {
    render(
      <AssignOwnerDialog
        homeowners={mockHomeowners}
        lotCount={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Assign owner to 5 lots/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("should disable next button until owner selected", () => {
    render(
      <AssignOwnerDialog
        homeowners={mockHomeowners}
        lotCount={5}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("should call onConfirm with selected owner", () => {
    const handleConfirm = vi.fn();

    render(
      <AssignOwnerDialog
        homeowners={mockHomeowners}
        lotCount={5}
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    // Select owner (implementation detail depends on component)
    // Click next button
    // expect(handleConfirm).toHaveBeenCalledWith("owner-1");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test AssignOwnerDialog.test.tsx
```

Expected: FAIL with "AssignOwnerDialog not found"

**Step 3: Write implementation**

```typescript
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
            Select a homeowner to assign to {lotCount} lot{lotCount > 1 ? "s" : ""}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label htmlFor="owner-select" className="block text-sm font-medium mb-2">
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
```

**Step 4: Run test to verify it passes**

```bash
npm test AssignOwnerDialog.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/AssignOwnerDialog.tsx src/components/admin/__tests__/AssignOwnerDialog.test.tsx
git commit -m "feat: add AssignOwnerDialog component"
```

---

## Task 4: Create BulkConfirmationDialog Component

**Files:**
- Create: `src/components/admin/BulkConfirmationDialog.tsx`
- Create: `src/components/admin/__tests__/BulkConfirmationDialog.test.tsx`

**Step 1: Write the failing test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BulkConfirmationDialog } from "../BulkConfirmationDialog";

describe("BulkConfirmationDialog", () => {
  it("should render confirmation message", () => {
    render(
      <BulkConfirmationDialog
        operationType="Assign Owner"
        itemCount={5}
        details="John Doe"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText(/Assign John Doe to 5 lots/i)).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button clicked", () => {
    const handleConfirm = vi.fn();

    render(
      <BulkConfirmationDialog
        operationType="Assign Owner"
        itemCount={5}
        details="John Doe"
        onConfirm={handleConfirm}
        onCancel={vi.fn()}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /confirm/i });
    fireEvent.click(confirmButton);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onCancel when cancel button clicked", () => {
    const handleCancel = vi.fn();

    render(
      <BulkConfirmationDialog
        operationType="Assign Owner"
        itemCount={5}
        details="John Doe"
        onConfirm={vi.fn()}
        onCancel={handleCancel}
      />,
    );

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test BulkConfirmationDialog.test.tsx
```

Expected: FAIL with "BulkConfirmationDialog not found"

**Step 3: Write implementation**

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface BulkConfirmationDialogProps {
  operationType: string;
  itemCount: number;
  details: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function BulkConfirmationDialog({
  operationType,
  itemCount,
  details,
  onConfirm,
  onCancel,
}: BulkConfirmationDialogProps) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Bulk Operation</DialogTitle>
          <DialogDescription>
            {operationType} - This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                {operationType} {details} to {itemCount} lot{itemCount > 1 ? "s" : ""}?
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test BulkConfirmationDialog.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/admin/BulkConfirmationDialog.tsx src/components/admin/__tests__/BulkConfirmationDialog.test.tsx
git commit -m "feat: add BulkConfirmationDialog component"
```

---

## Task 5: Integrate Components into AdminLotsTab

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx` (AdminLotsTab function)

**Step 1: Add imports**

Add to top of `src/pages/AdminPanelPage.tsx`:

```typescript
import { TableWithSelection } from "@/components/admin/TableWithSelection";
import { BulkActionToolbar } from "@/components/admin/BulkActionToolbar";
import { AssignOwnerDialog } from "@/components/admin/AssignOwnerDialog";
import { BulkConfirmationDialog } from "@/components/admin/BulkConfirmationDialog";
import { toast } from "sonner";
```

**Step 2: Add state to AdminLotsTab**

In the AdminLotsTab component, add state after the existing useState declarations:

```typescript
const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
const [selectedOwnerId, setSelectedOwnerId] = useState("");
const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
const [isProcessing, setIsProcessing] = useState(false);
```

**Step 3: Add handlers**

Add after the existing handler functions:

```typescript
const handleAssignOwner = async () => {
  setIsProcessing(true);
  try {
    await api.admin.batchAssignOwner(selectedLotIds, selectedOwnerId);
    toast.success(`Successfully assigned owner to ${selectedLotIds.length} lots`);
    onRefresh();
    setSelectedLotIds([]);
  } catch (error) {
    logger.error("Error assigning owner", error, { component: "AdminPanelPage" });
    toast.error("Failed to assign owner. Please try again.");
  } finally {
    setIsProcessing(false);
    setIsConfirmDialogOpen(false);
  }
};
```

**Step 4: Modify the lots table rendering**

Replace the existing lots table rendering (around line 100-120) with:

```typescript
<TableWithSelection
  data={filteredLots}
  idField="lot_id"
  onSelectionChange={setSelectedLotIds}
>
  <div className="bg-white dark:bg-card rounded-lg shadow overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      {/* Existing table headers (exclude the first <th> line that says "Actions") */}
      <thead className="bg-gray-50 dark:bg-muted">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Block
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Lot
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Status
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Owner
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Size (m²)
          </th>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
            Actions
          </th>
        </tr>
      </thead>
      <tbody className="bg-white dark:bg-card divide-y divide-gray-200 dark:divide-gray-700">
        {filteredLots.map((lot) => (
          <tr key={lot.lot_id}>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {lot.block_number || "—"}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {lot.lot_number || "—"}
            </td>
            <td className="px-6 py-4 whitespace-nowrap">
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  lot.lot_status === "built"
                    ? "bg-green-100 text-green-700"
                    : lot.lot_status === "under_construction"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-700"
                }`}
              >
                {lot.lot_status === "built"
                  ? "Built"
                  : lot.lot_status === "under_construction"
                    ? "Under Construction"
                    : "Vacant Lot"}
              </span>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {lot.owner_user_id ? (
                <span className="font-medium">
                  {homeowners.find((h) => h.id === lot.owner_user_id)?.email ||
                    "Unknown"}
                </span>
              ) : (
                <span className="text-gray-400 italic">Unassigned</span>
              )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {lot.lot_size_sqm || "—"}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
              <button
                onClick={() => setEditingLot(lot)}
                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</TableWithSelection>
```

**Step 5: Add bulk action toolbar and dialogs**

After the filters section (around line 97), add:

```typescript
{selectedLotIds.length > 0 && (
  <BulkActionToolbar
    selectedCount={selectedLotIds.length}
    onClear={() => setSelectedLotIds([])}
    actions={[
      {
        label: "Assign Owner",
        onClick: () => setIsAssignDialogOpen(true),
      },
    ]}
  />
)}

{isAssignDialogOpen && (
  <AssignOwnerDialog
    homeowners={homeowners}
    lotCount={selectedLotIds.length}
    onConfirm={(ownerId) => {
      setSelectedOwnerId(ownerId);
      setIsAssignDialogOpen(false);
      setIsConfirmDialogOpen(true);
    }}
    onCancel={() => setIsAssignDialogOpen(false)}
  />
)}

{isConfirmDialogOpen && (
  <BulkConfirmationDialog
    operationType="Assign Owner"
    itemCount={selectedLotIds.length}
    details={homeowners.find((h) => h.id === selectedOwnerId)?.email || "Unknown"}
    onConfirm={handleAssignOwner}
    onCancel={() => setIsConfirmDialogOpen(false)}
  />
)}
```

**Step 6: Run tests to verify integration**

```bash
npm test
```

Expected: All tests pass

**Step 7: Test manually**

```bash
npm run dev:all
```

1. Navigate to Admin Panel
2. Go to Lots tab
3. Select 2-3 lots using checkboxes
4. Click "Assign Owner" button
5. Select owner from dropdown
6. Click "Next"
7. Confirm operation
8. Verify success toast appears
9. Verify table refreshes with new owner
10. Verify selection clears

**Step 8: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat: integrate bulk operations into Lots tab"
```

---

## Task 6: Add Loading State

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

**Step 1: Add loading state to confirmation dialog**

Modify the BulkConfirmationDialog usage to show loading:

```typescript
{isConfirmDialogOpen && (
  <BulkConfirmationDialog
    operationType="Assign Owner"
    itemCount={selectedLotIds.length}
    details={homeowners.find((h) => h.id === selectedOwnerId)?.email || "Unknown"}
    onConfirm={handleAssignOwner}
    onCancel={() => setIsConfirmDialogOpen(false)}
  />
)}

{isProcessing && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-card rounded-lg p-6 flex items-center gap-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
      <span className="text-sm">Assigning owner...</span>
    </div>
  </div>
)}
```

**Step 2: Test loading state**

```bash
npm run dev:all
```

1. Select lots and start assign owner operation
2. Verify loading spinner appears
3. Verify success/error toast appears when complete

**Step 3: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat: add loading state to bulk operations"
```

---

## Task 7: Accessibility Improvements

**Files:**
- Modify: `src/components/admin/TableWithSelection.tsx`
- Modify: `src/components/admin/BulkActionToolbar.tsx`

**Step 1: Add ARIA live region to toolbar**

Modify BulkActionToolbar:

```typescript
return (
  <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-4">
    <span className="text-sm font-medium text-blue-900 dark:text-blue-100" aria-live="polite">
      {selectedCount} selected
    </span>
    {/* ... rest of component */}
  </div>
);
```

**Step 2: Add keyboard navigation hints**

Ensure checkboxes have proper labels (already implemented with aria-label).

**Step 3: Test accessibility**

```bash
npm run dev:all
```

1. Tab through checkboxes
2. Use Space to toggle
3. Use Enter to trigger actions
4. Use Escape to close dialogs
5. Verify focus returns to table after dialog closes

**Step 4: Run accessibility tests**

```bash
npm test accessibility
```

Expected: All tests pass

**Step 5: Commit**

```bash
git add src/components/admin/TableWithSelection.tsx src/components/admin/BulkActionToolbar.tsx
git commit -m "feat: add accessibility improvements to bulk operations"
```

---

## Task 8: Error Handling and Validation

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

**Step 1: Add validation for empty selection**

Modify the handleAssignOwner function:

```typescript
const handleAssignOwner = async () => {
  if (selectedLotIds.length === 0) {
    toast.error("Please select at least one lot");
    return;
  }

  if (!selectedOwnerId) {
    toast.error("Please select an owner");
    return;
  }

  setIsProcessing(true);
  try {
    await api.admin.batchAssignOwner(selectedLotIds, selectedOwnerId);
    toast.success(`Successfully assigned owner to ${selectedLotIds.length} lots`);
    onRefresh();
    setSelectedLotIds([]);
  } catch (error) {
    logger.error("Error assigning owner", error, { component: "AdminPanelPage" });
    toast.error("Failed to assign owner. Please try again.");
  } finally {
    setIsProcessing(false);
    setIsConfirmDialogOpen(false);
  }
};
```

**Step 2: Test error handling**

```bash
npm run dev:all
```

1. Try to assign without selecting lots (verify error toast)
2. Try to assign without selecting owner (button should be disabled)
3. Simulate API error (use browser DevTools to throttle network)
4. Verify error message shows and selection remains

**Step 3: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "feat: add validation and error handling to bulk operations"
```

---

## Task 9: Responsive Design

**Files:**
- Modify: `src/components/admin/BulkActionToolbar.tsx`

**Step 1: Add mobile-friendly styling**

Modify BulkActionToolbar for mobile:

```typescript
return (
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg mb-4">
    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
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
      <Button variant="ghost" size="sm" onClick={onClear} className="w-full sm:w-auto">
        Clear Selection
      </Button>
    </div>
  </div>
);
```

**Step 2: Test responsive design**

```bash
npm run dev:all
```

1. Test on desktop (> 1024px)
2. Test on tablet (768px - 1024px)
3. Test on mobile (< 768px)
4. Verify toolbar works on all sizes

**Step 3: Commit**

```bash
git add src/components/admin/BulkActionToolbar.tsx
git commit -m "feat: add responsive design to bulk action toolbar"
```

---

## Task 10: Final Testing and Polish

**Files:**
- Test all components
- Verify all functionality
- Check for edge cases

**Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass

**Step 2: Build project**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors

**Step 3: Manual testing checklist**

- [ ] Select single lot
- [ ] Select multiple lots
- [ ] Select all lots (header checkbox)
- [ ] Deselect individual lots
- [ ] Clear selection
- [ ] Assign owner to selected lots
- [ ] Cancel operation at dialog
- [ ] Verify success toast
- [ ] Verify table refreshes
- [ ] Verify selection clears after success
- [ ] Test with 50+ lots
- [ ] Test keyboard navigation
- [ ] Test on mobile
- [ ] Test on tablet
- [ ] Test on desktop
- [ ] Test with slow network (simulate API delay)

**Step 4: Create documentation**

Add to `docs/plans/2026-03-06-bulk-operations-ui-design.md` in "Future Enhancements" section:

```markdown
## Implementation Notes

### Completed Features
- ✅ Checkbox selection in Lots table
- ✅ Bulk action toolbar with "Assign Owner"
- ✅ Owner selection dialog
- ✅ Confirmation dialog
- ✅ Toast notifications
- ✅ Loading states
- ✅ Error handling
- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ Responsive design

### Known Limitations
- Maximum batch size: 100 lots (not enforced in UI)
- No partial failure handling (all-or-nothing)
- No undo functionality
- No export selected feature

### Future Enhancements
- Add bulk delete to Users tab
- Add bulk merge to Households tab
- Add export selected to CSV
- Add progress indicator for large batches
- Implement transaction compensation
- Add audit logging
```

**Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete bulk operations UI for Lots tab

- Add checkbox selection to lots table
- Implement bulk assign owner operation
- Add confirmation dialogs and toast notifications
- Include accessibility support and responsive design
- Add comprehensive error handling

Closes T-012"
```

---

## Summary

This implementation plan creates 4 new reusable components and integrates them into the existing AdminLotsTab, enabling bulk assignment of owners to multiple lots. The approach follows TDD principles, maintains accessibility standards, and provides a solid foundation for extending bulk operations to other admin tables.

**Total Estimated Time:** 3-5 days
**Total Commits:** ~12 commits
**Lines of Code:** ~800 lines (including tests)
