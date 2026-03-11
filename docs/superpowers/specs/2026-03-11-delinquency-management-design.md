# Delinquency Management System Design

**Status:** Draft
**Created:** 2026-03-11
**Author:** Claude Code

## Overview

A comprehensive delinquency management system for the Laguna Hills HOA that enables:
- Admins to manually mark delinquent homeowners (for initial data load)
- Automatic delinquency detection based on payment demands
- 30-day grace period before delinquency takes effect
- 30-day cooldown before voting rights are restored after payment
- Clear visibility for residents of their delinquency status

## Requirements Summary

### Bylaws Compliance
- Dues due: January 7th (1 week from fiscal year start)
- Delinquency effective: 30 days after deadline (February 6th)
- Voting suspended while delinquent
- Voting eligibility restored: 30 days after payment settlement

### User Stories
1. As an admin, I want to manually mark homeowners as delinquent for initial data migration
2. As an admin, I want to view all delinquent members with payment history
3. As an admin, I want to generate annual payment demands
4. As a resident, I want to see if I'm delinquent and what it means
5. As a resident, I want to know when my voting rights will be restored

## Database Schema

### New Table: `manual_delinquencies`

Tracks manual delinquency overrides with full audit trail.

```sql
CREATE TABLE manual_delinquencies (
  id TEXT PRIMARY KEY,
  lot_member_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT 1,
  reason TEXT,
  marked_by TEXT NOT NULL,
  marked_at TEXT NOT NULL,
  waived_by TEXT,
  waived_at TEXT,
  waiver_reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (lot_member_id) REFERENCES lot_members(id),
  FOREIGN KEY (marked_by) REFERENCES users(id),
  FOREIGN KEY (waived_by) REFERENCES users(id)
);

CREATE INDEX idx_manual_delinquencies_lot_member ON manual_delinquencies(lot_member_id);
CREATE INDEX idx_manual_delinquencies_active ON manual_delinquencies(is_active);
```

### No Changes to Existing Tables
- `lot_members` - Uses existing `can_vote` field
- `payment_demands` - Uses existing fields with new logic

## Delinquency Logic

### Delinquency Determination

A member is **delinquent** if ANY of the following:

1. **Automatic**: Has `payment_demand` where `status = 'pending'` AND `due_date < DATE('now')`
2. **Manual**: Exists in `manual_delinquencies` with `is_active = 1`

### Voting Eligibility

A member **can vote** if ALL of the following:

1. **Not delinquent** (see above)
2. **Payment cooldown satisfied**: Last payment was 30+ days ago, OR never paid (first year)
3. `lot_members.verified = 1`
4. `lot_members.can_vote = 1`

### Timeline

| Date | Event |
|------|-------|
| January 1st | Fiscal year starts, demand sent |
| January 7th | Dues deadline (bylaws) |
| February 6th | Delinquency begins (30 days after deadline) |
| Payment made | Dues settled |
| 30 days post-payment | Voting eligibility restored |

## API Endpoints

### Admin Endpoints

| Endpoint | Method | Purpose | Request | Response |
|----------|--------|---------|---------|----------|
| `/api/admin/delinquency/members` | GET | List delinquents | Query params for filters | `{ delinquents: DelinquentMember[] }` |
| `/api/admin/delinquency/mark` | POST | Manually mark delinquent | `{ lot_member_id, reason }` | `{ delinquency: ManualDelinquency }` |
| `/api/admin/delinquency/waive/:id` | POST | Waive manual delinquency | `{ waiver_reason }` | `{ success: boolean }` |
| `/api/admin/delinquency/demands` | POST | Generate payment demands | `{ year, due_date }` | `{ generated: number, skipped: number }` |

### Resident Endpoints

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/my-lots/delinquency-status` | GET | Get user's status | `{ status, voting_restored_at, ... }` |

### Types

```typescript
interface DelinquentMember {
  lot_member_id: string;
  lot: { block, lot, lot_size_sqm };
  member: { user_id, name, email };
  delinquency_type: 'automatic' | 'manual';
  days_overdue: number | null;
  amount_due: number;
  unpaid_periods: string[];
  marked_at?: string;
  reason?: string;
}

