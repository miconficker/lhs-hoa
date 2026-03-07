# T-037 Developer Onboarding Guide - Implementation Guide

**Task:** Developer Onboarding Guide
**Status:** BLOCKED - Requires Implementation
**Estimated Time:** 1 day (8 hours)

---

## Quick Start

Create two comprehensive documents that guide new developers through their first week on the project.

---

## File 1: Developer Onboarding Guide Template

**File:** `docs/DEVELOPER_ONBOARDING.md`
**Length:** 800-1200 lines
**Audience:** New developers joining the project

### Template Structure:

```markdown
# Developer Onboarding Guide

Welcome to the Laguna Hills HOA Management System! This guide will help you get up and running as a contributor to this project.

---

## Table of Contents

- [Welcome](#welcome)
- [Day 1: Setup](#day-1-setup)
- [Development Environment](#development-environment)
- [Project Architecture](#project-architecture)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guide](#testing-guide)
- [Common Development Tasks](#common-development-tasks)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)
- [Resources](#resources)

---

## Welcome

### About This Project

The Laguna Hills HOA Management System is a comprehensive web application for managing homeowners association operations. Built with modern technologies:

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Cloudflare Workers + Hono
- **Database:** D1 (SQLite)
- **Storage:** R2 (object storage)
- **UI:** shadcn/ui + Tailwind CSS

### Your First Week Goals

By the end of your first week, you should be able to:
- ✅ Run the application locally
- ✅ Understand the project architecture
- ✅ Make a code change and test it
- ✅ Create a pull request
- ✅ Write a basic test

### Getting Help

- **Tech Lead:** [Name and contact]
- **Team Chat:** [Slack/Discord link]
- **Issue Tracker:** [GitHub Issues link]
- **Documentation:** See [Resources](#resources)

---

## Day 1: Setup

### Prerequisites Checklist

Before you start, ensure you have:

- [ ] **Node.js 18+** - Download from [nodejs.org](https://nodejs.org)
  ```bash
  node --version  # Should be v18+
  ```

- [ ] **npm** - Comes with Node.js
  ```bash
  npm --version
  ```

- [ ] **Git** - Download from [git-scm.com](https://git-scm.com)
  ```bash
  git --version
  ```

- [ ] **VS Code** (recommended) - Download from [code.visualstudio.com](https://code.visualstudio.com)
  - Extensions needed:
    - ES7+ React/Redux/React-Native snippets
    - TypeScript
    - Tailwind CSS IntelliSense
    - GitLens

- [ ] **Cloudflare Account** - Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
  - Free account is sufficient for development

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone https://github.com/miconficker/lhs-hoa.git
cd lhs-hoa
```

### Step 2: Install Dependencies

```bash
# Install all npm packages
npm install
```

**Expected output:** Installation completes without errors (~2-3 minutes)

**If you see errors:**
- `EACCES` permission errors → Try with `sudo` (Mac/Linux) or run as administrator (Windows)
- `network` errors → Check your internet connection, try again
- `package-lock.json` conflicts → Delete `node_modules` and `package-lock.json`, run `npm install` again

### Step 3: Install Wrangler CLI

Wrangler is the CLI tool for Cloudflare Workers:

```bash
# Install Wrangler globally
npm install -g wrangler

# Verify installation
wrangler --version
```

### Step 4: Set Up Cloudflare Workers

Create or copy `wrangler.jsonc` configuration:

```bash
# Login to Cloudflare
wrangler login

# This will open your browser for authentication
```

**Configuration file:** `wrangler.jsonc`

```jsonc
{
  "name": "laguna-hills-hoa-api",
  "main": "worker/src/index.ts",
  "compatibility_date": "2024-09-23",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "laguna_hills_hoa",
      "database_id": "YOUR_D1_DATABASE_ID"  // Replace with actual ID
    }
  ],
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "hoa-documents"
    }
  ],
  "vars": {
    "ENVIRONMENT": "development",
    "JWT_SECRET": "your-secret-key-here"
  }
}
```

### Step 5: Create D1 Database

```bash
# Create a new D1 database
npx wrangler d1 create laguna_hills_hoa

# Copy the database_id from the output and update wrangler.jsonc
```

### Step 6: Run Database Migrations

```bash
# Run all migrations locally
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0002_add_lot_ownership.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0003_lot_type_dues_demands.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0004_notifications.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0005_user_names.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0006_household_grouping.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0007_lot_types_labels.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0008_pass_management.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0003_payment_verification.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0004_add_payment_notification_types.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0005_late_fee_config.sql --local
```

