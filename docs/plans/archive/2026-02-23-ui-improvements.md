# UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dark mode, UK plain language compliance, and WCAG AA accessibility to the Laguna Hills HOA system.

**Architecture:** Use next-themes for theme management, implement a content layer for plain language text constants, update all UI components for accessibility and dark mode, add visual polish with loading states and better notifications.

**Tech Stack:** next-themes, sonner (toasts), cmdk (command palette), recharts (charts), TypeScript, React, Tailwind CSS

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install required packages**

```bash
npm install next-themes sonner cmdk recharts
```

**Step 2: Verify installation**

Run: `grep -E "(next-themes|sonner|cmdk|recharts)" package.json`
Expected: All four packages listed in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add next-themes, sonner, cmdk, recharts"
```

---

## Task 2: Create Theme Provider

**Files:**
- Create: `src/components/theme/theme-provider.tsx`

**Step 1: Create theme provider component**

```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

**Step 2: Wrap app with provider**

Modify `src/main.tsx`:

```tsx
import { ThemeProvider } from "./components/theme/theme-provider"

// In the render function, wrap existing content:
<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
  <App />
</ThemeProvider>
```

**Step 3: Enable Tailwind dark mode**

Modify `tailwind.config.js`:

```js
export default {
  darkMode: ["class"],
  // ... rest of config
}
```

**Step 4: Commit**

```bash
git add src/components/theme/theme-provider.tsx src/main.tsx tailwind.config.js
git commit -m "feat: add theme provider with next-themes"
```

---

## Task 3: Create Theme Toggle Component

**Files:**
- Create: `src/components/theme/theme-toggle.tsx`
- Modify: `src/components/layout/Header.tsx` (or equivalent header component)

**Step 1: Create theme toggle component**

```tsx
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <button className="w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground">
        <span className="sr-only">Toggle theme</span>
      </button>
    )
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-9 h-9 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex items-center justify-center"
      aria-label="Toggle dark mode"
    >
      <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}
```

**Step 2: Add toggle to header**

Find the header component and add the toggle in the navigation area:

```tsx
import { ThemeToggle } from "../theme/theme-toggle"

// In the header return JSX, add near user menu:
<ThemeToggle />
```

**Step 3: Test theme switching**

Run: `npm run dev`
Manual test: Click the toggle button, verify theme switches between light and dark

**Step 4: Commit**

```bash
git add src/components/theme/theme-toggle.tsx src/components/layout/Header.tsx
git commit -m "feat: add theme toggle to header"
```

---

## Task 4: Update CSS Variables for Dark Mode

**Files:**
- Modify: `src/index.css`

**Step 1: Add dark mode color variables**

Ensure `src/index.css` has complete dark mode variables. Add if missing:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}
```

**Step 2: Verify contrast ratios**

Ensure all color combinations meet WCAG AA (4.5:1 for text)

**Step 3: Commit**

```bash
git add src/index.css
git commit -m "style: add complete dark mode CSS variables"
```

---

## Task 5: Create Content Layer for Plain Language

**Files:**
- Create: `src/lib/content/labels.ts`
- Create: `src/lib/content/messages.ts`

**Step 1: Create labels constants**

Create `src/lib/content/labels.ts`:

```ts
// Common UI labels using UK plain language standards
export const labels = {
  // Navigation
  dashboard: "Home",
  map: "Map",
  serviceRequests: "Report a problem",
  reservations: "Book a space",
  payments: "Payments",
  documents: "Documents",
  announcements: "News",
  polls: "Have your say",
  myLots: "My property",

  // Actions
  submit: "Send",
  cancel: "Cancel",
  save: "Save",
  delete: "Delete",
  edit: "Change",
  create: "Create new",
  search: "Search",
  filter: "Filter",
  export: "Download",
  import: "Upload",

  // Form labels
  email: "Email address",
  password: "Password",
  confirmPassword: "Confirm password",
  firstName: "First name",
  lastName: "Last name",
  address: "Address",
  phone: "Phone number",
  description: "Details",

  // Status
  pending: "Waiting",
  inProgress: "In progress",
  completed: "Done",
  rejected: "Not approved",
  approved: "Approved",

  // Admin
  adminPanel: "Admin panel",
  users: "People",
  households: "Households",
  lots: "Properties",
  settings: "Settings",
} as const

