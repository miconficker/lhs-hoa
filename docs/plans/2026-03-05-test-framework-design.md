# Test Framework Design Document
## Laguna Hills HOA Management System

**Date:** 2026-03-05
**Task:** T-020 - Setup Test Framework (Vitest + React Testing Library)
**Author:** Project Manager Agent
**Status:** Design Complete - Pending Implementation

---

## Executive Summary

This document outlines the design for implementing a comprehensive testing infrastructure for the Laguna Hills HOA Management System. The project currently has **0% test coverage** (Vitest 2.1.4 installed but unused), which is the highest priority technical debt item identified in the architecture audit.

**Goal:** Establish progressive testing infrastructure with reusable utilities, co-located tests, and factory fixtures, starting with critical business logic (authentication utilities, API client, payment calculations).

**Approach:** Incremental implementation over 8 weeks, targeting 50% coverage of critical paths.

---

## Design Decisions

### 1. Testing Approach

**Chosen Approach:** Progressive Testing Infrastructure

**Rationale:**
- Project has 20,000+ lines of code with zero tests
- Need reusable infrastructure to avoid repetition across hundreds of tests
- Balance structure and flexibility for long-term maintainability
- Industry-standard patterns (co-located tests, factory fixtures, custom render)

**Key Characteristics:**
- Co-located test files (`src/lib/utils.test.ts` alongside `src/lib/utils.ts`)
- Lightweight mocks for external dependencies
- Factory functions for test data
- Custom render with React providers
- Progressive coverage: start with auth, expand outward

---

## Architecture

### File Structure

```
tests/
├── setup/
│   ├── test-setup.ts         # Global test setup, jest-dom matchers
│   └── cleanup.ts            # Global cleanup hooks
├── mocks/
│   ├── jose.ts              # JWT library mocks (lightweight)
│   ├── bcryptjs.ts          # Password hashing mocks (lightweight)
│   └── api.ts               # API client mocks
├── fixtures/
│   ├── users.ts             # User factory functions
│   ├── households.ts        # Household factory
│   ├── payments.ts          # Payment factory
│   ├── service-requests.ts  # Service request factory
│   └── index.ts             # Export all fixtures
├── utils/
│   ├── render.tsx           # Custom render with providers
│   ├── mock-server.ts       # Mock API server setup
│   └── test-helpers.ts      # Common test utilities
└── __tests__/               # Co-located test files

src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts        # Example: Utility tests
├── hooks/
│   ├── useAuth.ts
│   └── useAuth.test.ts      # Example: Hook tests
├── components/
│   └── auth/
│       ├── ProtectedRoute.tsx
│       └── ProtectedRoute.test.tsx  # Example: Component tests
└── ...

functions/
├── lib/
│   ├── auth.ts
│   └── auth.test.ts         # Example: Backend utility tests
└── routes/
    ├── auth.ts
    └── auth.test.ts         # Example: API endpoint tests
```

---

## Core Components

### 2.1 Vitest Configuration

**File:** `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.config.{ts,js}',
        'src/main.tsx',
      ],
      thresholds: {
        statements: 30,  // Start low, increase over time
        branches: 30,
        functions: 30,
        lines: 30,
      },
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'functions/**/*.{test,spec}.{ts}'],
    mockReset: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Key Decisions:**
- `jsdom` environment for React components
- Coverage thresholds start at 30% (achievable, will increase)
- Co-located test files pattern
- Auto-restoring mocks between tests

---

### 2.2 Global Test Setup

**File:** `tests/setup/test-setup.ts`

```typescript
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (for dark mode tests)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
```

**Key Decisions:**
- Auto cleanup after each test (prevents memory leaks)
- jest-dom matchers for semantic assertions (`toBeVisible()`, `toHaveTextContent()`)
- Mock `matchMedia` for theme testing

---

### 2.3 Dependencies

**Install Command:**
```bash
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/ui
```

**Package Purposes:**
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers for DOM assertions
- `@testing-library/user-event` - Simulate user interactions (click, type, etc.)
- `jsdom` - DOM implementation for Node.js (required for React Testing Library)
- `@vitest/ui` - Visual test runner and debugger

---

## Mocking Strategy

### 3.1 Lightweight Mocks for External Dependencies

**Principle:** Mock only external dependencies, test real application logic.

#### jose (JWT Library) Mock

**File:** `tests/mocks/jose.ts`

```typescript
import { vi } from 'vitest';