**Expected output:** Each migration shows "Success" with SQL execution details

**If you see errors:**
- "database not found" → Run `npx wrangler d1 create laguna_hills_hoa` first
- "table already exists" → Already migrated, continue to next file
- "permission denied" → Check wrangler authentication, run `wrangler login` again

### Step 7: Seed Initial Users

```bash
# Create test users (admin and resident)
npx tsx scripts/seed-users.ts
```

**Test accounts created:**
- Admin: `admin@lagunahills.com` / `admin123`
- Resident: `resident@test.com` / `resident123`

### Step 8: Start the Application

```bash
# Start both frontend and backend
npm run dev:all

# Or use the shell script
./dev.sh
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose

  ⛅️ wrangler dev  http://localhost:8787
```

### Step 9: Verify Installation

1. **Open Frontend:** http://localhost:5173
   - ✅ You should see the login page
   - ✅ Dark mode toggle works (top right)

2. **Test Backend:** http://localhost:8787/api/health
   - ✅ You should see: `{"status":"ok"}`

3. **Login as Admin:**
   - Email: `admin@lagunahills.com`
   - Password: `admin123`
   - ✅ You should see the dashboard

4. **Test Hot Reload:**
   - Open `src/App.tsx`
   - Make a small change (e.g., change text)
   - Save the file
   - ✅ Browser should auto-refresh with your change

**Congratulations! 🎉** Your development environment is ready!

---

## Development Environment

### IDE Setup (VS Code)

**Recommended Extensions:**

1. **ES7+ React/Redux/React-Native snippets** - Code snippets for React
2. **TypeScript** - TypeScript language support
3. **Tailwind CSS IntelliSense** - Tailwind autocomplete
4. **GitLens** - Git supercharged
5. **Prettier** - Code formatter
6. **ESLint** - Code linter

**VS Code Settings (`.vscode/settings.json`):**

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ]
}
```

### Environment Variables

**Development:** Use `.dev.vars` (not tracked by git)

```bash
# .dev.vars
JWT_SECRET=your-development-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
ENVIRONMENT=development
```

**Production:** Set in Cloudflare Workers dashboard or GitHub Secrets

### Local Database (D1)

**Check database status:**
```bash
# List all tables
npx wrangler d1 execute laguna_hills_hoa --local --command="SELECT name FROM sqlite_master WHERE type='table';"

# Query specific table
npx wrangler d1 execute laguna_hills_hoa --local --command="SELECT * FROM users LIMIT 5;"
```

**Reset database (if needed):**
```bash
# Delete and recreate
npx wrangler d1 delete laguna_hills_hoa
npx wrangler d1 create laguna_hills_hoa
# Re-run all migrations (see Step 6 above)
```

### Cloudflare Workers Local Development

**Start backend only:**
```bash
npm run dev:worker
```

**Test API endpoints:**
```bash
# Health check
curl http://localhost:8787/api/health

# Login
curl -X POST http://localhost:8787/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lagunahills.com","password":"admin123"}'
```

---

## Project Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Vite + React)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages      │  │  Components  │  │    State     │      │
│  │  (Routing)   │  │  (shadcn/ui) │  │  (Zustand)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTP/TanStack Query
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Backend (Cloudflare Workers + Hono)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Routes     │  │  Middleware  │  │   Services   │      │
│  │  (REST API)  │  │   (Auth)     │  │  (Business)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ↓                  ↓                  ↓
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │   D1    │       │   R2    │       │  OAuth  │
    │ (SQLite)│       │ (Files) │       │(Google) │
    └─────────┘       └─────────┘       └─────────┘
```

### Frontend Architecture

**Directory Structure:**
```
src/
├── pages/              # Route pages (Dashboard, Map, Payments, etc.)
├── components/         # Reusable components
│   ├── ui/            # shadcn/ui components (Button, Card, etc.)
│   ├── layout/        # Layout components (Header, Sidebar)
│   └── [feature]/     # Feature-specific components
├── lib/               # Utilities and configurations
│   ├── api.ts         # API client (TanStack Query)
│   └── utils.ts       # Helper functions
├── stores/            # Zustand state stores
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
└── App.tsx            # Root component with routing
```

**Key Technologies:**
- **React Router v6:** Client-side routing
- **Zustand:** State management (global state)
- **TanStack Query:** Server state management (API caching)
- **React Hook Form:** Form handling
- **Zod:** Schema validation