export type LabelKey = keyof typeof labels
```

**Step 2: Create messages constants**

Create `src/lib/content/messages.ts`:

```ts
// User-facing messages using UK plain language standards
export const messages = {
  // Auth
  loginSuccess: "Welcome back!",
  loginError: "We couldn't sign you in. Check your email and password.",
  logoutSuccess: "You've been signed out.",

  // Service requests
  requestSubmitted: "We've received your request. We'll look at it soon.",
  requestUpdated: "Request updated.",
  requestDeleted: "Request deleted.",

  // Payments
  paymentSubmitted: "Thanks! We've received your payment proof. We'll check it and let you know.",
  paymentApproved: "Payment confirmed!",
  paymentRejected: "We couldn't accept this payment. Please check the details and try again.",

  // Reservations
  reservationCreated: "Your space is booked!",
  reservationCancelled: "Booking cancelled.",

  // Errors
  somethingWentWrong: "Something went wrong. Please try again.",
  networkError: "Can't connect. Check your internet and try again.",
  notFound: "We couldn't find that.",
  unauthorized: "You need to sign in first.",

  // Success
  saved: "Saved!",
  deleted: "Deleted.",
  updated: "Updated.",

  // Loading
  loading: "Loading...",
  saving: "Saving...",
  sending: "Sending...",

  // Empty states
  noResults: "Nothing here yet.",
  noRequests: "No problems reported yet.",
  noPayments: "No payments yet.",
  noAnnouncements: "No news yet.",
} as const

export type MessageKey = keyof typeof messages
```

**Step 3: Create index file**

Create `src/lib/content/index.ts`:

```ts
export { labels, type LabelKey } from './labels'
export { messages, type MessageKey } from './messages'
```

**Step 4: Commit**

```bash
git add src/lib/content/
git commit -m "feat: add content layer for plain language labels and messages"
```

---

## Task 6: Add Accessibility Styles

**Files:**
- Create: `src/styles/accessibility.css`

**Step 1: Create accessibility stylesheet**

Create `src/styles/accessibility.css`:

```css
/* Skip to main content link */
.skip-to-main {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 999;
  padding: 1rem 2rem;
  background: var(--background);
  color: var(--foreground);
  text-decoration: none;
  border-radius: 0 0 0.5rem 0;
}

.skip-to-main:focus {
  left: 0;
}

/* Focus visible indicators */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Better focus for buttons */
button:focus-visible,
a:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  :root {
    --border: 214.3 31.8% 70%;
  }
  .dark {
    --border: 217.2 32.6% 40%;
  }
}

/* Ensure text can be resized up to 200% */
html {
  text-size-adjust: 100%;
}

/* Hide elements visually but keep available for screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

/* Focus order for dialogs */
dialog:focus {
  outline: none;
}
```

**Step 2: Import in main CSS**

Add to `src/index.css`:

```css
@import "./styles/accessibility.css";
```

**Step 3: Add skip link to app**

Modify `src/App.tsx` or root component:

```tsx
// At the very top, before everything else:
<a href="#main-content" className="skip-to-main">
  Skip to main content
</a>

<main id="main-content">
  {/* rest of app */}
</main>
```

**Step 4: Commit**

```bash
git add src/styles/accessibility.css src/index.css src/App.tsx
git commit -m "a11y: add accessibility styles and skip link"
```

---

## Task 7: Update Button Component for Accessibility

**Files:**
- Modify: `src/components/ui/button.tsx` (or equivalent)

**Step 1: Enhance button with ARIA and focus**

Ensure button component has:
- Proper type attribute (button vs submit)
- ARIA labels when text is not descriptive
- Loading state with aria-busy
- Disabled state with aria-disabled

**Step 2: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "a11y: improve button component accessibility"
```

---

## Task 8: Add Toast Notifications with Sonner

**Files:**
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/sonner.tsx`
- Modify: `src/main.tsx`

**Step 1: Create Toaster component**

Create `src/components/ui/sonner.tsx`:

```tsx
import { Toaster as Sonner } from "sonner"

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      expand={false}
      richColors
      closeButton
    />
  )
}
```

**Step 2: Add to main.tsx**

```tsx
import { Toaster } from "./components/ui/sonner"

// In ThemeProvider or at root:
<ThemeProvider>
  <App />
  <Toaster />
</ThemeProvider>
```

**Step 3: Create toast helper**

Create `src/lib/toast.ts`:

```tsx
import { toast } from "sonner"
import { messages } from "./content"

