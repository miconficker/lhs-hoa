# Laguna Hills HOA Management System

A comprehensive web-based platform for managing Laguna Hills Homeowners Association operations, resident services, and community engagement with integrated 2D mapping.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-functional-green.svg)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development Guide](#development-guide)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Overview

The Laguna Hills HOA Management System is a full-stack web application designed to streamline HOA operations, centralize resident records, and facilitate community communication. The system provides administrators with tools to manage properties, payments, and services while giving residents convenient access to information and services.

### Key Objectives

1. **Centralize resident and household records** - Manage homeowner information and household data
2. **Streamline service requests** - Online submission, tracking, and updating of maintenance requests
3. **2D Mapping integration** - Visual representation of subdivision layout with house locations and resident distribution
4. **Communication hub** - Announcements, events, community calendar, and polling
5. **Document management** - HOA rules, regulations, forms, and important documents
6. **Online payments** - Settlement of dues and fees through user accounts
7. **Amenity reservations** - Automated booking system for common areas

## Features

### For Residents

- **Dashboard** - Personalized overview of account status, announcements, and quick actions
- **Interactive Map** - View subdivision layout with lot ownership information
- **Service Requests** - Submit and track maintenance requests
- **Amenity Reservations** - Book clubhouse, pool, and basketball court
- **Payment Portal** - View dues and make online payments
- **Document Center** - Access HOA documents, forms, and policies
- **Announcements & Events** - Stay updated with community news
- **Polls & Voting** - Participate in community decisions
- **Pass Management** - Manage employee IDs and vehicle registrations

### For Administrators

- **Admin Dashboard** - Overview of all system activities
- **Lot Management** - Manage property records and ownership
- **Dues Configuration** - Set and update dues for different lot types
- **Payment Recording** - Record in-person payments
- **Common Areas** - Manage shared amenities
- **Pass Management** - Approve employee and vehicle passes
- **User Management** - Manage resident accounts and permissions
- **Notification System** - Send announcements and alerts

### Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **Admin** | Full system access, all management features |
| **Resident** | Access to own lots, payments, reservations, services |
| **Staff** | Service requests, notifications, basic operations |
| **Guest** | Limited access to announcements and events |

## Tech Stack

### Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router v6
- **State Management**: Zustand
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Mapping**: Leaflet + React Leaflet
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: TanStack Query (React Query)

### Backend

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: D1 (SQLite-compatible)
- **File Storage**: R2 bucket
- **Authentication**: JWT (jose library)

### Development Tools

- **Language**: TypeScript 5
- **Linting**: ESLint 9
- **Formatting**: Prettier 3
- **Testing**: Vitest 2

## Project Structure

```
lhs-hoa/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   │   ├── auth/                # Authentication components
│   │   ├── layout/              # Layout components (Header, Sidebar, etc.)
│   │   └── ui/                  # shadcn/ui components
│   ├── hooks/                   # Custom React hooks
│   │   └── useAuth.ts           # Zustand auth store
│   ├── lib/                     # Utility libraries
│   │   ├── api.ts               # API client
│   │   └── utils.ts             # Helper functions
│   ├── pages/                   # Page components
│   │   ├── AdminPanelPage.tsx   # Admin dashboard
│   │   ├── AdminLotsPage.tsx    # Lot management
│   │   ├── MapPage.tsx          # Interactive map
│   │   ├── LoginPage.tsx        # Login page
│   │   └── ...                  # Other pages
│   ├── types/                   # TypeScript type definitions
│   ├── App.tsx                  # Main app with routing
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
│
├── worker/                       # Backend (Cloudflare Workers)
│   └── src/
│       ├── index.ts             # Worker entry point
│       ├── lib/
│       │   └── auth.ts          # JWT & auth utilities
│       └── routes/              # API route handlers
│           ├── admin.ts
│           ├── auth.ts
│           ├── service-requests.ts
│           └── ...              # Other routes
│
├── migrations/                   # Database migrations
│   ├── 0001_schema.sql          # Initial schema
│   ├── 0002_add_lot_ownership.sql
│   └── ...                      # Other migrations
│
├── scripts/                      # Utility scripts
│   ├── seed-users.ts            # User seeding
│   └── sync-lots-to-db.ts       # Map data sync
│
├── public/                       # Static assets
├── package.json                  # Frontend dependencies
├── wrangler.jsonc                # Cloudflare Workers config
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind CSS config
└── dev.sh                       # Development launcher
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Git
- Cloudflare account (for deployment)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/miconficker/lhs-hoa.git
cd lhs-hoa
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up Cloudflare Workers**

Create a `wrangler.jsonc` file based on the template:

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
      "database_id": "YOUR_D1_DATABASE_ID"
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

4. **Set up the database**

```bash
# Create D1 database
npx wrangler d1 create laguna_hills_hoa

# Run migrations (local)
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0002_add_lot_ownership.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0003_lot_type_dues_demands.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0004_notifications.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0005_user_names.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0006_household_grouping.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0007_lot_types_labels.sql --local
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0008_pass_management.sql --local
```

5. **Seed initial users**

```bash
npx tsx scripts/seed-users.ts
```

### Running the Application

Start both frontend and backend:

```bash
npm run dev:all
# or
./dev.sh
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8787

### Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@lagunahills.com | admin123 |
| Resident | resident@test.com | resident123 |

## Development Guide

### Git Workflow

The project uses git worktrees for feature branch isolation:

```bash
# Create a new feature branch with worktree
git worktree add .worktrees/feature-name -b feature/feature-name

# Work in the isolated directory
cd .worktrees/feature-name

# After merging, clean up
git worktree remove --force .worktrees/feature-name
git branch -d feature/feature-name
```

### Code Style

- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)
- **Type Checking**: TypeScript (run `npm run build`)

