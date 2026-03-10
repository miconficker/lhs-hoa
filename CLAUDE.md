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

- **Household access control**: Users belong to households via `households.owner_user_id` OR `residents.user_id`. Use helper pattern:
  ```sql
  -- Check owner
  SELECT id FROM households WHERE id = ? AND owner_user_id = ?
  -- Check resident
  SELECT id FROM residents WHERE household_id = ? AND user_id = ?
  ```

- **Common areas**: HOA-owned lots use `owner_user_id = 'developer-owner'` with `lot_type IN ('community', 'utility', 'open_space')`. These don't pay dues or vote.

- **SQL injection safety**: Queries using `.bind()` parameterization are safe. String interpolation in queries is the red flag.

- **Late fee configuration**: Fully configurable via UI at Admin Panel → Payments → Settings (see `LateFeeConfig.tsx`)

## Development Standards

### Process Safety Rules

You run in a resource-constrained environment. The following are **strictly forbidden**:

- **No Docker**: `docker build`, `docker run`, `docker compose up`, `docker pull/push/exec`, `podman build/run`. You MAY write Dockerfiles and compose configs.
- **No servers**: `npm run dev`, `npm start`, `next dev`, `vite`, `flask run`, `uvicorn`, `rails server`, `nodemon`, or any process that listens on a port.

**Instead**: Write code and config files. Run only targeted tests (single file). Use lightweight commands (lint, type-check single files). If you need a build or server, message the user.

### Architecture Compliance

If an `ARCHITECTURE.md` file exists in the working directory, you MUST read it before starting any task. It is the source of truth for:

- Project structure and module boundaries
- Component organization patterns
- Data models and API contracts
- Technical decisions and trade-offs

**Rules**:
- Follow the architecture; do not contradict documented decisions
- Check before creating new files/directories - verify placement
- Flag conflicts: if a task conflicts with ARCHITECTURE.md, do not proceed silently
- Keep it updated: if architecture changes, update ARCHITECTURE.md

### Pre-Completion Verification

Before marking any task complete or claiming code works:

1. **Dependencies**: If `package.json` changed, run `npm install` (or project's package manager)
2. **Lint**: Run the project's linter and fix all errors/warnings (`npm run lint`)
3. **Type-check**: Run TypeScript type checking if applicable (`rtk tsc`)
4. **Build**: Run `npm run build` to verify no compilation errors
5. **Test**: Run targeted tests for modified code

Only after all checks pass should you consider work complete.

### Code Review Standards

When reviewing code or creating PRs, check:

- **Correctness**: Logic errors, off-by-one errors, edge cases, proper error handling
- **Security**: Injection attacks (SQL, XSS), auth/authz issues, data exposure, insecure defaults
- **Performance**: N+1 queries, unnecessary re-renders, memory leaks, inefficient algorithms, missing indexes
- **Standards**: Naming conventions, file organization, coding standards, architectural compliance

Provide specific, constructive feedback with code examples. Distinguish blocking issues from suggestions.

### Accessibility Standards

All UI components must meet WCAG accessibility standards:

- Proper ARIA attributes for interactive elements
- Keyboard navigation support for all interactions
- Screen reader compatibility with semantic HTML
- Sufficient color contrast and visual clarity
- Focus management and visible focus indicators

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

<!-- rtk-instructions v2 -->
# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:
```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)
```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)
```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)
```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)
```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)
```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)
```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)
```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)
```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)
```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands
```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category | Commands | Typical Savings |
|----------|----------|-----------------|
| Tests | vitest, playwright, cargo test | 90-99% |
| Build | next, tsc, lint, prettier | 70-87% |
| Git | status, log, diff, add, commit | 59-80% |
| GitHub | gh pr, gh run, gh issue | 26-87% |
| Package Managers | pnpm, npm, npx | 70-90% |
| Files | ls, read, grep, find | 60-75% |
| Infrastructure | docker, kubectl | 85% |
| Network | curl, wget | 65-70% |

Overall average: **60-90% token reduction** on common development operations.
<!-- /rtk-instructions -->