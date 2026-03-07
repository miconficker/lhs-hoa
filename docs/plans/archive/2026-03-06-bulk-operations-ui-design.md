# Bulk Operations UI - Design Document
**Date:** 2026-03-06
**Author:** developer-2
**Task:** T-012 - Bulk Operations for Admin Panel
**Status:** Design Approved

---

## Executive Summary

This design adds bulk selection and operations capabilities to the admin panel's Lots tab, enabling administrators to efficiently assign owners to multiple lots in a single operation. This minimum viable implementation focuses on the most critical bulk operation while establishing patterns that can be extended to other admin tables.

**Scope:** Lots tab only (Approach A)
**Timeline:** 3-5 days
**Backend API:** Ready (batchAssignOwner exists)

---

## Problem Statement

### Current State
- Admins can only perform operations on one lot at a time
- Batch assign owner API exists but has no UI
- Inefficient workflow for common tasks (e.g., reassigning 10 lots)

### Goals
- Enable selection of multiple lots via checkboxes
- Provide bulk action toolbar with "Assign Owner" operation
- Show confirmation dialogs before destructive operations
- Display progress feedback via toast notifications

---

## Component Architecture

### New Components

**1. TableWithSelection (Reusable Wrapper)**
- **Purpose:** Adds checkbox selection capability to any table
- **Props:**
  - `data`: Array of items to display
  - `idField`: Field name for unique ID (default: "id")
  - `children`: Existing table component
  - `onSelectionChange`: Callback when selection changes
- **Features:**
  - Checkbox column (first column)
  - Header checkbox for "select all visible"
  - Individual row checkboxes
  - Maintains selection state internally

**2. BulkActionToolbar**
- **Purpose:** Displays selected count and action buttons
- **Props:**
  - `selectedCount`: Number of items selected
  - `onClear`: Callback to clear selection
  - `actions`: Array of action buttons
- **Features:**
  - Shows "X selected" text
  - "Assign Owner" button (primary action)
  - "Clear Selection" button
  - Sticky positioning or fixed at bottom on mobile

**3. AssignOwnerDialog**
- **Purpose:** Dialog for selecting owner to assign
- **Props:**
  - `homeowners`: Array of available owners
  - `onConfirm`: Callback with selected owner ID
  - `onCancel`: Callback to close dialog
- **Features:**
  - Searchable dropdown for owner selection
  - Shows current lot count
  - "Next" button disabled until owner selected
  - Validation for owner selection

**4. BulkConfirmationDialog**
- **Purpose:** Reusable confirmation dialog for bulk operations
- **Props:**
  - `operationType`: Type of operation (e.g., "Assign Owner")
  - `itemCount`: Number of items affected
  - `details`: Additional details (e.g., owner name)
  - `onConfirm`: Callback to proceed
  - `onCancel`: Callback to cancel
- **Features:**
  - Clear messaging: "Assign [Owner] to X lots?"
  - Warning for destructive operations
  - Confirm/Cancel buttons
  - Accessible (role="dialog", focus trap)

### Modified Components

**AdminLotsTab (Enhanced)**
- Add state for selection and dialogs
- Wrap existing table with TableWithSelection
- Add bulk action handlers
- Wire up API calls

### Component Structure

```
AdminPanelPage
└── AdminLotsTab (enhanced)
    ├── TableWithSelection (new wrapper)
    │   ├── Checkbox column (new)
    │   └── Existing lots table (unchanged)
    ├── BulkActionToolbar (new)
    ├── AssignOwnerDialog (new)
    └── BulkConfirmationDialog (new)
```

---

## User Interface Flow

### Selection Flow

1. **Initial State:** User sees lots table with new checkbox column (first column)
2. **Selection:** User clicks checkboxes to select lots
3. **Select All:** User clicks header checkbox to select all visible lots
4. **Toolbar Appears:** When 1+ lots selected, toolbar shows above table with "X selected"
5. **Actions:** Toolbar shows "Assign Owner" button and "Clear Selection" button

### Action Flow (Assign Owner)

1. **User clicks "Assign Owner"** button
2. **Owner Dialog Opens:** Dropdown shows available homeowners
3. **User searches/selects owner** from list
4. **User clicks "Next"** button
5. **Confirmation Dialog Shows:** "Assign [Owner Name] to X lots? This cannot be undone."
6. **User confirms** operation
7. **Loading Toast:** "Assigning owner to X lots..."
8. **Success:**
   - Success toast: "Successfully assigned owner to X lots"
   - Table refreshes with new data
   - Selection clears
   - Toolbar hides
