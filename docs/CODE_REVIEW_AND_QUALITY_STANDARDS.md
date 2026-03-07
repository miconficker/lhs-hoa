# Code Review and Quality Standards

**Project:** Laguna Hills HOA Management System
**Document Version:** 1.0.0
**Last Updated:** 2026-03-06
**Owner:** Project Manager
**Status:** ✅ Active

---

## Table of Contents

1. [Overview](#overview)
2. [Code Review Process](#code-review-process)
3. [Quality Standards](#quality-standards)
4. [TypeScript Standards](#typescript-standards)
5. [React Standards](#react-standards)
6. [Backend API Standards](#backend-api-standards)
7. [Database Standards](#database-standards)
8. [Security Standards](#security-standards)
9. [Performance Standards](#performance-standards)
10. [Testing Standards](#testing-standards)
11. [Documentation Standards](#documentation-standards)
12. [Review Checklists](#review-checklists)
13. [Quality Metrics](#quality-metrics)

---

## Overview

This document establishes the code review process and quality standards for the Laguna Hills HOA Management System. It serves as the authoritative reference for:

- **Code Review Process:** How reviews are conducted and tracked
- **Quality Standards:** Benchmarks for code quality across all layers
- **Checklists:** Comprehensive review guides for different types of changes
- **Metrics:** Quantifiable measures of code quality

### Purpose

Ensure consistent, high-quality code delivery through:
- **Preventative Quality Control:** Catch issues before they reach production
- **Knowledge Sharing:** Reviews serve as learning opportunities
- **Architecture Compliance:** Verify adherence to ARCHITECTURE.md
- **Security Maintenance:** Continuous security validation
- **Performance Optimization:** Identify performance anti-patterns early

### Scope

These standards apply to:
- ✅ All TypeScript/JavaScript code (frontend and backend)
- ✅ All database schema changes and migrations
- ✅ All API endpoints and routes
- ✅ All React components and hooks
- ✅ All configuration files (wrangler.jsonc, vite.config.ts, etc.)
- ✅ All documentation updates

### Related Documents

- **ARCHITECTURE.md** - System architecture and technical decisions
- **SECURITY_AUDIT_REPORT.md** - Security findings and standards
- **PERFORMANCE_AUDIT_REPORT.md** - Performance benchmarks
- **DESIGN_SYSTEM_AUDIT_REPORT.md** - UI/UX standards
- **ACCESSIBILITY_AUDIT_REPORT.md** - a11y compliance requirements

---

## Code Review Process

### 1. Review Workflow

```
┌─────────────┐
│ Development │
│  (Developer)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Self-Review   │
│  (Developer)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  QA Stage   │
│ (QA Engineer)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│Review Stage │
│(Code Reviewer)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Approved   │
│   (Merge)   │
└─────────────┘
```

### 2. Review Stages

#### Stage 1: Self-Review (Developer Responsibility)

Before submitting for review, developers MUST:

1. **Run Build:** `npm run build` (must pass with no errors)
2. **Run Linter:** `npm run lint` (if configured)
3. **Run Tests:** `npm run test` (all tests must pass)
4. **Self-Check:** Review own code against applicable checklist
5. **Document:** Update relevant documentation (ARCHITECTURE.md, API docs, etc.)

**Deliverable:** Push changes to feature branch with commit message following conventions.

#### Stage 2: QA Stage (QA Engineer)

QA engineers verify:

1. **Functional Testing:** Manual testing of new features
2. **Regression Testing:** Verify existing features still work
3. **Build Verification:** Confirm build passes
4. **Smoke Tests:** Critical path testing
5. **Documentation Check:** Verify docs are updated

**Outcome:**
- ✅ **PASS:** Forward to review stage
- ❌ **FAIL:** Return to develop stage with specific issues documented

**QA Failure Process:**
- QA creates message in `.maestro/messages/qa-engineer/outbox/`
- Project manager reassigns task to developer
- Task priority elevated to `high`
- Note added: `> [returned] Returned from QA: <reason>`

#### Stage 3: Review Stage (Code Reviewer)

Code reviewers examine:

1. **Code Quality:** Readability, maintainability, conventions
2. **Security:** Vulnerabilities, authorization, data exposure
3. **Performance:** Anti-patterns, efficiency, scalability
4. **Architecture:** Adherence to ARCHITECTURE.md patterns
5. **Testing:** Test coverage (if applicable), test quality
6. **Documentation:** Accuracy and completeness

**Outcome:**
- ✅ **APPROVED:** Mark task complete, ready for merge
- 🔄 **REQUEST CHANGES:** Specific feedback provided
- ❌ **REJECTED:** Critical issues found, return to develop

### 3. Review Time Standards

| Change Type | Review Target | Max Turnaround |
|-------------|---------------|----------------|
| Critical Security Fix | Immediate | 2 hours |
| Bug Fix | Same day | 4 hours |
| Feature | 1-2 business days | 24 hours |
| Refactor | 2-3 business days | 48 hours |
| Documentation | 1 business day | 12 hours |

### 4. Review Communication

**Use Maestro Messaging System:**

```json
{
  "message": {
    "id": "unique-id",
    "type": "review-result",
    "from": "code-reviewer",
    "to": "developer-1",
    "subject": "Review feedback for T-XXX",
    "body": "Specific feedback with file:line references...",
    "priority": "normal",
    "timestamp": "2026-03-06T10:00:00Z"
  },
  "status": "pending"
}
```

**Message Types:**
- `review-request` - Request review of changes
- `review-result` - Review findings and approval/rejection
- `task-blocked` - Blocker identified during review
- `question` - Clarification needed

---

## Quality Standards

### 1. Code Quality Dimensions

| Dimension | Definition | Measurement |
|-----------|------------|-------------|
| **Correctness** | Code does what it's supposed to do | Tests pass, manual verification |
| **Readability** | Code is easy to understand | Self-documenting, clear names |
| **Maintainability** | Easy to modify and extend | Low coupling, high cohesion |
| **Performance** | Efficient resource usage | Load time < 3s, API < 200ms |
| **Security** | Free from vulnerabilities | Security audit pass |
| **Testability** | Can be automated tested | Test coverage > 80% (target) |

### 2. Code Quality Scorecard

Each PR is evaluated on:

#### Must Have (Blocking)
- ✅ Build passes without errors
- ✅ No TypeScript errors
- ✅ No console.log in production code
- ✅ No hardcoded secrets or credentials
- ✅ Proper error handling
- ✅ SQL injection protection (parameterized queries)

#### Should Have (Non-Blocking but Important)
- ✅ Tests for new functionality
- ✅ Documentation updated
- ✅ Follows naming conventions
- ✅ Proper logging (not console.log)
- ✅ Access control checks
- ✅ Input validation

#### Nice to Have (Suggestions)
- ✅ Performance optimizations
- ✅ Code comments for complex logic
- ✅ Error boundaries
- ✅ Loading states
- ✅ Accessibility improvements

### 3. Quality Gates

Code must pass these gates to merge:

```yaml
Gate 1 - Build:
  - npm run build: EXIT_CODE == 0
  - No TypeScript errors
  - Bundle size increase < 20%

Gate 2 - Security:
  - No new critical vulnerabilities
  - No secrets in code
  - Proper authentication/authorization

Gate 3 - Architecture:
  - Follows ARCHITECTURE.md patterns
  - No circular dependencies
  - Proper file organization

Gate 4 - Documentation:
  - CLAUDE.md updated if needed
  - ARCHITECTURE.md updated if patterns changed
  - API docs updated for new endpoints
```

---

## TypeScript Standards

### 1. Type Safety

**Strict Mode Enabled:** ✅ Already configured in `tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Requirements:**
- ✅ **No `any` types** (except in specific, documented cases)
- ✅ **Explicit return types** on all functions
- ✅ **Proper null/undefined handling** with optional chaining
- ✅ **Type guards** for runtime validation
- ✅ **Zod schemas** for API input validation

### 2. Type Definitions

**Centralized Types:** All shared types in `src/types/index.ts`

```typescript
// ✅ Good - Centralized type
export interface Household {
  id: string;
  lot_number: string;
  block_number: string;
  owner_user_id: string;
  // ... other fields
}

// ❌ Bad - Duplicate type definition
interface MyHousehold {
  id: string;
  lot: string; // Inconsistent naming
}
```

### 3. Naming Conventions

```typescript
// Interfaces: PascalCase
interface UserService {}
interface ApiResponse<T> {}

// Type Aliases: PascalCase
type UserId = string;
type HouseHoldData = Household;

// Enums: PascalCase
enum UserRole {
  Admin = 'admin',
  Resident = 'resident'
}

// Variables/Functions: camelCase
const userId = '123';
function getUserById() {}

// Constants: UPPER_SNAKE_CASE
const API_BASE_URL = '/api';
const MAX_RETRIES = 3;

// Private properties: underscore prefix
class UserService {
  private _cache: Map<string, User>;
}

// Generic parameters: T (descriptive)
function identity<T>(value: T): T {
  return value;
}
```

### 4. Type Examples

**API Request/Response Types:**
```typescript
// ✅ Good - Explicit types with Zod validation
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1)
});

type CreateUserInput = z.infer<typeof CreateUserSchema>;

interface CreateUserResponse {
  success: boolean;
  data: User;
  error?: string;
}

// ❌ Bad - Implicit any, no validation
async function createUser(data: any) {
  return await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

---

## React Standards

### 1. Component Structure

**Functional Components Only:** ✅ No class components

```typescript
// ✅ Good - Functional component with proper typing
interface UserCardProps {
  user: User;
  onEdit: (id: string) => void;
  className?: string;
}

export function UserCard({ user, onEdit, className }: UserCardProps) {
  return (
    <div className={cn('p-4 border rounded', className)}>
      <h3>{user.name}</h3>
      <button onClick={() => onEdit(user.id)}>Edit</button>
    </div>
  );
}

// ❌ Bad - Class component
class UserCard extends React.Component {
  render() {
    return <div>{this.props.user.name}</div>;
  }
}
```

### 2. Hooks Standards

**Custom Hooks:** Prefix with `use`, proper typing

```typescript
// ✅ Good - Custom hook with proper typing
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Login logic
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { user, isLoading, error, login, logout };
}
```

**Hook Rules:**
- ✅ Only call hooks at the top level
- ✅ Only call hooks from React functions
- ✅ Custom hooks must start with `use`
- ✅ Proper cleanup in `useEffect`

### 3. State Management

**Local State:** `useState` for component-local state
**Global State:** Zustand store for cross-component state
**Server State:** TanStack Query for API data

```typescript
// ✅ Good - Proper state management
function Dashboard() {
  // Local UI state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Global auth state
  const { user } = useAuthStore();

  // Server state with caching
  const { data: households, isLoading } = useQuery({
    queryKey: ['households'],
    queryFn: () => api.get('/households')
  });

  return <div>{/* ... */}</div>;
}

// ❌ Bad - Everything in local state
function Dashboard() {
  const [user, setUser] = useState(null);
  const [households, setHouseholds] = useState([]);
  // Unnecessary re-renders, no caching
}
```

### 4. Props and Component Composition

**Props Destructuring:** Always destructure in signature

```typescript
// ✅ Good - Destructured props with defaults
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'px-4 py-2 rounded',
        variant === 'primary' && 'bg-blue-500',
        variant === 'secondary' && 'bg-gray-500'
      )}
    >
      {children}
    </button>
  );
}
```

**Component Composition:** Favor composition over complex props

```typescript
// ✅ Good - Composable components
<Dialog>
  <DialogTrigger>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Action</DialogTitle>
    </DialogHeader>
    <DialogBody>
      <p>Are you sure?</p>
    </DialogBody>
    <DialogFooter>
      <Button variant="secondary">Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// ❌ Bad - Complex prop drilling
<ComplexDialog
  trigger={<Button>Open</Button>}
  title="Confirm Action"
  body="Are you sure?"
  primaryAction="Confirm"
  secondaryAction="Cancel"
  onPrimary={() => {}}
  onSecondary={() => {}}
/>
```

### 5. Performance

**Memoization:** Use for expensive computations

```typescript
// ✅ Good - Proper memoization
const sortedHouseholds = useMemo(() => {
  return households.sort((a, b) =>
    a.lot_number.localeCompare(b.lot_number)
  );
}, [households]);

const handleClick = useCallback(() => {
  onHouseholdSelect(household.id);
}, [household.id, onHouseholdSelect]);

// ❌ Bad - Unnecessary memoization
const count = useMemo(() => 1 + 1, []); // Overkill
```

**Code Splitting:** Use `React.lazy()` for route components

```typescript
// ✅ Good - Route-based code splitting
const Dashboard = lazy(() => import('./pages/DashboardPage'));
const MapPage = lazy(() => import('./pages/MapPage'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/map" element={<MapPage />} />
      </Routes>
    </Suspense>
  );
}
```

---

## Backend API Standards

### 1. Hono Route Structure

**File Organization:** Routes in `worker/src/routes/`

```typescript
// ✅ Good - Proper route structure
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const households = new Hono<{ Bindings: Env }>();

// Validation schema
const CreateHouseholdSchema = z.object({
  lot_number: z.string().min(1),
  block_number: z.string().min(1),
  owner_user_id: z.string().uuid()
});

// GET /api/households
households.get('/', async (c) => {
  const db = c.get('db');
  const result = await db
    .prepare('SELECT * FROM households')
    .all();
  return c.json(result);
});

// POST /api/households
households.post(
  '/',
  zValidator('json', CreateHouseholdSchema),
  async (c) => {
    const data = c.req.valid('json');
    const db = c.get('db');
    // ... create logic
    return c.json({ success: true, data }, 201);
  }
);

export default households;
```

### 2. Input Validation

**Zod Validation:** Required for all POST/PUT requests

```typescript
// ✅ Good - Zod validation
const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(12, 'Password must be at least 12 characters')
});

router.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  // Safe to use: validated and typed
});

// ❌ Bad - No validation
router.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  // Unsafe: not validated, could be anything
});
```

### 3. Error Handling

**Consistent Error Response Format:**

```typescript
// ✅ Good - Consistent error handling
router.get('/households/:id', async (c) => {
  try {
    const db = c.get('db');
    const result = await db
      .prepare('SELECT * FROM households WHERE id = ?')
      .bind(c.req.param('id'))
      .first();

    if (!result) {
      return c.json(
        {
          success: false,
          error: 'Household not found',
          code: 'NOT_FOUND'
        },
        404
      );
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching household:', error);
    return c.json(
      {
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      500
    );
  }
});
```

### 4. Authentication & Authorization

**JWT Middleware:** Use for protected routes

```typescript
// ✅ Good - Proper auth middleware
import { verifyToken } from '../lib/auth';

// Require authentication
router.use('/*', async (c, next) => {
  const authHeader = c.req.header('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: 'Unauthorized' },
      401
    );
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json(
      { success: false, error: 'Invalid token' },
      401
    );
  }

  // Set user context
  c.set('user', payload);
  await next();
});

// Require admin role
router.use('/admin/*', async (c, next) => {
  const user = c.get('user');

  if (user.role !== 'admin') {
    return c.json(
      { success: false, error: 'Forbidden' },
      403
    );
  }

  await next();
});
```

### 5. Response Format

**Standardized Response Structure:**

```typescript
// Success response
{
  "success": true,
  "data": { /* resource data */ }
}

// Error response
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": { /* additional error context */ }
}

// List response (with pagination - future)
{
  "success": true,
  "data": [ /* items */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## Database Standards

### 1. SQL Safety

**Parameterized Queries:** MANDATORY for ALL queries

```typescript
// ✅ Good - Parameterized query (SQL injection safe)
const result = await db
  .prepare('SELECT * FROM households WHERE id = ?')
  .bind(userInputId)
  .first();

// ❌ CRITICAL - String interpolation (SQL injection vulnerable)
const result = await db
  .prepare(`SELECT * FROM households WHERE id = '${userInputId}'`)
  .first();
```

### 2. Migration Standards

**File Naming:** Sequential with descriptive names

```
migrations/
├── 0001_schema.sql
├── 0002_add_notifications.sql
├── 0003_payment_tracking.sql
└── 0004_payment_notifications.sql
```

**Migration Content:**

```sql
-- ✅ Good migration
-- Migration: Add notifications table
-- Created: 2026-03-05
-- Author: developer-2

-- Create table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
```

**Migration Rules:**
- ✅ Always use `IF NOT EXISTS` for CREATE
- ✅ Always use `IF EXISTS` for DROP
- ✅ Include foreign key constraints
- ✅ Create appropriate indexes
- ✅ Add comments explaining purpose
- ❌ Never include data migrations (separate script)
- ❌ Never modify existing columns (create new, migrate, drop old)

### 3. Index Guidelines

**Create Indexes For:**
- Foreign keys
- Frequently filtered columns
- Columns used in JOINs
- Columns used in ORDER BY

**Don't Over-Index:**
- Each index slows down INSERT/UPDATE
-权衡查询性能和写入性能

```sql
-- ✅ Good - Strategic indexes
CREATE INDEX idx_households_owner ON households(owner_user_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_payments_household ON payments(household_id);

-- ❌ Bad - Unnecessary index
CREATE INDEX idx_users_email ON users(email); -- Already covered by unique constraint
```

### 4. Query Performance

**Use EXPLAIN QUERY PLAN** for complex queries:

```sql
EXPLAIN QUERY PLAN
SELECT h.*, u.name as owner_name
FROM households h
JOIN users u ON h.owner_user_id = u.id
WHERE h.block_number = '1'
ORDER BY h.lot_number;
```

**Optimization Guidelines:**
- ✅ Select only needed columns (avoid `SELECT *`)
- ✅ Use LIMIT for large result sets
- ✅ Use proper indexes
- ✅ Avoid N+1 queries (use JOINs)
- ✅ Consider denormalization for read-heavy data

---

## Security Standards

### 1. Authentication

**Password Requirements:**
- Minimum 12 characters
- Must include: uppercase, lowercase, number, special character
- Hash with bcryptjs (cost factor: 10)
- Never store plaintext passwords

```typescript
// ✅ Good - Proper password hashing
import bcrypt from 'bcryptjs';

const saltRounds = 10;
const hashedPassword = await bcrypt.hash(plaintextPassword, saltRounds);

const isValid = await bcrypt.compare(plaintextPassword, hashedPassword);
```

### 2. JWT Handling

**JWT Best Practices:**

```typescript
// ✅ Good - Proper JWT implementation
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(env.JWT_SECRET);

// Create token
const token = await new SignJWT({ userId, role: 'admin' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('1h')
  .sign(secret);

// Verify token
const { payload } = await jwtVerify(token, secret);
```

**Token Rules:**
- ✅ Use HS256 algorithm
- ✅ Set expiration (max 1 hour for access tokens)
- ✅ Include issued-at timestamp
- ✅ Store secret in environment variable
- ❌ Never log tokens
- ❌ Never send tokens in URL parameters
- ❌ Never store tokens in localStorage for sensitive operations

### 3. Authorization

**Role-Based Access Control (RBAC):**

```typescript
// ✅ Good - RBAC implementation
enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  RESIDENT = 'resident'
}

function canAccessResource(userRole: UserRole, resource: string): boolean {
  const permissions = {
    admin: ['*'], // All access
    staff: ['users:read', 'households:read', 'payments:verify'],
    resident: ['households:read:own', 'payments:create:own']
  };

  const userPermissions = permissions[userRole] || [];

  return userPermissions.includes('*') ||
         userPermissions.includes(resource);
}
```

### 4. Data Validation

**Input Sanitization:**

```typescript
// ✅ Good - Zod validation
const UserInputSchema = z.object({
  email: z.string().email().max(254).trim(),
  name: z.string().min(1).max(100).trim(),
  phone: z.string().regex(/^\+?[\d\s-]+$/).optional()
});

// ❌ Bad - No validation
const userInput = req.body;
```

**Output Encoding:**
- React automatically escapes JSX
- For dynamic HTML attributes, use DOMPurify
- Never trust user input

### 5. Security Headers

**Cloudflare Workers Headers:**

```typescript
// ✅ Good - Security headers
app.use('*', async (c, next) => {
  await next();

  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('X-XSS-Protection', '1; mode=block');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';");

  // CORS headers (if needed)
  c.header('Access-Control-Allow-Origin', 'https://lagunahills.com');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});
```

### 6. Secrets Management

**Environment Variables:**
- ✅ Store in `.dev.vars` (local) or Cloudflare Workers dashboard (production)
- ✅ Use `.dev.vars.example` template (commit to git)
- ❌ Never commit `.dev.vars` with real secrets
- ❌ Never hardcode secrets in code

**Example `.dev.vars.example`:**

```bash
# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-jwt-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# Database (D1 - configured in wrangler.jsonc)
# DB_NAME=laguna_hills_hoa

# R2 Storage (configured in wrangler.jsonc)
# R2_BUCKET=lhs-hoa-documents
```

---

## Performance Standards

### 1. Frontend Performance

**Core Web Vitals Targets:**

| Metric | Target | Current |
|--------|--------|---------|
| LCP (Largest Contentful Paint) | < 2.5s | 3.2s ⚠️ |
| FID (First Input Delay) | < 100ms | TBD |
| CLS (Cumulative Layout Shift) | < 0.1 | TBD |

**Bundle Size:**
- Current: 1.2MB JavaScript (needs reduction)
- Target: < 400KB (67% reduction needed)

**Optimization Techniques:**
- ✅ Route-based code splitting (React.lazy)
- ✅ Tree shaking (Vite automatic)
- ✅ Image optimization (WebP, lazy loading)
- ✅ Minification (Vite automatic)
- ⚠️ Need: API response caching
- ⚠️ Need: Bundle analysis and reduction

### 2. Backend Performance

**API Response Time Targets:**

| Endpoint Type | Target | Current |
|---------------|--------|---------|
| Simple GET | < 50ms | ~80ms |
| Complex GET (with joins) | < 200ms | ~200ms ✅ |
| POST/PUT | < 100ms | ~100ms |
| List (without pagination) | < 500ms | N/A |

**Database Query Optimization:**
- ✅ Use parameterized queries
- ✅ Create appropriate indexes
- ✅ Use EXPLAIN QUERY PLAN
- ⚠️ Add pagination to list endpoints
- ⚠️ Implement query result caching

### 3. Cloudflare Workers Limits

**CPU Time:**
- Free tier: 10ms per request
- Paid tier: 30ms per request
- Target: Keep all requests < 10ms

**Memory:**
- Limit: 128MB
- Monitor: Use Cloudflare Analytics

### 4. Performance Monitoring

**Logging:**
- Use structured logging (not console.log)
- Log API response times
- Monitor error rates

**Example:**

```typescript
// ✅ Good - Performance logging
import { logger } from '../lib/logger';

router.get('/households', async (c) => {
  const startTime = Date.now();

  try {
    const result = await db.prepare('SELECT * FROM households').all();

    const duration = Date.now() - startTime;
    logger.info('API:households:list', {
      duration,
      count: result.length,
      cacheHit: false
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API:households:list:error', {
      duration,
      error: error.message
    });
    throw error;
  }
});
```

---

## Testing Standards

### 1. Test Coverage

**Current State:** 0% coverage (Critical gap)
**Target:** 80% coverage (eventually)

**Coverage Goals by Phase:**

| Phase | Target | Timeline |
|-------|--------|----------|
| Phase 1 | Critical path tests (20%) | Week 1 |
| Phase 2 | Core features (40%) | Week 2-3 |
| Phase 3 | Full coverage (60%) | Week 4-6 |
| Phase 4 | Edge cases (80%+) | Week 7-8 |

### 2. Test Types

**Unit Tests (Vitest):**
- Test individual functions/components
- Fast, isolated
- Mock external dependencies

**Integration Tests (Vitest + msw):**
- Test API + database interactions
- Test component + hook interactions
- Slower, but realistic

**E2E Tests (Playwright - Future):**
- Test complete user flows
- Slowest, but most realistic
- Use for critical paths only

### 3. Test Structure

**File Organization:**

```
src/
├── components/
│   ├── UserCard.tsx
│   └── __tests__/
│       └── UserCard.test.tsx
├── hooks/
│   ├── useAuth.ts
│   └── __tests__/
│       └── useAuth.test.ts
├── lib/
│   ├── api.ts
│   └── __tests__/
│       └── api.test.ts
```

### 4. Test Examples

**React Component Test:**

```typescript
// UserCard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserCard } from '../UserCard';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com'
  };

  it('renders user name', () => {
    render(<UserCard user={mockUser} onEdit={vi.fn()} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('calls onEdit when button clicked', () => {
    const onEdit = vi.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} />);

    screen.getByRole('button', { name: /edit/i }).click();
    expect(onEdit).toHaveBeenCalledWith('1');
  });
});
```

**Hook Test:**

```typescript
// useAuth.test.ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
  it('initializes with no user', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
  });

  it('logs in user successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password123');
    });

    expect(result.current.user).toBeDefined();
    expect(result.current.error).toBeNull();
  });
});
```

**API Test:**

```typescript
// api.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

describe('API', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetches households', async () => {
    const mockData = [
      { id: '1', lot_number: '1A' },
      { id: '2', lot_number: '1B' }
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: mockData })
    });

    const result = await api.get('/households');
    expect(result).toEqual(mockData);
  });
});
```

### 5. Test Best Practices

**DO:**
- ✅ Write tests before implementation (TDD when possible)
- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Test happy path + error cases
- ✅ Mock external dependencies
- ✅ Keep tests fast and isolated

**DON'T:**
- ❌ Test third-party libraries
- ❌ Write brittle tests (break on refactoring)
- ❌ Over-mock (lose confidence)
- ❌ Skip error cases
- ❌ Write slow E2E tests for everything

---

## Documentation Standards

### 1. Code Comments

**When to Comment:**
- ✅ Complex business logic
- ✅ Non-obvious algorithms
- ✅ Workarounds for bugs
- ✅ TODO/FIXME markers
- ❌ Don't comment obvious code

**Example:**

```typescript
// ✅ Good - Helpful comment
// Calculate late fee: 5% of base dues per month late
// Max late fee capped at 50% of base dues (by policy)
function calculateLateFee(
  baseDues: number,
  monthsLate: number
): number {
  const percentage = Math.min(monthsLate * 0.05, 0.5);
  return baseDues * percentage;
}

