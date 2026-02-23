# Changelog

All notable changes to the Laguna Hills HOA Management System will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Dark mode with system preference detection and manual toggle in header
- UK plain language content layer for consistent user-friendly messaging across the application
- WCAG AA accessibility improvements including skip links, focus indicators, and ARIA labels
- Toast notifications using Sonner for user feedback and system alerts
- Skeleton loading components for better perceived performance during data loading
- Mobile navigation improvements with hamburger menu and bottom navigation bar
- Dashboard charts showing payment trends and request status distribution
- Global search command palette (Cmd/Ctrl + K) for quick navigation
- Recharts integration for data visualization
- Cmdk integration for command palette functionality

### Changed
- Updated all key pages (Login, Service Requests, Payments) with plain language content
- Enhanced button component with proper accessibility attributes (role, focus management)
- Improved mobile responsiveness across all layouts and components
- Updated header component to include theme toggle and search trigger
- Applied dark mode styles to all UI components using Tailwind CSS dark mode support

### Fixed
- Focus visibility for keyboard navigation across interactive elements
- Screen reader announcements for dynamic content changes
- Accessibility issues with form inputs and navigation elements
- Mobile navigation UX with proper hamburger menu and bottom tab bar

### Technical Details

#### New Dependencies
- `sonner` - Toast notification system
- `recharts` - Chart library for dashboard visualizations
- `cmdk` - Command palette component
- `next-themes` - Theme management for dark mode

#### New Components
- `src/components/ThemeProvider.tsx` - Theme provider with dark mode support
- `src/components/ThemeToggle.tsx` - Dark mode toggle button
- `src/components/ui/skeleton.tsx` - Skeleton loading components
- `src/components/ui/dialog.tsx` - Dialog component (shadcn/ui)
- `src/components/ui/command.tsx` - Command palette base
- `src/components/CommandPalette.tsx` - Global search command palette
- `src/components/MobileNav.tsx` - Mobile bottom navigation
- `src/components/HamburgerMenu.tsx` - Mobile hamburger menu
- `src/components/DashboardCharts.tsx` - Dashboard chart visualizations

#### Content Updates
- Created plain language versions of key user-facing text
- Updated Login, Service Requests, and Payments pages with clearer messaging
- Improved error messages and success notifications
- Enhanced form labels and helper text

#### Accessibility Improvements
- Added skip links for keyboard navigation
- Improved focus indicators on all interactive elements
- Added proper ARIA labels to buttons and inputs
- Ensured color contrast ratios meet WCAG AA standards
- Added live regions for screen reader announcements

## [Previous Releases]

### Initial Release
- Full-featured HOA management system
- Resident and admin dashboards
- Service request management
- Payment processing and tracking
- Interactive 2D map
- Amenity reservation system
- Document management
- User authentication and authorization
- Role-based access control