### Component Development

When creating new components:

1. Use shadcn/ui components as base
2. Follow existing patterns in `src/pages/`
3. Use TypeScript for type safety
4. Apply consistent styling via CSS variables

### API Client

All API calls go through `src/lib/api.ts`:

```typescript
import api from '@/lib/api';

// GET request
const data = await api.get('/endpoint');

// POST request
const result = await api.post('/endpoint', { data });

// PUT request
await api.put('/endpoint/:id', { data });

// DELETE request
await api.delete('/endpoint/:id');
```

**Important**: Do NOT include `/api` prefix in endpoint paths - it's automatically prepended.

### Authentication

Use the Zustand store for auth state:

```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, login, logout, isAuthenticated } = useAuth();
```

Protected routes use the `ProtectedRoute` component with role checks:

```tsx
<ProtectedRoute allowedRoles={['admin', 'staff']}>
  <AdminOnlyPage />
</ProtectedRoute>
```

## API Documentation

### Base URL

- **Local**: `http://localhost:8787/api`
- **Production**: `https://your-worker.workers.dev/api`

### Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Endpoints

#### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |

**Login Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Login Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "role": "resident"
  }
}
```

#### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Dashboard statistics |

#### Service Requests

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/service-requests` | List all requests |
| POST | `/service-requests` | Create new request |
| PUT | `/service-requests/:id` | Update request |
| DELETE | `/service-requests/:id` | Delete request |

#### Reservations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/reservations` | List reservations |
| POST | `/reservations` | Create reservation |
| PUT | `/reservations/:id` | Update reservation |
| DELETE | `/reservations/:id` | Cancel reservation |

#### Payments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments` | List payments |
| POST | `/payments` | Create payment |
| GET | `/households/:id/payments` | Household payment history |

#### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents` | List documents |
| POST | `/documents` | Upload document |
| DELETE | `/documents/:id` | Delete document |

#### Announcements

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/announcements` | List announcements |
| POST | `/announcements` | Create announcement (admin only) |
| PUT | `/announcements/:id` | Update announcement |
| DELETE | `/announcements/:id` | Delete announcement |

#### Events

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | List events |
| POST | `/events` | Create event (admin only) |
| PUT | `/events/:id` | Update event |
| DELETE | `/events/:id` | Delete event |

#### Polls

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/polls` | List polls |
| POST | `/polls` | Create poll (admin only) |
| POST | `/polls/:id/vote` | Submit vote |

#### Map Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/data/lots.geojson` | Live map data with ownership |

#### Pass Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pass-requests/employees` | List employee passes |
| POST | `/pass-requests/employees` | Create employee pass |
| PUT | `/pass-requests/employees/:id` | Update employee pass |
| DELETE | `/pass-requests/employees/:id` | Delete employee pass |
| GET | `/pass-requests/vehicles` | List vehicle passes |
| POST | `/pass-requests/vehicles` | Create vehicle pass |
| PUT | `/pass-requests/vehicles/:id` | Update vehicle pass |
| DELETE | `/pass-requests/vehicles/:id` | Delete vehicle pass |

#### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Admin dashboard stats |
| GET | `/admin/notifications` | Send notifications |
| POST | `/admin/notifications` | Send notifications |
| GET | `/admin/lots` | Manage lots |
| PUT | `/admin/lots/:id` | Update lot |

#### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | List user notifications |
| PUT | `/notifications/:id/read` | Mark as read |

## Database Schema

### Core Tables

#### users
User accounts and authentication.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| email | TEXT | Unique email address |
| password_hash | TEXT | Bcrypt hashed password |
| role | TEXT | admin, resident, staff, guest |
| phone | TEXT | Phone number |
| created_at | DATETIME | Account creation date |