export const mockSign = vi.fn();
export const mockVerify = vi.fn();

vi.mock('jose', () => ({
  SignJWT: class {
    constructor(payload: any) {
      return payload;
    }
    setProtectedHeader() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return mockSign();
    }
  },
  jwtVerify: mockVerify,
}));
```

#### bcryptjs Mock

**File:** `tests/mocks/bcryptjs.ts`

```typescript
import { vi } from 'vitest';

export const mockHash = vi.fn();
export const mockCompare = vi.fn();

vi.mock('bcryptjs', () => ({
  hash: mockHash,
  compare: mockCompare,
  default: {
    hash: mockHash,
    compare: mockCompare,
  },
}));
```

---

### 3.2 Factory Functions for Test Data

**Principle:** Create reusable test data builders to avoid repetition in tests.

#### User Factory

**File:** `tests/fixtures/users.ts`

```typescript
export interface UserOverrides {
  id?: string;
  email?: string;
  role?: 'admin' | 'resident' | 'staff' | 'guest';
  first_name?: string;
  last_name?: string;
}

export const buildUser = (overrides: UserOverrides = {}) => {
  return {
    id: 'user-123',
    email: 'test@example.com',
    role: 'resident' as const,
    first_name: 'John',
    last_name: 'Doe',
    created_at: new Date().toISOString(),
    ...overrides,
  };
};

export const buildAdmin = (overrides: UserOverrides = {}) => {
  return buildUser({ role: 'admin', ...overrides });
};
```

#### Payment Factory

**File:** `tests/fixtures/payments.ts`

```typescript
export interface PaymentOverrides {
  id?: string;
  household_id?: string;
  amount?: number;
  status?: 'pending' | 'completed' | 'failed';
  period?: string;
}

export const buildPayment = (overrides: PaymentOverrides = {}) => {
  return {
    id: 'payment-123',
    household_id: 'household-123',
    amount: 1500,
    currency: 'PHP',
    method: 'gcash',
    status: 'pending' as const,
    period: '2026-03',
    created_at: new Date().toISOString(),
    ...overrides,
  };
};
```

---

## Test Utilities

### 4.1 Custom Render with Providers

**File:** `tests/utils/render.tsx`

```typescript
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster } from '@/components/ui/toaster';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
}

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

export function renderWithProviders(
  ui: ReactElement,
  options: CustomRenderOptions = {}
) {
  const {
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="light">
            {children}
            <Toaster />
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  };

  return {
    ...render(ui, { wrapper: AllTheProviders, ...renderOptions }),
    queryClient,
  };
}

// Re-export everything from RTL
export * from '@testing-library/react';
```

---

### 4.2 Mock API Server

**File:** `tests/utils/mock-server.ts`

```typescript
import { vi } from 'vitest';

export const mockApiCall = vi.fn();

export function setupMockApi() {
  // Mock successful response
  mockApiCall.mockResolvedValue({
    data: { success: true },
    error: null,
  });

  return { mockApiCall };
}

export function mockApiError(message: string) {
  mockApiCall.mockResolvedValue({
    data: null,
    error: message,
  });
}

export function resetMockApi() {
  mockApiCall.mockReset();
}
```

---

### 4.3 Test Helpers

**File:** `tests/utils/test-helpers.ts`

```typescript
export const waitForLoadingToFinish = () =>
  waitFor(() => {
    const loaders = document.querySelectorAll('[data-loading="true"]');
    expect(loaders).toHaveLength(0);
  });

export const mockAuthState = (user: any, token: string) => {
  localStorage.setItem('hoa_user', JSON.stringify(user));
  localStorage.setItem('hoa_token', token);
};