**Routing Pattern:**
```typescript
// src/App.tsx
<Routes>
  <Route path="/" element={<MainLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="map" element={<MapPage />} />
    <Route path="payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
  </Route>
</Routes>
```

### Backend Architecture

**Directory Structure:**
```
worker/
├── src/
│   ├── index.ts           # Worker entry point
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication endpoints
│   │   ├── users.ts       # User management
│   │   ├── payments.ts    # Payment endpoints
│   │   └── ...
│   ├── middleware/        # Request middleware
│   │   └── auth.ts        # JWT verification
│   ├── services/          # Business logic
│   └── utils/             # Helper functions
└── wrangler.jsonc        # Cloudflare Workers config
```

**Key Technologies:**
- **Hono:** Fast web framework for Workers
- **jose:** JWT authentication (Cloudflare-compatible)
- **Zod:** Input validation
- **D1:** SQLite database (Cloudflare)
- **R2:** Object storage (Cloudflare)

**API Pattern:**
```typescript
// worker/src/routes/example.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

// Schema validation
const schema = z.object({
  name: z.string().min(1),
  email: z.string().email()
});

// GET endpoint
app.get('/', async (c) => {
  const db = c.env.DB;
  const results = await db.prepare('SELECT * FROM users').all();
  return c.json(results);
});

// POST endpoint with validation
app.post('/', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  const db = c.env.DB;
  // ... process data
  return c.json({ success: true });
});

export default app;
```

### Database Schema

**Key Tables:**
- `users` - User accounts and authentication
- `households` - Household/grouping information
- `lots` - Property lots
- `payments` - Payment records
- `service_requests` - Maintenance requests
- `notifications` - User notifications

