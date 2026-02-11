# Co-Ownership Design Discussion

**Date:** 2025-02-12
**Status:** Draft - For Discussion
**Related:** Household & Ownership Management

---

## Question

Should the Laguna Hills HOA system support **multiple co-owners per household** (e.g., husband and wife as joint owners), or **maintain a single owner per household**?

---

## Current Design Analysis

### Existing Data Model

```sql
-- households table
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  address TEXT,
  block TEXT,
  lot TEXT,
  owner_id TEXT REFERENCES users(id),  -- SINGLE owner
  lot_status TEXT,
  lot_type TEXT,
  ...
);

-- residents table
CREATE TABLE residents (
  id TEXT PRIMARY KEY,
  household_id TEXT REFERENCES households(id),
  user_id TEXT REFERENCES users(id),
  first_name TEXT,
  last_name TEXT,
  is_primary BOOLEAN,  -- One primary resident per household
  ...
);
```

### Current Behavior

- **One owner per household** (`owner_id` points to a single user)
- **Multiple residents** can be linked to a household
- Residents can have `user_id` (login access) but are not owners
- Only the owner has voting rights and full control

---

## Design Options

### Option A: Single Owner (Current Design) ✅ *Recommended*

**Structure:**
```
Household: Block 1, Lot 1
├── owner_id: juan@email.com (Juan Santos)
└── residents:
    ├── juan@email.com (is_primary: true)
    └── maria@email.com (is_primary: false)
```

**Access Model:**
- Both Juan and Maria can have user accounts
- Both can login and access household information
- Both can view payments, submit requests, manage passes
- Only Juan (as owner) can vote and make property decisions

**Pros:**
| Benefit | Description |
|---------|-------------|
| **Simpler data model** | One owner per lot, no join tables needed |
| **Clear voting rights** | One vote per lot, no ambiguity in meetings |
| **Easier payment tracking** | One person primarily responsible for dues |
| **Simpler legal** | Property deeds typically list one primary owner |
| **No disputes** | No conflicts about who pays or decides |
| **Easier transfers** | When selling property, transfer is straightforward |
| **Clear contact point** | HOA knows who to contact for each property |

**Cons:**
| Drawback | Mitigation |
|----------|------------|
| Spouse can't vote | Both can discuss, but one casts the vote |
| Shared credentials or separate accounts | Residents table allows separate accounts |
| Owner becomes unavailable | Can designate alternate contact |

---

### Option B: Multiple Co-Owners (Joint Tenancy)

**Structure:**
```sql
CREATE TABLE household_owners (
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  is_primary BOOLEAN DEFAULT 0,
  ownership_percentage REAL DEFAULT 50.0,  -- For voting/financial split
  PRIMARY KEY (household_id, user_id)
);

-- households.owner_id becomes deprecated
-- or points to the primary owner
```

**Access Model:**
```
Household: Block 1, Lot 1
├── owners: [juan@email.com, maria@email.com]
├── primary_owner: juan@email.com (for billing/contacts)
└── residents:
    ├── juan@email.com
    └── maria@email.com
```

**Pros:**
| Benefit | Description |
|---------|-------------|
| **Independent access** | Each spouse has their own login |
| **Shared responsibility** | Both can manage household tasks |
| **Modern family structure** | Reflects joint ownership reality |
| **No credential sharing** | Each spouse maintains privacy |

**Cons:**
| Drawback | Challenge |
|----------|-----------|
| **Voting complexity** | Does each owner get a vote? Or split the vote? |
| **Payment disputes** | Who pays when spouses disagree? |
| **Divorce complications** | How to split ownership during separation? |
| **Ambiguous responsibility** | Who gets notified for overdue dues? |
| **More complex UI** | Need to manage co-owner relationships |
| **Transfer complexity** | Both owners must agree to sell? |
| **Meeting quorum issues** | Do both need to attend to count toward quorum? |

---

### Option C: Household Member Access (Enhanced Current Design)

**Structure:** Same as current, but with better access control:

```typescript
// Enhanced access control
function canAccessHousehold(user: User, household: Household): boolean {
  // 1. Direct owner
  if (household.owner_id === user.id) return true;

  // 2. Household member (via residents table)
  const resident = await db.query(`
    SELECT * FROM residents
    WHERE user_id = ? AND household_id = ?
  `, user.id, household.id);

  if (resident.exists) return true;

  // 3. Admin override
  if (user.role === 'admin') return true;

  return false;
}
```

**Permission Matrix:**

| Action | Owner | Household Member | Admin |
|--------|-------|-----------------|-------|
| View household info | ✅ | ✅ | ✅ |
| Submit service requests | ✅ | ✅ | ✅ |
| Make payments | ✅ | ✅ | ✅ |
| View payment history | ✅ | ✅ | ✅ |
| Manage passes (vehicle/employee) | ✅ | ✅ | ✅ |
| Vote in polls | ✅ | ❌ | ✅ |
| Transfer/sell property | ✅ | ❌ | ✅ |
| Change household settings | ✅ | ❌ | ✅ |
| Receive dues notifications | ✅ | ❌ (optional) | ✅ |
| Receive general notifications | ✅ | ✅ | ✅ |

---