export const clearAuthState = () => {
  localStorage.removeItem('hoa_user');
  localStorage.removeItem('hoa_token');
};

export const createMockToken = (userId: string, role: string) => {
  return `mock-token-${userId}-${role}`;
};
```

---

## Example Tests

### 5.1 Utility Function Tests

**File:** `src/lib/utils.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn()', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges Tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2'); // Last one wins
  });
});
```

---

### 5.2 Authentication Utility Tests

**File:** `functions/lib/auth.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, comparePassword, generateToken } from './auth';
import * as bcrypt from 'bcryptjs';

vi.mock('bcryptjs');

describe('hashPassword()', () => {
  it('should hash password with bcrypt', async () => {
    vi.mocked(bcrypt.hash).mockResolvedValue('$hashed$');

    const result = await hashPassword('password123');

    expect(result).toBe('$hashed$');
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
  });
});

describe('comparePassword()', () => {
  it('should compare password correctly', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    const result = await comparePassword('password123', '$hashed$');

    expect(result).toBe(true);
    expect(bcrypt.compare).toHaveBeenCalledWith('password123', '$hashed$');
  });
});

describe('generateToken()', () => {
  it('should generate JWT with user info', async () => {
    const payload = { userId: 'user-123', role: 'admin' };

    const token = await generateToken(payload);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });
});
```

---

### 5.3 Component Tests

**File:** `src/components/auth/ProtectedRoute.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@/tests/utils/render';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '@/hooks/useAuth';

vi.mock('@/hooks/useAuth');

