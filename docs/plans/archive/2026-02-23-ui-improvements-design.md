# UI Improvements Design: Dark Mode + UK Plain Language

**Date:** 2026-02-23
**Status:** Approved
**Scope:** Comprehensive UI improvements including dark mode, accessibility, and content rewrite

---

## Overview

This design outlines improvements to the Laguna Hills HOA system's user interface focusing on:
1. Dark mode implementation
2. UK plain language standards compliance
3. WCAG AA accessibility compliance
4. Mobile optimization
5. Navigation efficiency
6. Visual design refresh

---

## 1. Dark Mode Foundation

### Implementation: next-themes Library

**Rationale:** next-themes handles flash-on-load prevention, system preference detection, SSR support, and localStorage persistence out of the box.

### Technical Approach

**Dependencies:**
- `next-themes` - Theme management

**Setup:**
```typescript
// src/main.tsx
import { ThemeProvider } from 'next-themes'

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <App />
</ThemeProvider>
```

**Theme Toggle Component:**
- Location: Top-right header, next to user menu
- Icon: Sun/moon toggle that reflects current theme
- Persistence: localStorage
- Options: Light, Dark, System

**Color Implementation:**
- Use Tailwind's `dark:` variants throughout
- Leverage existing shadcn/ui CSS variables in `src/index.css`
- Ensure all components use semantic color tokens

---

## 2. UK Plain Language Standards

### Scope: Complete Content Audit and Rewrite

### Principles

1. **Simple words** - Use everyday vocabulary
2. **Short sentences** - 15-20 words maximum
3. **Active voice** - "You can..." not "It may be possible to..."
4. **Front-load information** - Put important content first
5. **Clear structure** - Use headings, numbered steps
6. **UK conventions** - Spelling, date formats (DD/MM/YYYY)

### Content to Rewrite

- Button labels
- Form labels and help text
- Page headings and descriptions
- Error and success messages
- Navigation items
- Admin panel terminology
- API response messages

### Examples

| Current | Plain Language |
|---------|----------------|
| "Submit" | "Send" or "Continue" |
| "Please select..." | "Choose..." |
| "Authentication failed" | "We couldn't sign you in" |
| "Insufficient funds" | "You don't have enough money" |
| "Your request has been processed" | "We've received your request" |

---

## 3. WCAG Accessibility Compliance (AA Target)

### Color & Contrast

- Minimum 4.5:1 contrast ratio for text
- 3:1 for large text and UI components
- Validate both light and dark themes
- Color never the only indicator (add icons/labels)

### Keyboard Navigation

- All interactive elements keyboard-accessible
- Visible focus indicators (custom outline rings)
- Skip to main content link
- Logical tab order
- Escape key closes modals/dropdowns
- Arrow key navigation for menus, tabs, grids

### Screen Reader Support

- Proper ARIA labels on all interactive elements
- Semantic HTML (nav, main, section, article)
- Live regions for dynamic updates
- Alt text for all meaningful images
- Descriptive link text

### Forms

- Labels properly associated with inputs
- Error messages announced to screen readers
- Clear validation feedback
- Required field clearly indicated

### Text Resizing

- Layout works at 200% zoom
- Text reflows without horizontal scrolling

### Motion

- `prefers-reduced-motion` respected
- No auto-playing animations

---

## 4. Mobile Optimization

### Navigation

- Collapsible sidebar (hamburger menu)
- Bottom navigation bar for key actions
- Sticky header with theme toggle

### Layout

- Stack cards/forms vertically
- Touch targets minimum 44px
- Slide-over panels for details
- Pull-to-refresh on dashboard

### Map

- Full-screen toggle
- Touch-friendly lot selection
- Simplified popups

### Forms

- One field per screen for complex forms
- Auto-focus next field
- Show password toggle
- Camera option for file uploads

---

## 5. Navigation Efficiency

### Smart Shortcuts

- Quick action buttons on dashboard
- Breadcrumb navigation
- Recent items in sidebar
- Keyboard shortcuts (Ctrl+K for search, Ctrl+N for new)

### Bulk Operations (Admin)

- Checkbox selection on lists
- Bulk actions dropdown
- "Select all on this page"

### Search

- Global search (Cmd/Ctrl + K) for users, households, lots
- Filter presets on list pages

---

## 6. Visual Design Refresh

### Components

- Better cards with subtle shadows/hover states
- Improved badges with clear status
- Enhanced form controls with focus states
- Consistent spacing scale (4px base)

### Data Visualization

- Charts on dashboard (payment trends, status breakdowns)
- Progress bars for completion
- Visual status indicators

### Loading States

- Skeleton screens for all lists/tables
- Spinner for actions >500ms
- Optimistic updates for quick actions

### Empty States

- Friendly illustrations/messages
- Clear call-to-action when appropriate

### Toast Notifications

- Success, error, warning, info variants
- Auto-dismiss with progress bar
- Action buttons (Undo, Retry)

---

## 7. Implementation Architecture

### Dependencies

```json
{
  "next-themes": "^0.x",
  "sonner": "^1.x",      // Toast notifications
  "cmdk": "^1.x",        // Command palette
  "recharts": "^2.x"     // Charts
}
```

### File Structure

```
src/
  components/
    theme/
      theme-provider.tsx
      theme-toggle.tsx
    ui/                       // Update for:
      - Dark mode support
      - Better focus states
      - ARIA labels
      - Reduced motion
  lib/
    content/                  // NEW
      plain-language.ts       // Text constants
      labels.ts               // UI labels
      messages.ts             // Messages
  styles/
    accessibility.css         // NEW: Focus styles, skip links
```

### Implementation Order

1. Theme foundation (next-themes + toggle)
2. Accessibility audit + fixes (Axe DevTools)
3. Plain language content rewrite
4. Mobile layout improvements
5. Visual polish (loading states, toasts, charts)
6. Navigation enhancements (search, shortcuts)

### Testing

- **Accessibility:** Axe DevTools, keyboard-only, screen reader
- **Dark mode:** Visual regression, contrast validation
- **Mobile:** Device testing, responsive design
- **Plain language:** User testing, readability scores

---

## Success Criteria

- [ ] Dark mode toggle works and persists
- [ ] All text meets UK plain language standards
- [ ] WCAG AA compliance verified (Axe score 100)
- [ ] Mobile usability improved (touch targets, navigation)
- [ ] Page load times unchanged or improved
- [ ] No regressions in existing functionality
