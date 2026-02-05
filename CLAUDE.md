# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Laguna Hills Homeowners Association (HOA) Information and Service Management System** - a web-based platform for managing HOA operations, resident services, and community engagement with integrated 2D mapping.

**Status**: Implementation complete - system is functional and running.

## Project Objectives

From the concept paper, the system aims to:

1. **Centralize resident and household records** - Manage homeowner information and household data
2. **Streamline service requests** - Online submission, tracking, and updating of maintenance requests
3. **2D Mapping integration** - Visual representation of subdivision layout with house locations and resident distribution
4. **Communication hub** - Announcements, events, community calendar, and polling
5. **Document management** - HOA rules, regulations, forms, and important documents
6. **Online payments** - Settlement of dues and fees through user accounts
7. **Amenity reservations** - Automated booking system for common areas

## Key Features to Implement

- Resident/user authentication and authorization
- Dashboard for HOA officers and residents
- Maintenance/service request tracking system
- 2D interactive map of the subdivision
- Community calendar and announcements
- Document repository
- Online payment integration
- Polling/voting system
- Amenity reservation system
- Mobile-responsive design

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript + Tailwind CSS + React Router v6
- **Backend**: Cloudflare Workers + Hono framework
- **Database**: D1 (SQLite) for data persistence, R2 for file storage
- **Mapping**: Leaflet + React Leaflet for 2D maps
- **Authentication**: JWT-based auth with jose library (Cloudflare Workers compatible)
- **State Management**: Zustand
- **UI Components**: shadcn/ui + Lucide icons (migrated from Heroicons)
- **Icons**: Use `lucide-react` for all new icon work. Heroicons has been removed.

## Development Setup

### Running the Application

```bash
# Run both frontend and backend together
npm run dev:all
# or
./dev.sh
```

- **Git worktrees**: Use `.worktrees/` directory for feature branch isolation (already gitignored).
  ```bash
  git worktree add .worktrees/feature-name -b feature/feature-name
  ```

### Database Migrations

```bash
# Run D1 migrations (local)
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local
```

### Test Users

- Admin: `admin@lagunahills.com` / `admin123`
- Resident: `resident@lagunahills.com` / `resident123`

## UI Components (shadcn/ui)

- **Location**: `src/components/ui/`
- **Utils**: `src/lib/utils.ts` exports `cn()` for className merging (clsx + tailwind-merge)
- **Available**: Button, Card, Badge, Input, Label, RadioGroup, Select, Dialog, Tabs
- **Theming**: CSS variables in `src/index.css` under `:root` for colors, radius, etc.

## Important Gotchas

- **API endpoints in `src/lib/api.ts`**: Do NOT include `/api` prefix in endpoint paths. `API_BASE = "/api"` is already prepended.
  - ❌ `/api/auth/login` → becomes `/api/api/auth/login` (404)
  - ✅ `/auth/login` → becomes `/api/auth/login` (correct)

- **Cloudflare Workers JWT**: Use `jose` library, NOT `jsonwebtoken`. The latter requires Node.js crypto which isn't available in Workers.

- **wrangler.jsonc**: Project uses JSONC format with `nodejs_compat` flag, not TOML.

- **Debug page**: Visit `/debug` to see auth state and localStorage for troubleshooting.

- **Missing vite-env.d.ts**: If TypeScript errors about `import.meta.env` occur, ensure `src/vite-env.d.ts` exists with `interface ImportMetaEnv`.

- **Linter auto-formatting**: Prettier converts single quotes to double quotes on save. Expect formatting-only diffs.

## Documents in Repository

- `Concept-Paper_2.2(2).docx` - Full project concept and requirements
- `HOA Website Requirements.xlsx` - Detailed feature requirements

## Lot Annotation Tool

The project includes a visual tool for annotating SVG map lots with lot numbers.

- **Access**: `/annotate` route (admin-only)
- **Usage**: Click lots on map, enter lot/block numbers, export mapping JSON
- **Storage**: `scripts/lot-mapping.json` + localStorage persistence
- **Conversion**: Run `node scripts/svg-to-geojson.ts --mapping scripts/lot-mapping.json` to apply annotations to GeoJSON

## Testing & Verification

- **No test suite**: Project has 0 tests configured. Verify via: `npm run build` for TypeScript errors, manual testing via `npm run dev:all`.
- **Worktree cleanup**: After merging, use `git worktree remove --force .worktrees/name` then `git branch -d feature/name`.