describe('ProtectedRoute', () => {
  it('redirects to login when not authenticated', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      token: null,
      initialized: true,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(window.location.pathname).toBe('/login');
    });
  });

  it('renders children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-123', email: 'test@test.com', role: 'resident' },
      token: 'mock-token',
      initialized: true,
    });

    renderWithProviders(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
```

---

## Implementation Roadmap

### Phase 1: Infrastructure Setup (Week 1)

**Tasks:**
1. Configure Vitest with jsdom environment
2. Add testing dependencies (@testing-library/react, jest-dom, etc.)
3. Create test utilities and helpers
4. Create factory fixtures for test data
5. Write global test setup

**Deliverables:**
- ✅ `vitest.config.ts` updated
- ✅ `tests/setup/test-setup.ts`
- ✅ `tests/utils/` with render, mock-server, test-helpers
- ✅ `tests/fixtures/` with user, household, payment factories
- ✅ `tests/mocks/` with jose, bcryptjs mocks

---

### Phase 2: Critical Path Coverage (Week 2-3)

**Target:** 30% coverage of business logic

**Tests to Write:**

#### Utilities (Priority: HIGH)
```bash
src/lib/utils.test.ts              # cn() function
src/lib/logger.test.ts             # Logger utilities
src/lib/paymentExport.test.ts      # Payment calculations, CSV export
```

#### Auth Utilities (Priority: HIGH)
```bash
functions/lib/auth.test.ts         # JWT, password hashing, OAuth
src/hooks/useAuth.test.ts          # Auth store (Zustand)
```

#### Payment Logic (Priority: HIGH)
```bash
src/lib/paymentExport.test.ts      # Late fee calculations
functions/routes/payments.test.ts  # Payment CRUD operations
```

**Deliverables:**
- ✅ 10-15 unit tests for utilities
- ✅ 5-8 tests for authentication functions
- ✅ Coverage report shows 30%+ coverage

---

### Phase 3: Component Testing (Week 4-5)

**Target:** 40% coverage of UI components

**Tests to Write:**

#### Auth Components
```bash
src/components/auth/ProtectedRoute.test.tsx
src/pages/LoginPage.test.tsx
```

#### UI Components
```bash
src/components/ui/Button.test.tsx
src/components/ui/Card.test.tsx
src/components/ui/Input.test.tsx
```

#### Page Components
```bash
src/pages/DashboardPage.test.tsx
src/pages/PaymentsPage.test.tsx
src/pages/ServiceRequestsPage.test.tsx
```

**Deliverables:**
- ✅ 20+ component tests
- ✅ Coverage report shows 40%+ coverage
- ✅ All critical user flows covered

---

### Phase 4: API Integration Tests (Week 6-7)

**Target:** 50% coverage of API endpoints

**Tests to Write:**

#### Authentication Endpoints
```bash
functions/routes/auth.test.ts      # Login, register, OAuth
```

#### Payment Endpoints
```bash
functions/routes/payments.test.ts  # CRUD, verification
```

#### Service Request Endpoints
```bash
functions/routes/service-requests.test.ts
```

**Deliverables:**
- ✅ 15+ API endpoint tests
- ✅ Mock D1 database for integration tests
- ✅ Coverage report shows 50%+ coverage

---

### Phase 5: E2E Testing (Week 8)

**Target:** Critical user flows

**Tests to Write (Playwright):**
```bash
tests/e2e/auth.spec.ts              # Login flow
tests/e2e/payments.spec.ts          # Payment flow
tests/e2e/service-requests.spec.ts  # CRUD flow
```

**Deliverables:**
- ✅ 5-10 E2E tests
- ✅ Cross-browser testing (Chrome, Firefox)
- ✅ CI integration

---

## Scripts & Workflow

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

**Usage:**
```bash
npm test              # Watch mode during development
npm run test:run      # Run tests once (CI)
npm run test:coverage # Generate coverage report
npm run test:ui       # Visual test runner
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run TypeScript check
        run: tsc --noEmit

      - name: Run tests
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

---

## Success Criteria

### Week 1 Milestone
- ✅ Vitest configured and passing
- ✅ Test infrastructure in place
- ✅ 5+ example tests written
- ✅ Coverage report generated (showing ~5%)

### Week 2-3 Milestone
- ✅ 30% code coverage achieved
- ✅ All critical utilities tested
- ✅ Authentication logic fully tested
- ✅ Payment calculations tested

### Week 4-5 Milestone
- ✅ 40% code coverage achieved
- ✅ Major components tested
- ✅ Auth flow component tests passing

### Week 6-7 Milestone
- ✅ 50% code coverage achieved
- ✅ API endpoints tested
- ✅ Integration tests passing

### Week 8 Milestone
- ✅ E2E tests for critical flows
- ✅ CI/CD integration complete
- ✅ Cross-browser testing passing

---

## Risks & Mitigations

### Risk 1: Test Suite Slowdown
**Mitigation:** Use `vi.mock()` for external deps, parallel test execution, selective test running during development

### Risk 2: Flaky Tests
**Mitigation:** Proper cleanup in `afterEach()`, avoid hardcoded timeouts, use `waitFor()` for async operations

### Risk 3: Maintenance Burden
**Mitigation:** Co-located tests, factory fixtures for test data, reusable test utilities

### Risk 4: Low Adoption
**Mitigation:** Document testing patterns, provide example tests, integrate with CI to enforce test requirements

---

## Next Steps

1. **Review and approve this design document** ✅ (in progress)
2. **Invoke writing-plans skill** to create detailed implementation plan
3. **Begin Phase 1 implementation** (infrastructure setup)
4. **Track progress** in todo.md with task breakdowns

---

## Appendix: Testing Best Practices

### DO ✅
- Test user behavior, not implementation details
- Use semantic assertions (`toHaveTextContent()` instead of `innerHTML ===`)
- Mock external dependencies only
- Keep tests focused and isolated
- Use descriptive test names
- One assertion per test (when possible)

### DON'T ❌
- Test internal implementation details
- Over-mock (test real logic when possible)
- Test third-party libraries
- Write brittle tests with hardcoded selectors
- Test too many things in one test
- Use `any` type in tests

---

**Document Status:** Design Complete - Ready for Implementation Planning

**Next Action:** Invoke `superpowers:writing-plans` skill to create detailed implementation plan with task breakdowns and checkpoints.