**Full schema:** See [docs/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) or [ARCHITECTURE.md](../ARCHITECTURE.md#database-schema)

**Database Access Patterns:**
```typescript
// Query with parameterization (SQL injection safe)
const result = await db
  .prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .first();

// Multiple results
const results = await db
  .prepare('SELECT * FROM lots WHERE block = ?')
  .bind(blockNumber)
  .all();

// Transaction-like behavior (multiple statements)
await db.batch([
  db.prepare('INSERT INTO payments ...'),
  db.prepare('UPDATE households ...')
]);
```

---

## Development Workflow

### Git Workflow with Worktrees

This project uses **git worktrees** for feature branch isolation:

**Why worktrees?**
- Keep main branch clean
- Work on multiple features simultaneously
- Fast switching between branches
- Isolated development environments

**Creating a Worktree:**
```bash
# Create a new feature branch with worktree
git worktree add .worktrees/feature-name -b feature/feature-name

# Navigate to the worktree
cd .worktrees/feature-name

# Work in this isolated directory
# ... make changes, commit, test ...

# After merging, clean up
cd ..  # Back to root
git worktree remove --force .worktrees/feature-name
git branch -d feature/feature-name
```

**List Active Worktrees:**
```bash
git worktree list
```

### Branch Naming Conventions

- `feature/` - New features
  - Example: `feature/add-payment-reminder`
- `bugfix/` - Bug fixes
  - Example: `bugfix/fix-login-error`
- `hotfix/` - Urgent production fixes
  - Example: `hotfix/security-patch`
- `docs/` - Documentation updates
  - Example: `docs/update-api-guide`

### Commit Message Conventions

Follow **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**
```
feat(payments): add late fee calculation

Implement automatic late fee calculation based on
payment due date and configured fee structure.

Closes #123

fix(auth): resolve JWT expiration issue

Tokens were expiring too early due to incorrect
timestamp calculation. Fixed by using Date.now()
instead of manual time parsing.

docs(readme): update installation instructions

Clarified D1 database setup steps with proper
command examples.
```

### Pull Request Process

**1. Create Feature Branch:**
```bash
git checkout -b feature/your-feature-name
```

**2. Make Changes and Commit:**
```bash
git add .
git commit -m "feat(scope): description"
```

**3. Push to Remote:**
```bash
git push origin feature/your-feature-name
```

**4. Create Pull Request:**
- Go to GitHub repository
- Click "Pull Requests" → "New Pull Request"
- Select your branch
- Fill in PR template:
  ```markdown
  ## Description
  Brief description of changes

  ## Type of Change
  - [ ] Bug fix
  - [ ] New feature
  - [ ] Breaking change
  - [ ] Documentation update

  ## Testing
  - [ ] Unit tests pass
  - [ ] Manual testing completed
  - [ ] Screenshots attached (if UI changes)

  ## Checklist
  - [ ] Code follows style guidelines
  - [ ] Self-review completed
  - [ ] Comments added to complex code
  - [ ] Documentation updated
  ```

**5. Code Review:**
- Address review comments
- Make requested changes
- Push updates to branch
- Request re-review if needed

**6. Merge:**
- After approval, merge using:
  - **Squash and merge** (recommended for features)
  - **Merge commit** (for preserving history)
- Delete branch after merge

### Code Review Guidelines

**For Reviewers:**
- ✅ Check for bugs and logic errors
- ✅ Verify TypeScript types are correct
- ✅ Ensure proper error handling
- ✅ Check for SQL injection vulnerabilities
- ✅ Verify accessibility (ARIA labels, keyboard nav)
- ✅ Check for hardcoded values (should use config)
- ✅ Ensure tests are added/updated
- ✅ Verify documentation is updated

**For Authors:**
- ✅ Keep PRs focused and small
- ✅ Add clear description of changes
- ✅ Respond to review comments promptly
- ✅ Explain complex logic in comments
- ✅ Add tests for new functionality
- ✅ Update relevant documentation

---

## Coding Standards

### TypeScript Best Practices

**1. Use Explicit Types:**
```typescript
// ✅ Good - Explicit type
interface User {
  id: string;
  name: string;
  email: string;
}

const user: User = {
  id: '123',
  name: 'John',
  email: 'john@example.com'
};

// ❌ Bad - Implicit any
const user = {
  id: '123',
  name: 'John'
};
```

**2. Use Union Types for Options:**
```typescript
// ✅ Good
type Role = 'admin' | 'resident' | 'staff' | 'guest';

function setRole(role: Role) {
  // ...
}

// ❌ Bad
function setRole(role: string) {
  // Too permissive
}
```

**3. Avoid `any` Type:**
```typescript
// ❌ Bad
function processData(data: any) {
  return data.value;
}

// ✅ Good - Use generics or unknown
function processData<T extends { value: unknown }>(data: T) {
  return data.value;
}
```

### React Patterns

**1. Component Organization:**
```typescript
// ✅ Good - Organized component
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface MyComponentProps {
  title: string;
  onSave: () => void;
}

export function MyComponent({ title, onSave }: MyComponentProps) {
  // Hooks first
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Event handlers
  const handleSave = async () => {
    setLoading(true);
    try {
      await onSave();
    } finally {
      setLoading(false);
    }
  };

  // Render
  return (
    <div>
      <h1>{title}</h1>
      <Button onClick={handleSave} disabled={loading}>
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
```

**2. Custom Hooks for Reusability:**
```typescript
// ✅ Good - Custom hook
function useUserData(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  return { user, loading };
}

// Usage
function UserProfile({ userId }: { userId: string }) {
  const { user, loading } = useUserData(userId);

  if (loading) return <Skeleton />;
  return <div>{user?.name}</div>;
}
```

**3. Avoid Prop Drilling with Context:**
```typescript
// ❌ Bad - Prop drilling
function App() {
  const user = { name: 'John' };
  return <Layout user={user} />;
}

function Layout({ user }: { user: User }) {
  return <Header user={user} />;
}

function Header({ user }: { user: User }) {
  return <div>{user.name}</div>;
}

// ✅ Good - Using context/Zustand
function App() {
  return <Layout />;
}

function Header() {
  const user = useUserStore(state => state.user);
  return <div>{user.name}</div>;
}
```

### File Naming Conventions

**Components:**
- PascalCase: `UserProfile.tsx`, `PaymentForm.tsx`
- Grouped by feature: `components/payments/PaymentForm.tsx`

**Utilities/Helpers:**
- camelCase: `formatCurrency.ts`, `calculateLateFee.ts`

**Types:**
- `types/` directory: `types/index.ts` (main types file)
- Co-located: `components/payments/types.ts` (feature-specific types)

**Pages:**
- PascalCase with "Page" suffix: `DashboardPage.tsx`, `PaymentsPage.tsx`

### Import Order

```typescript
// 1. React imports
import { useState, useEffect } from 'react';

// 2. Third-party imports
import { useRouter } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

// 3. Internal imports (grouped)
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { User } from '@/types';

// 4. Relative imports (last)
import { LocalComponent } from './LocalComponent';
```

### Code Formatting

**Use Prettier for consistent formatting:**
```bash
# Format all files
npm run format

# Format specific file
npx prettier --write src/components/PaymentForm.tsx
```

**Prettier configuration:** `.prettierrc`
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

---

## Testing Guide

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test src/components/ui/__tests__/button.test.tsx
```

### Writing Unit Tests

**Example: Component Test**
```typescript
// src/components/ui/__tests__/button.test.tsx
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { Button } from '../button';

test('renders button with text', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByText('Click me')).toBeInTheDocument();
});