9. **Error:**
   - Error toast: "Failed to assign owner to X lots: [error details]"
   - Selection remains (for retry)

---

## State Management

### Local State (AdminLotsTab)

```typescript
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
const [selectedOwner, setSelectedOwner] = useState<string>("");
const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
const [isOperationInProgress, setIsOperationInProgress] = useState(false);
```

**Design Decision:** Use local state instead of global state (Zustand) because:
- Selection is specific to this component
- No other components need access to selection state
- Simpler and more focused
- Can be elevated to global state later if needed

---

## Data Flow

```
User Action → Update State → Show UI
├─ Click checkbox → setSelectedIds → Show toolbar
├─ Click "Assign Owner" → setIsAssignDialogOpen → Show dialog
├─ Select owner → setSelectedOwner → Enable "Next" button
├─ Confirm → setIsConfirmDialogOpen → Show confirmation
└─ Final confirm → Call API → Show toast → Refresh → Clear selection
```

### API Integration

**Endpoint:** `PUT /api/admin/lots/batch/owner`

**Request:**
```typescript
{
  lot_ids: string[],  // Selected lot IDs
  owner_user_id: string  // Selected owner ID
}
```

**Response:**
```typescript
{
  success: boolean,
  count: number  // Number of lots updated
}
```

**Error Handling:**
- Network errors: Show error toast
- Validation errors: Show error message
- Partial failures: Report success count

---

## Error Handling

### Validation Errors

1. **No lots selected:**
   - "Assign Owner" button disabled
   - OR show toast: "Please select at least one lot"

2. **No owner selected:**
   - "Next" button disabled in dialog
   - Validation before allowing confirmation

### API Errors

1. **Network error:**
   - Toast: "Network error: Could not connect to server"
   - Selection remains for retry

2. **Server error:**
   - Toast: "Server error: [error message from backend]"
   - Selection remains for retry

3. **Validation error (backend):**
   - Toast: "Validation failed: [details]"
   - Selection remains for retry

4. **Partial success:**
   - Toast: "Assigned owner to X of Y lots. Failed lots: [list of IDs]"
   - Table refreshes
   - Selection clears

---

## Accessibility Considerations

### Keyboard Navigation

- **Tab order:** Checkboxes → Toolbar → Dialogs → Actions
- **Space:** Toggle checkbox
- **Enter:** Trigger focused action
- **Escape:** Close dialogs

### Screen Reader Support

- **Checkbox labels:** "Select [Block] [Lot]" or "Select all visible lots"
- **Toolbar:** ARIA live region announces "X lots selected"
- **Dialogs:** `role="dialog"` with `aria-labelledby`
- **Focus management:** Returns to triggering element after dialog closes

### Visual Accessibility

- **Focus indicators:** Visible outline on checkboxes and buttons
- **High contrast:** Use existing color system
- **Text sizing:** Follow existing patterns

### ARIA Attributes

```html
<!-- Checkbox column -->
<input type="checkbox" aria-label="Select Block 5 Lot 12" />

<!-- Toolbar -->
<div aria-live="polite">5 lots selected</div>

<!-- Dialog -->
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Assign Owner to 5 lots</h2>
</div>
```

---

## Responsive Design

### Desktop (> 1024px)
- Toolbar above table
- Inline action buttons
- Full-width table

### Tablet (768px - 1024px)
- Toolbar above table
- Stacked action buttons
- Horizontal scroll on table

### Mobile (< 768px)
- Fixed toolbar at bottom
- Full-width action buttons
- Horizontal scroll on table
- Touch-friendly checkbox size (44px min)

---

## Testing Strategy

### Unit Tests

**TableWithSelection:**
- Renders checkboxes correctly
- Updates selection on checkbox click
- "Select all" checkbox works
- Calls onSelectionChange callback

**BulkActionToolbar:**
- Shows correct count
- Calls onClear callback
- Renders action buttons

**AssignOwnerDialog:**
- Shows owner list
- Filters owners on search
- Disables "Next" until owner selected
- Calls onConfirm with selected owner

**BulkConfirmationDialog:**
- Shows correct message
- Calls onConfirm on confirm
- Calls onCancel on cancel

