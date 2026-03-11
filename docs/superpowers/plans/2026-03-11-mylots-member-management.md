# My Lots Household Member Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add household member management to the resident-facing My Lots page and remove the obsolete Households tab from Admin Panel.

**Architecture:**
1. Reuse existing `lotMembers` API endpoints for member CRUD operations
2. Create reusable member management components (extract pattern from admin/lots)
3. Add expandable rows to MyLotsPage lot table for inline member management
4. Remove households tab from AdminPanelPage since address/member management is now in Lots Management

**Tech Stack:** React, TypeScript, Tailwind CSS, shadcn/ui (Dialog, Button, Badge, etc.), existing API layer

---

## File Structure

### New Files
- `src/components/my-lots/HouseholdMembersPanel.tsx` - Reusable panel component for displaying and managing household members
- `src/components/my-lots/AddMemberDialog.tsx` - Dialog for adding household members (adapted from admin AssignMemberDialog)

### Modified Files
- `src/pages/MyLotsPage.tsx` - Add expandable rows with member management
- `src/pages/AdminPanelPage.tsx` - Remove households tab and related state/handlers

---

## Chunk 1: Create Reusable Member Management Components

### Task 1: Create HouseholdMembersPanel Component

**Files:**
- Create: `src/components/my-lots/HouseholdMembersPanel.tsx`

**Description:** A reusable panel component that displays household members with add/remove functionality. This will be used by both MyLotsPage (resident-facing) and can be reused by admin LotsManagementPage.

- [ ] **Step 1: Create the component file structure**