interface DelinquencyStatus {
  is_delinquent: boolean;
  delinquency_type: 'automatic' | 'manual' | null;
  voting_eligible: boolean;
  voting_restored_at: string | null;  // ISO date when voting returns
  total_due: number;
  unpaid_periods: string[];
  reason?: string;
}
```

## Admin UI: Delinquency Management

**Route:** `/admin/financials/delinquency`

**Navigation Location:**
```
Admin → Financials → Delinquency Management
```

**Page Components:**

1. **Summary Cards**
   - Total delinquent count
   - Total amount owed
   - Manual vs Automatic breakdown

2. **Filters**
   - Type (All/Automatic/Manual)
   - Year
   - Search by name/lot

3. **Delinquent Table**
   - Columns: Lot, Member, Type, Days Overdue, Amount Due, Actions
   - Actions menu: View details, Send reminder, Waive (manual only), Payment history

4. **Generate Demand Button**
   - Opens modal to generate payment demands for a year

**Modal: Generate Payment Demands**

```
┌────────────────────────────────────┐
│ Generate Payment Demands           │
├────────────────────────────────────┤
│ Fiscal Year: [2025 ▼]             │
│ Due Date:   [2025-01-31]          │
│                                    │
│ This will create demands for all   │
│ residential lots.                  │
│                                    │
│ [Cancel]  [Generate Demands]      │
└────────────────────────────────────┘
```

**Modal: Mark Delinquent**

```
┌────────────────────────────────────┐
│ Mark as Delinquent                 │
├────────────────────────────────────┤
│ Member: Juan Dela Cruz (BLK 5-A)   │
│                                    │
│ Reason: [________________]         │
│         (Required for audit trail) │
│                                    │
│ ⚠️ This will suspend voting       │
│    rights immediately.             │
│                                    │
│ [Cancel]  [Mark Delinquent]       │
└────────────────────────────────────┘
```

**Modal: Waive Delinquency**

```
┌────────────────────────────────────┐
│ Waive Delinquency                  │
├────────────────────────────────────┤
│ Waive reason: [____________]       │
│                                    │
│ This will restore voting rights    │
│ immediately.                       │
│                                    │
│ [Cancel]  [Waive]                 │
└────────────────────────────────────┘
```

## Resident UI: MyLots Page Updates

### A. Warning Banner (Top of Page)

Shown when `is_delinquent = true`.

```
┌────────────────────────────────────────────────────┐
│ ⚠️  DELINQUENCY NOTICE                             │
│                                                    │
│ Your account is currently delinquent. This means:  │
│ • Voting rights are suspended                      │
│ • You may not be eligible for certain services     │
│                                                    │
│ Total owed: ₱5,200                                │
│                                                    │
│ [Pay Now]  [Contact Us]                           │
└────────────────────────────────────────────────────┘
```

### B. Voting Status Badge Enhancement

Existing voting section updated to show:

```
Voting Status: [Delinquent - Suspended]
```

or with countdown:

```
Voting Status: [Suspended - Restores in 12 days]
```

### C. Delinquency Details Card

New section showing:

- Total amount due
- Unpaid periods
- Reason (if manual)
- Expected restoration date

## File Structure

```
src/
├── pages/admin/financials/
│   ├── DelinquencyPage.tsx           # Main page
│   ├── DemandGenerationModal.tsx     # Generate demands
│   ├── DelinquentTable.tsx           # Table component
│   ├── DelinquentActions.tsx         # Actions dropdown
│   └── WaiveDelinquencyDialog.tsx    # Waive confirmation
│
├── components/my-lots/
│   ├── DelinquencyBanner.tsx         # Warning banner
│   └── VotingStatusBadge.tsx         # Updated badge
│
├── components/delinquency/
│   ├── DelinquencyStatusCard.tsx     # Status summary
│   └── RestorationCountdown.tsx      # Countdown timer
│
└── lib/api.ts                        # API client updates

functions/
├── routes/
│   ├── admin.ts                      # Add delinquency endpoints
│   └── delinquency.ts                # New: delinquency routes
│
└── lib/
    └── delinquency.ts                # New: business logic

migrations/
└── 0018_manual_delinquencies.sql     # New table
```

## Implementation Phases

### Phase 1: Database & Backend
1. Create migration for `manual_delinquencies` table
2. Add delinquency checking logic
3. Create API endpoints

### Phase 2: Admin UI
1. Build DelinquencyPage with table
2. Create modals for marking/waiving
3. Add demand generation modal
4. Update Sidebar navigation

### Phase 3: Resident UI
1. Create DelinquencyBanner component
2. Update VotingStatusBadge
3. Add restoration countdown
4. Update MyLotsPage integration

### Phase 4: Testing & Polish
1. End-to-end testing
2. Error handling refinement
3. Notification integration
4. Documentation updates

## Security Considerations

- **Admin-only endpoints**: All `/api/admin/delinquency/*` routes require admin role
- **Audit trail**: All manual changes track `marked_by`/`waived_by` user IDs
- **Input validation**: Reason fields have max length and required validation
- **SQL injection prevention**: Use parameterized queries throughout

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Member pays but manual delinquency exists | Manual override takes precedence; admin must waive |
| Multiple lots owned | Each lot_member evaluated independently |
| Demand already exists for year | Skip during generation, report in summary |
| Payment recorded during demand generation | Use latest data for amount calculation |
| Admin attempts to mark themselves | Allow (for testing), but add warning |

## Future Enhancements

1. **Scheduled demand generation**: Cron job to auto-send January 1st
2. **Bulk operations**: Mark multiple members at once
3. **Delinquency reports**: Export to CSV/PDF
4. **Payment plans**: Track installment agreements
5. **Email notifications**: Automated demand/delinquency notices
6. **Appeals process**: Workflow for members to contest delinquency