// ❌ Bad - Unnecessary comment
// Set user to user variable
const user = user;
```

### 2. JSDoc Comments

**For Public APIs:**

```typescript
/**
 * Fetches a household by ID
 * @param id - The household UUID
 * @returns Promise resolving to household data or null if not found
 * @throws {Error} If database query fails
 *
 * @example
 * const household = await getHousehold('abc-123');
 * console.log(household.lot_number); // "1A"
 */
export async function getHousehold(
  id: string
): Promise<Household | null> {
  // ...
}
```

### 3. README Standards

**Project README.md Sections:**
1. Project overview
2. Tech stack
3. Prerequisites
4. Installation steps
5. Development setup
6. Testing instructions
7. Deployment guide
8. Troubleshooting
9. Contributing guidelines

### 4. API Documentation

**Endpoint Documentation:**

```
# GET /api/households/:id

Fetches a single household by ID.

## Authentication
Requires valid JWT token.

## Permissions
- Admin: Can access any household
- Staff: Can access any household (read-only)
- Resident: Can only access own household

## Path Parameters
- `id` (string, required): Household UUID

## Response
Success (200):
{
  "success": true,
  "data": {
    "id": "abc-123",
    "lot_number": "1A",
    "block_number": "1",
    "owner_user_id": "user-123",
    // ...
  }
}