### Integration Tests

**AdminLotsTab:**
- Selecting lots shows toolbar
- Clicking "Assign Owner" opens dialog
- Selecting owner enables confirmation
- Confirming calls API
- Success refreshes table and clears selection
- Error shows toast and keeps selection

### Manual Testing

**Happy Path:**
1. Select 5 lots
2. Click "Assign Owner"
3. Select owner
4. Confirm
5. Verify success toast
6. Verify table updated
7. Verify selection cleared

**Error Scenarios:**
1. Try to assign with no lots selected (button disabled)
2. Try to confirm with no owner selected (button disabled)
3. Simulate API error (verify error toast, selection kept)
4. Test keyboard navigation
5. Test screen reader (NVDA/VoiceOver)

---

## Implementation Phases

### Phase 1: Core Components (Days 1-2)
1. Create TableWithSelection component
2. Create BulkActionToolbar component
3. Create AssignOwnerDialog component
4. Create BulkConfirmationDialog component
5. Write unit tests for all components

### Phase 2: Integration (Days 2-3)
1. Modify AdminLotsTab to use new components
2. Add state management
3. Wire up API calls
4. Add toast notifications
5. Test integration

### Phase 3: Polish (Days 3-4)
1. Add loading states
2. Improve error messages
3. Add keyboard navigation
4. Add ARIA attributes
5. Test accessibility

### Phase 4: Testing (Days 4-5)
1. Manual testing in browser
2. Test with real data
3. Test error scenarios
4. Accessibility testing
5. Bug fixes and refinement

---

## Future Enhancements

### Extend to Other Tabs

**Users Tab:**
- Add bulk delete operation
- Reuse TableWithSelection, BulkActionToolbar, BulkConfirmationDialog
- Create DeleteConfirmationDialog

**Households Tab:**
- Add bulk merge/unmerge operations
- Reuse existing components
- Create MergeConfirmationDialog

### Additional Features

- **Export selected:** Export selected lots to CSV
- **Bulk status update:** Update status for multiple lots
- **Undo operation:** Rollback last bulk operation
- **Progress indicator:** Show progress for large batches
- **Select all (filtered):** Select all lots matching current filters

---

## Success Criteria

✅ Admin can select 1+ lots via checkboxes
✅ "Assign Owner" button appears when lots selected
✅ Admin can select owner from dropdown
✅ Confirmation dialog shows before operation
✅ Progress feedback via toast notifications
✅ Table refreshes after successful operation
✅ Selection clears after operation
✅ Works on mobile (responsive toolbar)
✅ Keyboard navigation works
✅ Screen reader announcements work
✅ All unit tests pass
✅ All integration tests pass

---

## Risks and Mitigations

### Risk 1: Backend API Issues
**Mitigation:** API exists and was tested by QA. Verify with quick smoke test.

### Risk 2: Performance with Large Selections
**Mitigation:** Limit batch size to 100 lots. Show warning for larger selections.

### Risk 3: Partial Updates
**Mitigation:** Clear error messaging. Keep selection for retry. Consider transaction compensation.

### Risk 4: Accessibility Gaps
**Mitigation:** Follow T-042 accessibility improvements. Test with screen reader.

---

## Dependencies

### Existing Components
- shadcn/ui Button, Dialog, Select
- Sonner (toast notifications)
- Existing lots table structure

### Backend APIs
- `api.admin.batchAssignOwner()` - Exists and tested

### Files to Modify
- `src/pages/AdminPanelPage.tsx` - Add bulk operations to Lots tab

### Files to Create
- `src/components/admin/TableWithSelection.tsx`
- `src/components/admin/BulkActionToolbar.tsx`
- `src/components/admin/AssignOwnerDialog.tsx`
- `src/components/admin/BulkConfirmationDialog.tsx`

---

## Conclusion

This design provides a focused, minimum viable implementation of bulk operations for the Lots tab, prioritizing the most critical operation (batch assign owner) while establishing reusable patterns that can be extended to other admin tables. The approach balances scope, timeline, and quality while setting up the foundation for comprehensive bulk operations in future iterations.

**Next Steps:**
1. Review and approve design document
2. Create detailed implementation plan using writing-plans skill
3. Begin implementation following phases outlined above
4. Test thoroughly with QA
5. Gather user feedback for future enhancements