```typescript
// src/components/my-lots/HouseholdMembersPanel.tsx
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, X, Loader2 } from "lucide-react";

export interface HouseholdMember {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_type: "primary_owner" | "secondary";
  can_vote: boolean;
  verified: boolean;
  verified_at?: string;
  notes?: string;
}

interface HouseholdMembersPanelProps {
  householdId: string;
  lotAddress: string;
  isPrimaryOwner: boolean; // Whether current user is primary owner (can manage)
  onMemberChange?: () => void; // Callback after add/remove
}

export function HouseholdMembersPanel({
  householdId,
  lotAddress,
  isPrimaryOwner,
  onMemberChange,
}: HouseholdMembersPanelProps) {
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load members on mount and householdId change
  useEffect(() => {
    loadMembers();
  }, [householdId]);

  const loadMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.lotMembers.getHouseholdMembers(householdId);
      if (resp.data?.members) {
        setMembers(resp.data.members);
      }
    } catch (err: any) {
      setError(err.error || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from this household?`)) {
      return;
    }

    try {
      await api.lotMembers.removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      onMemberChange?.();
    } catch (err: any) {
      alert(err.error || "Failed to remove member");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-destructive">
        <p>{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={loadMembers}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-card-foreground">
            Household Members
          </h3>
          <p className="text-xs text-muted-foreground">{lotAddress}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {members.length} {members.length === 1 ? "member" : "members"}
        </Badge>
      </div>

      {/* Members List */}
      {members.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No members assigned</p>
          {isPrimaryOwner && (
            <p className="text-xs text-muted-foreground mt-1">
              Add household members using the button below
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-card"
            >
              <div className="flex items-center gap-3">
                {member.verified ? (
                  <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 text-xs">✓</span>
                  </div>
                ) : (
                  <div className="h-5 w-5 rounded-full bg-yellow-100 flex items-center justify-center">
                    <span className="text-yellow-600 text-xs">!</span>
                  </div>
                )}
                <div>
                  <p className="font-medium text-sm">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={member.member_type === "primary_owner" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {member.member_type === "primary_owner" ? "Primary" : "Secondary"}
                </Badge>
                {isPrimaryOwner && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={() =>
                      handleRemoveMember(
                        member.id,
                        `${member.first_name} ${member.last_name}`,
                      )
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: No tests for UI component - manual verification required**

- [ ] **Step 3: Commit**

```bash
git add src/components/my-lots/HouseholdMembersPanel.tsx
git commit -m "feat: add HouseholdMembersPanel component for member management"
```

---

### Task 2: Create AddMemberDialog Component

**Files:**
- Create: `src/components/my-lots/AddMemberDialog.tsx`

**Description:** Dialog component for adding household members. Adapted from admin/lots/AssignMemberDialog but simplified for resident use (no admin verification features).

- [ ] **Step 1: Create the dialog component**

```typescript
// src/components/my-lots/AddMemberDialog.tsx
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
  onSuccess: () => void;
}

interface SuggestedUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

export function AddMemberDialog({
  open,
  onOpenChange,
  householdId,
  onSuccess,
}: AddMemberDialogProps) {
  const [userEmail, setUserEmail] = useState("");
  const [memberType, setMemberType] = useState<"primary_owner" | "secondary">(
    "secondary",
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch user suggestions when email changes
  useEffect(() => {
    if (userEmail.length >= 2) {
      const fetchSuggestions = async () => {
        try {
          const resp = await api.admin.searchUsers(userEmail);
          if (resp.data?.users) {
            setSuggestions(resp.data.users);
            setShowSuggestions(true);
          }
        } catch {
          setSuggestions([]);
        }
      };
      fetchSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [userEmail]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setUserEmail("");
      setMemberType("secondary");
      setNotes("");
      setError(null);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await api.lotMembers.assignMember({
        household_id: householdId,
        email: userEmail,
        member_type: memberType,
        notes: notes || undefined,
      });
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.error || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Household Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2 relative">
              <Label htmlFor="user_email">User Email</Label>
              <Input
                id="user_email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                onFocus={() => setShowSuggestions(suggestions.length > 0)}
                onBlur={() => {
                  setTimeout(() => setShowSuggestions(false), 200);
                }}
                placeholder="user@example.com"
                required
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-[100] w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {suggestions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setUserEmail(user.email);
                        setShowSuggestions(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {user.email}
                        </div>
                        {(user.first_name || user.last_name) && (
                          <div className="text-xs text-muted-foreground">
                            {user.first_name} {user.last_name}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {user.role}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Member Type</Label>
              <RadioGroup
                value={memberType}
                onValueChange={(value: "primary_owner" | "secondary") =>
                  setMemberType(value)
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="primary_owner" id="primary_owner" />
                  <Label htmlFor="primary_owner">
                    Primary Owner (can vote)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="secondary" id="secondary" />
                  <Label htmlFor="secondary">Secondary Member (no vote)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Family member, Spouse, etc."
              />
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: No tests for UI component - manual verification required**

- [ ] **Step 3: Commit**

```bash
git add src/components/my-lots/AddMemberDialog.tsx
git commit -m "feat: add AddMemberDialog for household member management"
```

---

## Chunk 2: Update MyLotsPage with Member Management

### Task 3: Add Expandable Rows and Member Panel to MyLotsPage

**Files:**
- Modify: `src/pages/MyLotsPage.tsx`

**Description:** Integrate the HouseholdMembersPanel and AddMemberDialog into MyLotsPage with expandable row functionality.

- [ ] **Step 1: Update imports and add state for expandable rows**

```typescript
// Add to existing imports in src/pages/MyLotsPage.tsx
import { HouseholdMembersPanel } from "@/components/my-lots/HouseholdMembersPanel";
import { AddMemberDialog } from "@/components/my-lots/AddMemberDialog";
import { ChevronDown, ChevronRight, Users, Plus } from "lucide-react";

// Add new state after existing state declarations
const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
const [selectedLotForMember, setSelectedLotForMember] = useState<MyLot | null>(null);
```

- [ ] **Step 2: Add toggle function for expandable rows**

```typescript
// Add after existing handler functions
function toggleLotExpanded(lotId: string) {
  setExpandedLots((prev) => {
    const newSet = new Set(prev);
    if (newSet.has(lotId)) {
      newSet.delete(lotId);
    } else {
      newSet.add(lotId);
    }
    return newSet;
  });
}

function openAddMemberDialog(lot: MyLot) {
  setSelectedLotForMember(lot);
  setShowAddMemberDialog(true);
}

function handleMemberAdded() {
  // Reload lots data to refresh member counts
  loadMyLots();
}
```

- [ ] **Step 3: Update the lots table to include expandable member rows**

Find the table body section (`<tbody className="bg-card divide-y divide-border">`) and replace each row with:

```typescript
{lots.map((lot) => {
  const isExpanded = expandedLots.has(lot.lot_id);
  const memberCount = lot.merged_lots?.length || 0; // This will be updated by API

  return (
    <React.Fragment key={lot.lot_id}>
      {/* Main Lot Row */}
      <tr className={isExpanded ? "bg-muted/30" : ""}>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
          {lot.street || "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
          {lot.block || "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-card-foreground">
          {lot.lot || "—"}
        </td>
        <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
          {lot.address}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              lot.lot_type === "resort"
                ? "bg-purple-100 text-purple-700"
                : lot.lot_type === "commercial"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-green-100 text-green-700"
            }`}
          >
            {lot.lot_type === "residential"
              ? "Residential"
              : lot.lot_type === "resort"
                ? "Resort"
                : lot.lot_type === "commercial"
                  ? "Commercial"
                  : "Unknown"}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              lot.lot_status === "built"
                ? "bg-green-100 text-green-700"
                : lot.lot_status === "under_construction"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-card-foreground"
            }`}
          >
            {lot.lot_status === "built"
              ? "Built"
              : lot.lot_status === "under_construction"
                ? "Under Construction"
                : "Vacant Lot"}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          {lot.lot_size_sqm?.toLocaleString() || "—"}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-card-foreground">
          ₱{lot.annual_dues.toLocaleString()}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEditDialog(lot)}
              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <Edit2 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => toggleLotExpanded(lot.lot_id)}
              className="text-gray-600 hover:text-gray-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-muted"
              title={isExpanded ? "Hide members" : "View members"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <Users className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expandable Members Row */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="px-6 py-4 bg-muted/20">
            <div className="max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-card-foreground">
                  Household Members
                </h4>
                <Button
                  size="sm"
                  onClick={() => openAddMemberDialog(lot)}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Member
                </Button>
              </div>
              <HouseholdMembersPanel
                householdId={lot.lot_id}
                lotAddress={lot.address}
                isPrimaryOwner={true} // TODO: Check if current user is primary owner
                onMemberChange={handleMemberAdded}
              />
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
})}
```

- [ ] **Step 4: Add AddMemberDialog component before the closing div**

```typescript
{/* Add before the closing </div> of the main return */}
{selectedLotForMember && (
  <AddMemberDialog
    open={showAddMemberDialog}
    onOpenChange={setShowAddMemberDialog}
    householdId={selectedLotForMember.lot_id}
    onSuccess={handleMemberAdded}
  />
)}
```

- [ ] **Step 5: Verify build**

Run: `rtk tsc`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/pages/MyLotsPage.tsx
git commit -m "feat: add expandable rows with household member management to My Lots page"
```

---

## Chunk 3: Remove Obsolete Households Tab

### Task 4: Remove Households Tab from AdminPanelPage

**Files:**
- Modify: `src/pages/AdminPanelPage.tsx`

**Description:** Remove the obsolete households tab and related state/handlers since address management is now in AdminLotsPage and member management is in LotsManagementPage.

- [ ] **Step 1: Remove households from tabs array**

Find the `tabs` array definition and remove the households entry:

```typescript
// Remove this line from tabs array:
{ id: "households" as Tab, label: "Households", icon: "🏠" },
```

- [ ] **Step 2: Remove households-related state**

Find and remove these state declarations:

```typescript
// Remove these state declarations:
const [households, setHouseholds] = useState<AdminHousehold[]>([]);
const [showHouseholdModal, setShowHouseholdModal] = useState(false);
const [editingHousehold, setEditingHousehold] = useState<AdminHousehold | null>(null);
```

- [ ] **Step 3: Remove households-related functions**

Find and remove these functions:

```typescript
// Remove these functions:
const loadHouseholds = async () => { ... };
const handleCreateHousehold = async (data: any) => { ... };
const handleUpdateHousehold = async (id: string, data: any) => { ... };
const handleDeleteHousehold = async (id: string) => { ... };
```

- [ ] **Step 4: Remove households tab content**

Find and remove the entire `activeTab === "households"` section in the JSX:

```typescript
// Remove this entire block:
{activeTab === "households" && (
  <div>
    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg mb-6">
      ...
    </div>
    ...
  </div>
)}
```

- [ ] **Step 5: Remove HouseholdModal component**

Find and remove the entire `HouseholdModal` function component at the bottom of the file.

- [ ] **Step 6: Remove households modal from JSX**

Find and remove the HouseholdModal usage:

```typescript
// Remove this entire block:
{showHouseholdModal && (
  <HouseholdModal
    household={editingHousehold}
    onSave={
      editingHousehold
        ? (data) => handleUpdateHousehold(editingHousehold.id, data)
        : handleCreateHousehold
    }
    onClose={() => {
      setShowHouseholdModal(false);
      setEditingHousehold(null);
    }}
  />
)}
```

- [ ] **Step 7: Remove import-related type**

Check if `AdminHousehold` is still needed after removing households tab. If not used elsewhere, you can optionally remove it from the api import.

- [ ] **Step 8: Verify build**

Run: `rtk tsc`
Expected: No TypeScript errors

- [ ] **Step 9: Commit**

```bash
git add src/pages/AdminPanelPage.tsx
git commit -m "refactor: remove obsolete households tab from Admin Panel"
```

---

## Chunk 4: Verification and Testing

### Task 5: Manual Testing and Verification

**Files:**
- Manual testing in browser

- [ ] **Step 1: Start dev server**

Run: `npm run dev:all`
Expected: Server starts without errors

- [ ] **Step 2: Test My Lots page as resident**

1. Login as a resident with lots
2. Navigate to My Lots page
3. Verify summary section displays correctly
4. Click the "Members" button on a lot row
5. Verify the household members panel expands
6. Verify existing members are displayed correctly
7. Click "Add Member" button
8. Enter email and select member type
9. Submit and verify member is added
10. Click remove button on a member
11. Confirm removal and verify member is removed
12. Collapse and re-expand to verify changes persist

- [ ] **Step 3: Test Admin Panel (verify households tab is removed)**

1. Login as admin
2. Navigate to Admin Panel
3. Verify "Households" tab is NOT in the tab list
4. Verify existing tabs (Users, Lots, Import, Payments, Stats) work correctly

- [ ] **Step 4: Test Admin Lots Management page (regression test)**

1. Navigate to Admin → Lots Management
2. Verify lot cards display
3. Click "View Members" on a lot
4. Verify sliding drawer with member management works
5. Verify this page still has full admin functionality

- [ ] **Step 5: Final build verification**

Run: `rtk tsc && npm run build`
Expected: No TypeScript errors, successful build

- [ ] **Step 6: Create summary commit (if any fixes needed)**

If issues were found and fixed during testing:

```bash
git add -A
git commit -m "fix: address issues found during testing of My Lots member management"
```

---

## Summary

This implementation:

1. ✅ Creates reusable member management components (`HouseholdMembersPanel`, `AddMemberDialog`)
2. ✅ Adds expandable rows to MyLotsPage with inline member management
3. ✅ Removes the obsolete households tab from AdminPanelPage
4. ✅ Uses existing API endpoints (no backend changes needed)
5. ✅ Follows existing UI patterns from the admin Lots Management page
6. ✅ Maintains separation of concerns (residents manage their own, admins manage all)

**API Endpoints Used:**
- `api.lotMembers.getHouseholdMembers(id)` - GET household members
- `api.lotMembers.assignMember(...)` - POST new member
- `api.lotMembers.removeMember(id)` - DELETE member
- `api.admin.searchUsers(query)` - GET user suggestions

**Components Created:**
- `src/components/my-lots/HouseholdMembersPanel.tsx`
- `src/components/my-lots/AddMemberDialog.tsx`

**Components Modified:**
- `src/pages/MyLotsPage.tsx` - Added expandable rows with member management
- `src/pages/AdminPanelPage.tsx` - Removed households tab