test('applies variant classes', () => {
  const { rerender } = render(<Button variant="destructive">Delete</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('bg-destructive');
});
```

**Example: Hook Test**
```typescript
// src/hooks/__tests__/use-auth.test.ts
import { renderHook, act } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { useAuth } from '../use-auth';

test('logs in user', async () => {
  const { result } = renderHook(() => useAuth());

  await act(async () => {
    await result.current.login('admin@lagunahills.com', 'admin123');
  });

  expect(result.current.user).toBeDefined();
  expect(result.current.isAuthenticated).toBe(true);
});
```

### Writing Integration Tests

**Example: API Integration Test**
```typescript
// src/test/integration/auth.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { authTestUtils } from '../utils/auth-test-utils';

describe('Authentication API', () => {
  beforeAll(async () => {
    await authTestUtils.setup();
  });

  it('logs in with valid credentials', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@lagunahills.com',
        password: 'admin123'
      })
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.token).toBeDefined();
  });
});
```

### Test Coverage Goals

- **Critical paths:** 80%+ coverage
- **UI components:** 70%+ coverage
- **API endpoints:** 80%+ coverage
- **Utilities:** 90%+ coverage

**View coverage report:**
```bash
npm run test:coverage
# Open coverage/index.html in browser
```

---

## Common Development Tasks

### Adding a New Page

**1. Create page component:**
```typescript
// src/pages/NewFeaturePage.tsx
import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';

export function NewFeaturePage() {
  const [data, setData] = useState([]);

  return (
    <MainLayout>
      <div>
        <h1>New Feature</h1>
        {/* Content */}
      </div>
    </MainLayout>
  );
}
```

**2. Add route:**
```typescript
// src/App.tsx
import { NewFeaturePage } from './pages/NewFeaturePage';

// In <Routes>
<Route path="new-feature" element={
  <ProtectedRoute requiredRoles={['admin']}>
    <NewFeaturePage />
  </ProtectedRoute>
} />
```

**3. Add navigation link:**
```typescript
// src/components/layout/Sidebar.tsx
const navItems = [
  // ...
  {
    title: 'New Feature',
    url: '/new-feature',
    icon: Map, // Import appropriate icon
    roles: ['admin']
  }
];
```

### Creating a New API Endpoint

**1. Create route file:**
```typescript
// worker/src/routes/new-feature.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono<{ Bindings: Env }>();

const schema = z.object({
  name: z.string().min(1),
  value: z.number()
});

// GET /api/new-feature
app.get('/', async (c) => {
  const db = c.env.DB;
  const results = await db.prepare('SELECT * FROM new_feature').all();
  return c.json(results.results);
});

// POST /api/new-feature
app.post('/', zValidator('json', schema), async (c) => {
  const data = c.req.valid('json');
  const db = c.env.DB;

  await db
    .prepare('INSERT INTO new_feature (name, value) VALUES (?, ?)')
    .bind(data.name, data.value)
    .run();

  return c.json({ success: true, data });
});

export default app;
```

**2. Mount route in worker:**
```typescript
// worker/src/index.ts
import newFeatureRouter from './routes/new-feature';