Error (404):
{
  "success": false,
  "error": "Household not found",
  "code": "NOT_FOUND"
}
```

### 5. Architecture Documentation

**ARCHITECTURE.md Updates:**

When making significant changes:
1. Update relevant sections
2. Add new patterns if introduced
3. Update version number
4. Document rationale for decisions

---

## Review Checklists

### 1. General Code Review Checklist

**Correctness:**
- [ ] Code implements requirements correctly
- [ ] Edge cases are handled
- [ ] Error handling is appropriate
- [ ] No obvious bugs or logic errors

**Readability:**
- [ ] Code is self-documenting
- [ ] Variable/function names are descriptive
- [ ] Complex logic has comments
- [ ] No overly complex functions (break down if > 50 lines)

**Maintainability:**
- [ ] Low coupling, high cohesion
- [ ] No code duplication (DRY principle)
- [ ] Follows existing patterns
- [ ] Easy to extend/modify

**Testing:**
- [ ] Tests included for new functionality
- [ ] Tests cover happy path + error cases
- [ ] Tests are not brittle
- [ ] All tests pass

### 2. TypeScript Review Checklist

- [ ] No `any` types (unless documented)
- [ ] Explicit return types on functions
- [ ] Proper null/undefined handling
- [ ] Types are imported from `src/types/`
- [ ] Zod schemas for API inputs
- [ ] No type assertions (use type guards)
- [ ] Generic parameters are descriptive

### 3. React Review Checklist

- [ ] Functional components (no classes)
- [ ] Props destructured in signature
- [ ] Proper TypeScript types for props
- [ ] Hooks follow rules of hooks
- [ ] State management appropriate (local vs global vs server)
- [ ] No unnecessary re-renders
- [ ] Memoization used appropriately
- [ ] Component composition favored over complex props
- [ ] Accessibility (ARIA labels, keyboard navigation)

### 4. Backend API Review Checklist

- [ ] Zod validation on POST/PUT endpoints
- [ ] Proper error handling with try/catch
- [ ] Consistent response format
- [ ] Authentication/authorization checks
- [ ] Parameterized SQL queries (no string interpolation)
- [ ] Appropriate HTTP status codes
- [ ] No console.log in production code
- [ ] Performance considered (indexes, N+1 queries)
- [ ] Security headers set

### 5. Database Review Checklist

- [ ] Migration file named correctly
- [ ] SQL uses parameterized queries
- [ ] Foreign keys defined
- [ ] Indexes created for performance
- [ ] No SELECT * in production code
- [ ] EXPLAIN QUERY PLAN used for complex queries
- [ ] Migration is reversible (consider rollback)

### 6. Security Review Checklist

- [ ] No hardcoded secrets/credentials
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (React auto-escapes, but verify dynamic HTML)
- [ ] CSRF protection (check for state mutations)
- [ ] Authentication required where appropriate
- [ ] Authorization checks (user can access resource)
- [ ] Input validation (Zod schemas)
- [ ] Output encoding (especially for user-generated content)
- [ ] Security headers configured
- [ ] Rate limiting on sensitive endpoints

### 7. Performance Review Checklist

- [ ] No unnecessary re-renders
- [ ] Memoization used for expensive computations
- [ ] Code splitting for large components
- [ ] Images optimized (WebP, lazy loading)
- [ ] Bundle size impact minimal
- [ ] Database queries optimized (indexes, no N+1)
- [ ] API response time acceptable
- [ ] No memory leaks (cleanup in useEffect)
- [ ] Lazy loading for large lists

### 8. Documentation Review Checklist

- [ ] README updated if needed
- [ ] ARCHITECTURE.md updated if patterns changed
- [ ] API documentation updated for new endpoints
- [ ] Code comments for complex logic
- [ ] JSDoc for public APIs
- [ ] Type definitions accurate
- [ ] Example usage provided (if complex)

---

## Quality Metrics

### 1. Code Quality Metrics

**TypeScript Health:**
- ✅ Strict mode enabled
- ✅ Zero `any` types (target)
- ✅ 100% type coverage

**Bundle Size:**
- Current: 1.2MB (JavaScript)
- Target: < 400MB (after code splitting)

**Code Duplication:**
- Target: < 5% duplication
- Tool: sonarjs/eslint-plugin

**Cyclomatic Complexity:**
- Target: < 10 per function
- Tool: eslint-plugin-complexity

### 2. Test Coverage Metrics

**Current:** 0% (Critical gap)
**Target:** 80% (eventual goal)

**Breakdown by Phase:**
- Week 1-2: Critical paths (20%)
- Week 3-4: Core features (40%)
- Week 5-6: Full coverage (60%)
- Week 7-8: Edge cases (80%+)

### 3. Security Metrics

**Vulnerabilities:**
- Critical: 0 (current)
- High: 0 (current)
- Medium: 0 (target)

**Security Score:**
- Current: 8/10 (Good)
- Target: 9/10 (Excellent)

### 4. Performance Metrics

**Frontend:**
- LCP: < 2.5s (target)
- Bundle: < 400KB (target)
- Lighthouse Score: > 90 (target)

**Backend:**
- API response: < 100ms (simple), < 200ms (complex)
- CPU time: < 10ms per request
- Error rate: < 0.1%

### 5. Documentation Metrics

**Coverage:**
- All components documented (target)
- All API endpoints documented (target)
- All public functions have JSDoc (target)

**Quality:**
- ARCHITECTURE.md up to date ✅
- CLAUDE.md comprehensive ✅
- README clear and complete ✅

---

## Continuous Improvement

### 1. Review Process Improvements

**Monthly Retrospective:**
- What's working well in reviews?
- What causes delays?
- How can we improve quality gates?
- Are standards being followed?

### 2. Standards Updates

**When to Update This Document:**
- New patterns established
- Security vulnerabilities identified
- Performance benchmarks change
- Technology stack updates
- Process improvements identified

**Update Process:**
1. Propose change with rationale
2. Review with team
3. Update document
4. Increment version number
5. Communicate changes

### 3. Quality Trend Analysis

**Track Over Time:**
- Review turnaround time
- Bug rate post-merge
- Test coverage growth
- Security vulnerabilities found
- Performance metrics

**Tools:**
- GitHub Insights
- Cloudflare Analytics
- Lighthouse CI
- Test coverage reports

---

## Appendix

### A. Quick Reference

**Essential Commands:**
```bash
# Build
npm run build