export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  warning: (message: string) => toast.warning(message),
  info: (message: string) => toast.info(message),

  // Pre-defined messages
  loginSuccess: () => toast.success(messages.loginSuccess),
  loginError: () => toast.error(messages.loginError),
  requestSubmitted: () => toast.success(messages.requestSubmitted),
  paymentSubmitted: () => toast.success(messages.paymentSubmitted),
  saved: () => toast.success(messages.saved),
}
```

**Step 4: Commit**

```bash
git add src/components/ui/sonner.tsx src/lib/toast.ts src/main.tsx
git commit -m "feat: add toast notifications with sonner"
```

---

## Task 9: Update Key Pages with Plain Language

**Files:**
- Modify: `src/pages/Login.tsx` (or equivalent)
- Modify: `src/pages/ServiceRequests.tsx`
- Modify: `src/pages/Payments.tsx`

**Step 1: Update Login page**

Replace labels and messages with plain language versions from content layer.

**Step 2: Update Service Requests page**

Use plain labels and clearer error messages.

**Step 3: Update Payments page**

Simplify payment flow labels and messages.

**Step 4: Commit**

```bash
git add src/pages/Login.tsx src/pages/ServiceRequests.tsx src/pages/Payments.tsx
git commit -m "content: update key pages with plain language"
```

---

## Task 10: Add Skeleton Loading Components

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Modify: List/table pages to use skeletons

**Step 1: Create skeleton component**

Create `src/components/ui/skeleton.tsx`:

```tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
```

**Step 2: Add skeleton patterns**

Create `src/components/skeletons/TableSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/skeletons/
git commit -m "feat: add skeleton loading components"
```

---

## Task 11: Mobile Navigation Improvements

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (or equivalent)
- Create: `src/components/layout/MobileNav.tsx`

**Step 1: Create mobile navigation**

Create responsive mobile navigation with hamburger menu.

**Step 2: Add bottom nav for key actions**

Create `src/components/layout/BottomNav.tsx` for mobile quick access.

**Step 3: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add mobile navigation improvements"
```

---

## Task 12: Add Charts to Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`
- Create: `src/components/charts/` directory

**Step 1: Create payment trends chart**

Create `src/components/charts/PaymentChart.tsx` using recharts.

**Step 2: Create service request status chart**

Create `src/components/charts/RequestStatusChart.tsx`.

**Step 3: Add to dashboard**

Integrate charts into dashboard page.

**Step 4: Commit**

```bash
git add src/pages/Dashboard.tsx src/components/charts/
git commit -m "feat: add charts to dashboard"
```

---

## Task 13: Global Search with Command Palette

**Files:**
- Create: `src/components/search/CommandPalette.tsx`

**Step 1: Create command palette**

Create `src/components/search/CommandPalette.tsx` using cmdk:

```tsx
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "cmdk"

// Implement search for users, households, lots
```

**Step 2: Add keyboard shortcut**

Add Cmd/Ctrl + K listener to trigger search.

**Step 3: Commit**

```bash
git add src/components/search/
git commit -m "feat: add global search command palette"
```

---

## Task 14: Accessibility Testing

**Files:**
- No file changes - testing task

**Step 1: Install Axe DevTools browser extension**

Add to `docs/testing.md`:

```markdown
## Accessibility Testing

1. Install [Axe DevTools](https://www.deque.com/axe/devtools/)
2. Run scan on all pages
3. Fix any issues found
4. Keyboard-only navigation test
5. Screen reader test (NVDA on Windows, VoiceOver on Mac)
```

**Step 5: Commit**

```bash
git add docs/testing.md
git commit -m "docs: add accessibility testing guide"
```

---

## Task 15: Final Testing and Documentation

**Files:**
- Modify: `README.md` or `docs/`
- Create: `CHANGELOG.md`

**Step 1: Update documentation**

Document new features in project README.

**Step 2: Create changelog**

Create `CHANGELOG.md` with all UI improvements.

**Step 3: Final commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: update documentation for UI improvements"
```

---

## Testing Checklist

- [ ] Dark mode toggle works and persists
- [ ] Dark mode colors have proper contrast
- [ ] All text uses plain language
- [ ] Keyboard navigation works on all interactive elements
- [ ] Screen reader announces all important content
- [ ] Focus indicators are visible
- [ ] Skip link works
- [ ] Forms have proper labels
- [ ] Error messages are descriptive
- [ ] Toast notifications display correctly
- [ ] Skeleton screens show during loading
- [ ] Mobile navigation works
- [ ] Charts render on dashboard
- [ ] Command palette search works
- [ ] No console errors
- [ ] Build succeeds: `npm run build`

---

## Success Criteria

- [ ] Dark mode fully functional
- [ ] WCAG AA compliance verified
- [ ] All content uses UK plain language
- [ ] Mobile experience improved
- [ ] No regressions in existing functionality