app.route('/api/new-feature', newFeatureRouter);
```

**3. Add API client method:**
```typescript
// src/lib/api.ts
export const api = {
  // ...existing methods

  newFeature: {
    list: () => fetch('/api/new-feature').then(r => r.json()),
    create: (data: { name: string; value: number }) =>
      fetch('/api/new-feature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(r => r.json())
  }
};
```

**4. Use in component:**
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

function NewFeaturePage() {
  const { data } = useQuery({
    queryKey: ['new-feature'],
    queryFn: api.newFeature.list
  });

  const createMutation = useMutation({
    mutationFn: api.newFeature.create,
    onSuccess: () => {
      // Refresh data
      queryClient.invalidateQueries(['new-feature']);
    }
  });

  return (
    <div>
      <button onClick={() => createMutation.mutate({ name: 'Test', value: 123 })}>
        Create
      </button>
      {data?.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

### Adding a Database Migration

**1. Create migration file:**
```sql
-- migrations/0010_add_new_table.sql

-- Create new table
CREATE TABLE IF NOT EXISTS new_table (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_new_table_name ON new_table(name);
```

**2. Run migration locally:**
```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0010_add_new_table.sql --local
```

**3. Run migration in production:**
```bash
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0010_add_new_table.sql
```

**4. Update TypeScript types:**
```typescript
// src/types/index.ts
export interface NewTable {
  id: string;
  name: string;
  created_at: string;
}
```

---

## Troubleshooting

### Common Build Errors

**Error: "Cannot find module '@/components/..."**
```
Solution: Check tsconfig.json has path alias configured:
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Error: "Type 'X' is not assignable to type 'Y'"**
```
Solution: Check your TypeScript types. Use 'as unknown as Y' only as last resort.
Better: Fix the type definitions to match actual usage.
```

**Error: "Module not found: Error: Can't resolve 'react'"**
```bash
Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Runtime Issues

**Issue: "Hot reload not working"**
```bash
Solution 1: Check Vite HMR configuration in vite.config.ts
Solution 2: Clear cache and restart
rm -rf node_modules/.vite
npm run dev:all
```

**Issue: "API calls returning 404"**
```
Solution 1: Check backend is running (http://localhost:8787)
Solution 2: Check API route is properly mounted in worker/src/index.ts
Solution 3: Check API_BASE in src/lib/api.ts (should be "/api", not "/api/api")
```

**Issue: "Database query returns no results"**
```bash
Solution 1: Check database exists
wrangler d1 list

Solution 2: Check migrations ran
npx wrangler d1 execute laguna_hills_hoa --local --command="SELECT name FROM sqlite_master WHERE type='table';"

Solution 3: Check query parameterization (use .bind(), not string interpolation)
```

### Cloudflare Workers Issues

**Issue: "Workers runtime error: TextEncoder is not defined"**
```
Solution: Add nodejs_compat flag in wrangler.jsonc
{
  "compatibility_flags": ["nodejs_compat"]
}
```

**Issue: "JWT verification fails"**
```
Solution 1: Check JWT_SECRET is same in .dev.vars and wrangler.jsonc
Solution 2: Use jose library (not jsonwebtoken) for Cloudflare Workers
Solution 3: Check token hasn't expired
```

### Getting Help

**1. Check Documentation:**
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System design
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - API reference
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database structure
- [CLAUDE.md](../CLAUDE.md) - Project-specific gotchas

**2. Search Existing Issues:**
- GitHub Issues: Check if problem already reported
- Team Chat: Search Slack/Discord for similar issues

**3. Ask the Team:**
- Post in team chat with:
  - Error message (full stack trace)
  - Steps to reproduce
  - What you've tried
  - Expected vs actual behavior

**4. Debug Tips:**
```typescript
// Add console.log to debug
console.log('Data:', data);

// Use debugger statement
debugger; // Opens browser DevTools debugger

// Check React component props
console.log('Props:', props);

// Check API response
fetch('/api/endpoint')
  .then(r => r.json())
  .then(data => console.log('API Response:', data));
```

---

## Deployment

### Frontend Deployment (Cloudflare Pages)

**Manual Deployment:**
```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=lhs-hoa
```

**CI/CD Deployment:**
- Push to `main` branch
- GitHub Actions automatically deploys
- See [docs/CI-CD-AUTOMATION.md](CI-CD-AUTOMATION.md) for details

### Backend Deployment (Cloudflare Workers)

**Manual Deployment:**
```bash
# Deploy Worker
npx wrangler deploy

# Deploy with specific environment
npx wrangler deploy --env production
```

**CI/CD Deployment:**
- Automatic via GitHub Actions
- See `.github/workflows/deploy-production.yml`

### Environment Variables

**Development:** `.dev.vars` (local, not tracked)
**Production:** Cloudflare dashboard → Settings → Environment Variables

**Required Variables:**
- `JWT_SECRET` - JWT token secret
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `ENVIRONMENT` - "development" or "production"

---

## Resources

### Documentation

- **[README.md](../README.md)** - Project overview and setup
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Complete system architecture
- **[API_DOCUMENTATION.md](API_DOCUMENTATION.md)** - API endpoint reference
- **[DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)** - Database structure
- **[CI-CD-AUTOMATION.md](CI-CD-AUTOMATION.md)** - CI/CD pipeline guide
- **[testing.md](testing.md)** - Testing framework overview

### External Resources

- **React 18:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Hono:** https://hono.dev/docs
- **TanStack Query:** https://tanstack.com/query/latest/docs/
- **shadcn/ui:** https://ui.shadcn.com/

### Team Contacts

- **Project Lead:** [Name, email]
- **Tech Lead:** [Name, email]
- **Team Chat:** [Slack/Discord link]

### Quick Reference

**Common Commands:**
```bash
# Development
npm run dev:all          # Start frontend + backend
npm run dev              # Frontend only
npm run dev:worker       # Backend only

# Building
npm run build            # Build for production

# Testing
npm run test             # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm run type-check       # TypeScript check
```

**Key Files:**
- `src/App.tsx` - Root component with routing
- `src/lib/api.ts` - API client
- `worker/src/index.ts` - Backend entry point
- `wrangler.jsonc` - Cloudflare Workers config

---

**Congratulations on completing the onboarding guide!** 🎉

You now have everything you need to start contributing. Welcome to the team!

For questions or clarifications, don't hesitate to reach out to the team.
```

---

## File 2: Onboarding Checklist Template

**File:** `docs/ONBOARDING_CHECKLIST.md`
**Length:** ~100 lines
**Format:** Checkbox checklist

### Template:

```markdown
# Developer Onboarding Checklist

Use this checklist to track your progress during your first week.

---

## Day 1 - Setup ✅

### Environment Setup
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] Git installed (`git --version`)
- [ ] VS Code installed with extensions:
  - [ ] ES7+ React/Redux/React-Native snippets
  - [ ] TypeScript
  - [ ] Tailwind CSS IntelliSense
  - [ ] GitLens
  - [ ] Prettier
  - [ ] ESLint
- [ ] Cloudflare account created
- [ ] Wrangler CLI installed (`wrangler --version`)

### Project Setup
- [ ] Repository cloned
- [ ] Dependencies installed (`npm install`)
- [ ] D1 database created locally
- [ ] All migrations run successfully
- [ ] Test users seeded (`npx tsx scripts/seed-users.ts`)

### Verification
- [ ] Frontend starts at http://localhost:5173
- [ ] Backend starts at http://localhost:8787
- [ ] Health check passes: http://localhost:8787/api/health
- [ ] Can login as admin (admin@lagunahills.com / admin123)
- [ ] Hot reload works (edit file, save, browser updates)

---

## Day 2-3 - Understanding 📚

### Architecture
- [ ] Read [ARCHITECTURE.md](../ARCHITECTURE.md)
- [ ] Understand frontend architecture (React, routing, state)
- [ ] Understand backend architecture (Cloudflare Workers, Hono)
- [ ] Review database schema (see DATABASE_SCHEMA.md)
- [ ] Understand API design patterns

### Documentation
- [ ] Read [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- [ ] Read [README.md](../README.md) development section
- [ ] Review [CLAUDE.md](../CLAUDE.md) project gotchas
- [ ] Understand testing strategy (see testing.md)

### Codebase Walkthrough
- [ ] Explore `src/pages/` - Page components
- [ ] Explore `src/components/` - Reusable components
- [ ] Explore `src/lib/api.ts` - API client
- [ ] Explore `worker/src/routes/` - API endpoints
- [ ] Explore migrations directory

---

## Day 4 - First Code Change 💻

### Setup Development Environment
- [ ] Create git worktree for practice feature
  ```bash
  git worktree add .worktrees/practice-add-profile-button -b feature/practice-add-profile-button
  cd .worktrees/practice-add-profile-button
  ```
- [ ] Create a feature branch (or use worktree branch)

### Make a Small Change
- [ ] Add a button to a page (e.g., Dashboard)
- [ ] Use shadcn/ui Button component
- [ ] Add appropriate styling (Tailwind CSS)
- [ ] Test change in browser
- [ ] Verify hot reload works

### Commit Changes
- [ ] Stage changes (`git add`)
- [ ] Commit with conventional message:
  ```
  feat(dashboard): add profile button for user settings

  Added button to header that links to user profile page.
  Uses shadcn/ui Button component with proper styling.
  ```
- [ ] Push branch to remote

### Create Pull Request (Optional Practice)
- [ ] Create PR on GitHub
- [ ] Fill in PR template
- [ ] Request review (can self-review for practice)
- [ ] Address any feedback
- [ ] Merge PR (or close after practice)

---

## Week 1 - Learning Goals 🎯

### Git & Workflow
- [ ] Created feature branch using worktrees
- [ ] Made commits following conventional commit format
- [ ] Created (or practiced creating) pull request
- [ ] Understand CI/CD pipeline (see CI-CD-AUTOMATION.md)
- [ ] Cleaned up worktree after merging

### Coding Standards
- [ ] Followed TypeScript best practices
- [ ] Used proper component organization
- [ ] Followed file naming conventions
- [ ] Used import order guidelines
- [ ] Code formatted with Prettier
- [ ] No ESLint errors

### Testing
- [ ] Run existing tests (`npm run test`)
- [ ] Understand test framework (Vitest)
- [ ] Read test examples in `src/test/`
- [ ] Practice writing a simple unit test

### Problem Solving
- [ ] Encountered and resolved a build error
- [ ] Used Troubleshooting section of onboarding guide
- [ ] Asked for help when needed (team chat)
- [ ] Documented solution (if new issue)

---

## Ongoing - Best Practices 📋

### Before Starting Work
- [ ] Checked existing issues/assignments
- [ ] Created feature branch with worktree
- [ ] Understand requirements clearly
- [ ] Reviewed related code/documentation

### During Development
- [ ] Writing tests for new features
- [ ] Following coding standards
- [ ] Committing frequently with clear messages
- [ ] Running linting and formatting
- [ ] Testing changes manually

### Before Submitting PR
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] New tests added (if applicable)
- [ ] Documentation updated
- [ ] PR description is clear
- [ ] Self-review completed

### After Merge
- [ ] Clean up worktree
- [ ] Delete feature branch
- [ ] Update any tracking tickets/issues
- [ ] Celebrate! 🎉

---

## Completion Checklist 🏁

By the end of your first week, you should have:

- [ ] ✅ Development environment fully functional
- [ ] ✅ Can run application locally without issues
- [ ] ✅ Understand project architecture and key patterns
- [ ] ✅ Made at least one code change and tested it
- [ ] ✅ Created a pull request (or practiced the workflow)
- [ ] ✅ Know where to find documentation and help
- [ ] ✅ Comfortable contributing to the project

---

## Need Help? 🆘

- **Documentation:** Check [Resources](#resources) section in main guide
- **Team Chat:** [Slack/Discord link]
- **Tech Lead:** [Name and contact]
- **GitHub Issues:** [Repository issues link]

---

**Last Updated:** 2026-03-07
**Maintained By:** Development Team
```

---

## Implementation Steps

### Step 1: Create Main Guide (4-6 hours)

1. Copy the template above
2. Customize for your project:
   - Update team contacts
   - Add project-specific commands
   - Include real examples from codebase
   - Add screenshots if helpful
3. Save as `docs/DEVELOPER_ONBOARDING.md`

### Step 2: Create Checklist (1 hour)

1. Copy the checklist template
2. Adjust based on your project needs
3. Save as `docs/ONBOARDING_CHECKLIST.md`

### Step 3: Verify and Test (1 hour)

Walk through the guide as if you're a new developer:

1. **Follow Day 1 setup** step-by-step
2. **Verify all commands work**
3. **Check all links are valid**
4. **Test all code examples**
5. **Ensure clarity and completeness**

### Step 4: Update README (optional but recommended)

Add link to onboarding guide in README.md:

```markdown
## Getting Started

New developers? Start with our [Developer Onboarding Guide](docs/DEVELOPER_ONBOARDING.md) for a comprehensive walkthrough.

### Quick Start

[existing quick start section...]
```

---

## Verification Checklist

Before marking T-037 complete, verify:

- [ ] `docs/DEVELOPER_ONBOARDING.md` exists (800+ lines)
- [ ] `docs/ONBOARDING_CHECKLIST.md` exists
- [ ] All sections in main guide are complete
- [ ] All code examples are accurate
- [ ] All links work (test them!)
- [ ] Guide is testable by walking through
- [ ] New developer could follow independently
- [ ] Troubleshooting covers common issues
- [ ] README.md links to onboarding guide (optional)

---

**Total Estimated Time:** 1 day (8 hours)
**Difficulty:** Medium (requires good documentation skills)
**Dependencies:** None (all context from existing docs)