# Test
npm run test

# Dev server
npm run dev:all

# Database migration
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local

# Deploy
npx wrangler pages deploy dist
```

**Key Files:**
- `ARCHITECTURE.md` - System architecture
- `CLAUDE.md` - Project instructions
- `CODE_REVIEW_AND_QUALITY_STANDARDS.md` - This document
- `SECURITY_AUDIT_REPORT.md` - Security findings
- `PERFORMANCE_AUDIT_REPORT.md` - Performance findings

### B. Review Template

```markdown
## Code Review for T-XXX

### Summary
[Brief description of changes]

### Changes Reviewed
- [File 1](link) - Description
- [File 2](link) - Description

### Findings

#### Critical Issues (Must Fix)
- [ ] Issue 1 [file:line]
- [ ] Issue 2 [file:line]

#### Important Issues (Should Fix)
- [ ] Issue 1 [file:line]
- [ ] Issue 2 [file:line]

#### Suggestions (Nice to Have)
- [ ] Suggestion 1 [file:line]
- [ ] Suggestion 2 [file:line]

### Strengths
- What's well done

### Overall Assessment
- [ ] APPROVED
- [ ] REQUEST CHANGES
- [ ] REJECTED

### Comments
[Additional feedback]
```

### C. Resources

**Internal:**
- ARCHITECTURE.md
- SECURITY_AUDIT_REPORT.md
- PERFORMANCE_AUDIT_REPORT.md
- DESIGN_SYSTEM_AUDIT_REPORT.md
- ACCESSIBILITY_AUDIT_REPORT.md

**External:**
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Hono Documentation](https://hono.dev)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/WCAG21/quickref/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Document End**

*For questions or suggestions about these standards, please contact the project manager.*
