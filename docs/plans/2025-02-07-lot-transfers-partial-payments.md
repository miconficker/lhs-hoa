# Lot Ownership Transfers & Partial Payments Policy

**Document Version:** 1.0
**Date:** 2025-02-07
**Status:** Draft - Pending Board Approval

---

## 1. Lot Ownership Transfers

When a lot is sold or ownership is transferred, the system must handle:

### 1.1. Dues Liability

**Rule:** Outstanding dues remain with the **property, not the owner**.

- At time of transfer, system calculates total unpaid dues + late fees
- Buyer inherits unpaid dues obligation
- Settlement of dues is typically handled at closing (notary/escrow)

**System workflow:**
1. Admin initiates lot transfer in system
2. System shows: "Total outstanding dues on this lot: ₱X"
3. Admin marks: "Dues paid at closing" OR "Dues assumed by buyer"
4. Ownership is transferred
5. New owner receives account setup invitation
6. Seller's access to this lot is revoked

### 1.2. Voting Rights Transfer

**Timeline:**
- Seller loses voting access immediately upon transfer
- Buyer gains voting access **after**:
  - Account is created/activated, AND
  - Any outstanding dues are settled (or formally assumed)

**Transition period (up to 30 days):**
- If a poll is active during transfer:
  - Seller's vote is locked in (already cast)
  - Buyer can vote for their lots if seller hadn't voted
  - If seller voted, that vote remains (buyer inherits it)

### 1.3. Historical Records

**Rule:** All payment and voting history **stays with the lot**.

- New owner can see full payment history for the lot
- "Previous owner: [Name]" shown on historical records
- Cannot edit/delete historical records
- Records are immutable for audit purposes

### 1.4. Transfer Initiation

**Who can initiate:**
- Admin only (owner request via email/in-person)

**Required information:**
- Lot ID(s) being transferred
- Seller user ID
- Buyer email/name
- Transfer date
- Dues settlement method (paid at closing / assumed by buyer)

**System actions:**
```sql
-- Update households table
UPDATE households
SET owner_id = '<new_buyer_id>',
    transferred_at = '<timestamp>',
    previous_owner_id = '<old_seller_id>',
    transfer_notes = 'Dues paid at closing / Assumed by buyer'
WHERE id = '<lot_id>';
```

### 1.5. Bulk Transfers

**Scenario:** Developer sells multiple lots at once

**System supports:**
- Select multiple lots
- One buyer receives all selected lots
- Dues calculated per lot
- Single transfer confirmation

---

## 2. Partial Payments

### 2.1. Partial Lot Payments

**Question:** Can a member pay for only some of their lots?

**Policy Options:**

**Option A: All lots must be paid together**
- Pros: Simpler accounting, cleaner delinquency tracking
- Cons: Less flexible for cash-flow issues

**Option B: Per-lot payments allowed**
- Pros: More flexible, members can prioritize
- Cons: More complex accounting, partial voting restoration possible

**Recommendation: Option B** with voting rules below

**If Option B is adopted:**

**Voting rights restoration:**
- Voting is restored **lot-by-lot** as lots are paid
- Example: Own 5 lots, pay 3 → gets 3 votes, 2 lots still delinquent
- System tracks: "3 of 5 lots eligible to vote"

**UI display:**
```
Your Lots (5)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ B01-L01 | Built  | ₱5,000 | PAID | Can vote
✓ B01-L02 | Built  | ₱5,000 | PAID | Can vote
✓ B01-L03 | Built  | ₱5,000 | PAID | Can vote
✗ B05-L10 | Vacant | ₱7,500 | OVERDUE | Cannot vote
✗ B07-L03 | Built  | ₱6,000 | OVERDUE | Cannot vote

Total Paid: ₱15,000 | Outstanding: ₱13,500
Your votes: 3 of 5 lots
```

### 2.2. Installment Plans

**Question:** Can members pay dues in installments?

**Policy Options:**

**Option A: No installments - full payment required**
- Full amount due by January 31
- Late fees apply February 1
- Strict but simple

**Option B: Board-approved installment plans**
- Member submits request with: reason, proposed schedule, ability to pay
- Board approves/rejects (discretionary)
- If approved:
  - Late fees **suspended** during installment period
  - Voting rights **maintained** if payments are on schedule
  - Missed payment → plan cancelled, late fees backdated, voting suspended

**Option C: Fixed quarterly payments**
- Dues split into 4 equal quarterly payments
- Late fees only apply if quarterly payment is missed
- More predictable for members

**Recommendation: Option B** (Board discretion) - gives flexibility while maintaining control

**System requirements for Option B:**
```sql
-- New table: installment_plans
CREATE TABLE installment_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  schedule TEXT NOT NULL,  -- JSON: [{due_date, amount}, ...]
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  approved_by TEXT NOT NULL,  -- admin user_id
  approved_at DATETIME NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- New table: installment_payments
CREATE TABLE installment_payments (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  due_date DATE NOT NULL,
  amount REAL NOT NULL,
  paid_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'missed')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES installment_plans(id)
);
```

**Admin UI:**
- View all installment plans
- Approve/reject requests
- Monitor payment schedules
- Cancel plan for missed payments

---

## 3. Open Questions for Board Decision

1. **Partial lot payments:** Should we allow Option A (all lots together) or Option B (per-lot)?

2. **Installment plans:** Should we allow them? If yes, which option (A, B, or C)?

3. **Transfer dues assumption:** Should buyers be allowed to assume unpaid dues, or must all dues be settled at closing?

4. **Delinquent new owners:** If a buyer assumes unpaid dues and doesn't pay them within 30 days, do we suspend voting immediately, or give grace period?

5. **Developer-owned lots:** How to handle voting for lots still owned by developer? (Do they vote? Abstain? Held in trust?)

---

## Appendix: Sample Transfer Workflow

```
1. Seller requests transfer:
   "I am selling B01-L01 to Juan Santos. Closing on Feb 15."

2. Admin checks system:
   Lot B01-L01 owned by seller
   Outstanding dues: ₱12,400 (2023: ₱2,400 late + 2024: ₱10,000)

3. Closing arrangement:
   Buyer agrees to pay outstanding dues at closing
   Total adjusted price = lot price + outstanding dues

4. Admin initiates transfer:
   - Select lot: B01-L01
   - Seller: Maria Reyes (seller_id)
   - Buyer: Juan Santos (email: juan@email.com)
   - Dues: "Paid at closing"
   - Transfer date: Feb 15, 2025

5. System actions:
   - Maria loses access to B01-L01
   - Juan gets email invitation
   - Juan creates account → gains access to B01-L01
   - Lot shows "Previous owner: Maria Reyes"
   - Payment history preserved

6. Voting transition:
   - If poll active Feb 10-20:
     * Maria's vote (if cast) counts, locked in
     * Juan can vote if Maria hadn't voted
     * System records transfer in audit log
```