#### households
Property and household information.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| address | TEXT | Property address |
| block | TEXT | Block number |
| lot | TEXT | Lot number |
| latitude | REAL | GPS latitude |
| longitude | REAL | GPS longitude |
| map_marker_x | REAL | Map X coordinate |
| map_marker_y | REAL | Map Y coordinate |
| owner_id | TEXT | Foreign key to users |
| status | TEXT | built, vacant, under_construction |
| lot_type | TEXT | Residential, resort, commercial, etc. |
| dues_demand | REAL | Monthly dues amount |
| household_group_id | TEXT | For merged lots |

#### residents
Household resident information.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| user_id | TEXT | Foreign key to users |
| first_name | TEXT | First name |
| last_name | TEXT | Last name |
| is_primary | BOOLEAN | Primary resident flag |
| created_at | DATETIME | Record creation date |

#### service_requests
Maintenance and service requests.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| category | TEXT | Request category |
| description | TEXT | Request details |
| status | TEXT | pending, in-progress, completed, rejected |
| priority | TEXT | low, normal, high, urgent |
| assigned_to | TEXT | Assigned user ID |
| created_at | DATETIME | Request date |
| updated_at | DATETIME | Last update |
| completed_at | DATETIME | Completion date |

#### reservations
Amenity booking records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| amenity_type | TEXT | clubhouse, pool, basketball-court |
| date | DATE | Reservation date |
| slot | TEXT | AM or PM |
| status | TEXT | pending, confirmed, cancelled |
| purpose | TEXT | Reservation purpose |
| created_at | DATETIME | Booking date |

#### payments
Payment records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| amount | REAL | Payment amount |
| currency | TEXT | PHP (default) |
| method | TEXT | gcash, paymaya, instapay, cash |
| status | TEXT | pending, completed, failed |
| reference_number | TEXT | Payment reference |
| period | TEXT | Payment period (YYYY-MM) |
| created_at | DATETIME | Payment date |
| paid_at | DATETIME | Confirmation date |

#### household_employees
Employee ID card records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| name | TEXT | Employee name |
| position | TEXT | Job position |
| photo_url | TEXT | R2 photo URL |
| status | TEXT | pending, approved, rejected |
| created_at | DATETIME | Request date |

#### vehicle_registrations
Vehicle pass records.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| household_id | TEXT | Foreign key to households |
| plate_number | TEXT | License plate |
| make_model | TEXT | Vehicle make and model |
| color | TEXT | Vehicle color |
| pass_type | TEXT | sticker, rfid |
| status | TEXT | pending, approved, rejected |
| created_at | DATETIME | Request date |

#### pass_fees
Configurable pass fees.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| pass_type | TEXT | employee_id, vehicle_sticker, vehicle_rfid |
| fee_amount | REAL | Fee amount |
| updated_at | DATETIME | Last update |

## Configuration

### Environment Variables

Set in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "ENVIRONMENT": "development",
    "JWT_SECRET": "your-secret-key-here",
    "CORS_ORIGIN": "http://localhost:5173"
  }
}
```

### Vite Configuration

Key settings in `vite.config.ts`:

- Frontend port: 5173
- API proxy: `/api` → `http://localhost:8787/api`
- Path alias: `@` → `./src`

### Tailwind CSS Theme

Custom CSS variables in `src/index.css`:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96.1%;
  --accent: 210 40% 96.1%;
  --radius: 0.5rem;
}
```

## Deployment

### Frontend (Vercel/Netlify)

```bash
# Build for production
npm run build

# Deploy to Vercel
vercel deploy
```

### Backend (Cloudflare Workers)

```bash
# Login to Cloudflare
npx wrangler login

# Deploy to production
npx wrangler deploy

# Run migrations on production
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql
npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0002_add_lot_ownership.sql
# ... etc
```

### Environment Setup for Production

1. Update `wrangler.jsonc` with production values
2. Set secure `JWT_SECRET`
3. Configure `CORS_ORIGIN` for your domain
4. Update D1 database ID
5. Set up R2 bucket for documents

## Testing

Currently, the project does not have automated tests. Manual testing is performed via:

```bash
npm run dev:all
```

Test coverage includes:
- Authentication flow
- Service request CRUD
- Reservation booking
- Payment processing
- Admin operations

## Troubleshooting

### Debug Page

Visit `/debug` to view:
- Current auth state
- LocalStorage contents
- User information

### Common Issues

**API returns 404**
- Ensure `/api` prefix is NOT in your API client calls
- Check backend is running on port 8787

**Database connection errors**
- Verify D1 database ID in wrangler.jsonc
- Run migrations if database is empty

**Map not loading**
- Check GeoJSON endpoint returns data
- Verify Leaflet CSS is imported

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style Guidelines

- Use TypeScript for type safety
- Follow existing component patterns
- Write meaningful commit messages
- Update documentation as needed

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- GitHub Issues: https://github.com/miconficker/lhs-hoa/issues
- Email: support@example.com

---

**Built with ❤️ for the Laguna Hills Homeowners Association**
