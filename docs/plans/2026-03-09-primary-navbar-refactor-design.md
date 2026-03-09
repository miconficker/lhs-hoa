# Primary Navigation Refactor Design Document

**Date:** 2026-03-09
**Status:** Approved
**Author:** Claude (with user collaboration)

---

## Overview

This document describes the refactor of the primary navigation for the Laguna Hills HOA system. The current desktop Header component lacks navigation links, while mobile users have full navigation through MobileNav. This design adds proper desktop navigation and reorganizes both interfaces with logical groupings using dropdown menus.

---

## Current State

### Desktop (Header.tsx)
```
[Logo] [CommandPalette] [ThemeToggle] [NotificationBell] [user@email] [Logout]
```
**Problem:** No navigation links for desktop users

### Mobile (MobileNav.tsx + BottomNav.tsx)
- Full navigation available via Sheet menu and BottomNav
- All items listed flat (no grouping)

---

## Target Design

### Desktop Navigation (Header.tsx)

**Layout:**
```
[Logo] [Dashboard] [Map] [Community ▾] [Resources ▾] [Reservations] [Payments ▾] [Passes & IDs ▾] [Services ▾] [Command] [Theme] [Notif] [User] [Logout]
```

**Dropdown Groups:**

| Group | Items | Icon |
|-------|-------|------|
| Community | Announcements, Events, Polls | 📢 |
| Resources | Documents, Help | 📄 |
| Payments | My Payments, Make Payment | 💰 |
| Passes & IDs | Vehicle Passes, Employee IDs | 🚗 |
| Services | Service Requests, Common Areas | 🔧 |

**Single Items (no dropdown):**
- Dashboard, Map, Reservations, Account Settings

### Mobile Navigation (MobileNav.tsx)

**Restructured with Collapsible Groups:**

```
Menu
├── Dashboard
├── Map
├── Community (collapsible)
│   ├── Announcements
│   ├── Events
│   └── Polls
├── Resources (collapsible)
│   ├── Documents
│   └── Help
├── Reservations
├── Payments (collapsible)
│   ├── My Payments
│   └── Make Payment
├── Passes & IDs (collapsible)
│   ├── Vehicle Passes
│   └── Employee IDs
├── Services (collapsible)
│   ├── Service Requests
│   └── Common Areas
└── Account Settings
```

### BottomNav.tsx

**No changes** - Maintains quick access to: Dashboard, Map, Requests, Payments

---

## Component Specifications

### Header.tsx Changes

**New Imports:**
```typescript
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuSeparator,
} from "@/components/ui/navigation-menu"
import {
  ChevronDown,
  Home,
  Map,
  Calendar,
  CreditCard,
  FileText,
  Settings,
  Megaphone,
  Calendar as CalendarIcon,
  FileText as FileTextIcon,
  HelpCircle,
  BarChart3,
} from "lucide-react"
```

**Nav Items Structure:**
```typescript
interface NavItem {
  label: string;
  icon: any;
  to: string;
  roles: string[];
  children?: NavItem[];
}
```

**Desktop Navigation Component:**
- Horizontal menu between logo and right-side controls
- ChevronDown icon on items with children
- NavigationMenuTrigger for dropdowns
- Role-based filtering applies
- ARIA labels for accessibility

### MobileNav.tsx Changes

**Restructured navItems array with nested children:**
```typescript
const navItems: NavItem[] = [
  {
    to: "/dashboard",
    icon: Home,
    label: "Dashboard",
    roles: ["admin", "resident", "staff"],
  },
  {
    to: "/map",
    icon: Map,
    label: "Map",
    roles: ["admin", "resident", "staff"],
  },
  {
    label: "Community",
    icon: Megaphone,
    children: [
      { to: "/announcements", label: "Announcements", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/events", label: "Events", roles: ["admin", "resident", "staff", "guest"] },
      { to: "/polls", label: "Polls", roles: ["admin", "resident", "staff", "guest"] },
    ],
  },
  // ... other groups
]
```

**Mobile Implementation:**
- Use Collapsible components for each group
- ChevronRight/ChevronDown icons for expand/collapse
- Click group header to toggle
- Indented submenu items

---

## Accessibility (WCAG 2.1 AA)

### Desktop Navigation
- **Keyboard:** Arrow keys for dropdown navigation, Escape to close
- **Focus Management:** Focus trap in dropdowns
- **ARIA:** `role="menu"`, `aria-label`, `aria-expanded`
- **Screen Readers:** Hidden text labels for icons

### Mobile Navigation
- **Collapsible:** Proper ARIA attributes on Collapsible
- **Expand/Collapse:** Clear visual indicators (chevron icons)
- **Touch:** Minimum touch target size (44x44px)
- **Focus:** Focus states visible on all interactive elements

---

## Plain English Labels

| Old | New (if different) |
|-----|------------------|
| "Subdivision Map" | "Map" |
| "Amenity Reservations" | "Reservations" |
| "My Lots" | (moved to admin, not main nav) |

---

## Files to Modify

1. **src/components/layout/Header.tsx**
   - Add desktop navigation with dropdown menus
   - Import navigation components from shadcn/ui

2. **src/components/layout/MobileNav.tsx**
   - Restructure navItems with nested children
   - Add Collapsible components for dropdowns
   - Update item rendering for nested structure

3. **src/components/ui/navigation-menu.tsx** (if needed)
   - May need to add or update NavigationMenu component from shadcn/ui

---

## Migration Notes

- **Breaking Changes:** None - all existing routes preserved
- **Backward Compatibility:** All URLs remain valid
- **Role-Based Access:** Maintained via existing role filtering
- **Admin Routes:** Remain accessible via Admin Panel, not main navbar

---

**Document Version:** 1.0
**Last Updated:** 2026-03-09