## Recommendation

### **Go with Option A (Single Owner) + Enhanced Member Access** ✅

**Rationale:**

1. **KISS Principle** - Keep It Simple, Stupid
   - One owner = one vote = clear accountability
   - HOA meetings are chaotic enough without splitting votes

2. **Real-World Alignment**
   - Property deeds typically list one primary owner
   - HOA voting is per lot, not per person
   - Billing and legal notices go to one person

3. **Flexibility Through Residents Table**
   - Both spouses can have accounts and access
   - Both can manage day-to-day household tasks
   - Only owner makes binding decisions

4. **Avoid Edge Cases**
   - No need to handle voting splits (e.g., 60/40, 50/50)
   - No divorce ownership disputes in the system
   - No "both owners must agree" transfer logic

---

## Implementation: Enhanced Member Access

If proceeding with Option A, ensure these features are implemented:

### 1. Resident Login Access

Residents with `user_id` can login and:
- View their household's information
- See payment history
- Submit service requests
- Register vehicles and employees
- Make payments

### 2. Notification Preferences

Allow household members to opt into notifications:
```sql
CREATE TABLE resident_notification_settings (
  resident_id TEXT PRIMARY KEY REFERENCES residents(id),
  receive_payment_reminders BOOLEAN DEFAULT 1,
  receive_announcements BOOLEAN DEFAULT 1,
  receive_service_request_updates BOOLEAN DEFAULT 1,
  ...
);
```

### 3. Designated Contact

Allow owner to designate alternate contact:
```sql
ALTER TABLE households ADD COLUMN billing_contact_id TEXT;
ALTER TABLE households ADD COLUMN emergency_contact_id TEXT;

-- Both reference users table, can be different from owner
```

### 4. "Can View" vs "Can Control"

UI distinction:
- **View access** - Residents can see household data
- **Control access** - Only owner can change ownership, vote, etc.

---

## If Co-Ownership Is Required

If the HOA board decides multiple co-owners are necessary, here's a minimal approach:

### Joint Owner Table (Simplified)

```sql
CREATE TABLE household_co_owners (
  household_id TEXT NOT NULL REFERENCES households(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (household_id, user_id)
);

-- Only for lots with true joint ownership
-- Most households remain single-owner
```

**Rules:**
- **Voting:** All co-owners get one vote total (not per person)
- **Payments:** All co-owners are jointly liable
- **Notifications:** All co-owners receive payment notices
- **Transfers:** All co-owners must approve sale

---

## Open Questions for Board Discussion

1. **Voting:** If a lot has 2 co-owners, do they each get 1 vote, or do they split the 1 lot vote?

2. **Payments:** If there's a payment dispute, who is legally responsible?

3. **Transfers:** What happens if one co-owner wants to sell but the other doesn't?

4. **Divorce:** How does the system handle ownership separation during divorce?

5. **Notifications:** Do all co-owners receive payment reminders, or just the primary?

6. **Practical Usage:** How many households in Laguna Hills actually need co-ownership vs. single owner with household member access?

---

## Migration Path (If Switching to Co-Ownership)

If the board decides to implement co-ownership:

### Phase 1: Add Co-Owner Table
- Create `household_co_owners` table
- Keep `owner_id` for backward compatibility
- Add UI for managing co-owners

### Phase 2: Update Access Control
- Modify `canAccessHousehold()` to check co-owners
- Update voting logic to handle joint lots

### Phase 3: Update UI
- Admin panel: Add co-owner management
- Polls: Show co-owned lots as single votes
- Payments: Show all co-owners as liable

### Phase 4: Data Migration
- Manual process to identify joint ownership lots
- Add co-owners to system
- Update ownership records

---

## Decision Matrix

| Factor | Single Owner | Co-Owners |
|--------|--------------|-----------|
| Implementation complexity | Low | High |
| Data model simplicity | ✅ | ❌ |
| Voting clarity | ✅ | ❌ |
| Payment responsibility | ✅ | ❌ |
| Transfer simplicity | ✅ | ❌ |
| User convenience | ⚠️ (shared access) | ✅ |
| Modern family norms | ❌ | ✅ |
| Legal clarity | ✅ | ⚠️ |
| Meeting management | ✅ | ❌ |

---

## Recommendation Summary

**Proceed with single owner design** (Option A) with the following enhancements:

1. ✅ **Implement full resident access** - Both spouses can login and manage household
2. ✅ **Notification preferences** - Residents can opt into notifications
3. ✅ **Designated contacts** - Allow alternate billing/emergency contacts
4. ✅ **Clear permission boundaries** - Distinguish "view" vs "control" access
5. ✅ **Document co-ownership policy** - If a lot truly has multiple owners (e.g., siblings), handle manually or via exception process

**Benefit:** 80% of flexibility with 20% of the complexity.

---

## Next Steps

1. **Board Discussion:** Review this document and make a decision
2. **If Single Owner:** Implement enhanced member access features
3. **If Co-Owners:** Review detailed implementation plan and allocate development time
4. **Policy Decision:** Document how to handle edge cases (divorce, death, disputes)

---

**Prepared by:** Claude (AI Assistant)
**Date:** 2025-02-12
**Version:** 1.0
