# Laguna Hills HOA - API Documentation

Complete API reference for the Laguna Hills Homeowners Association Management System.

**Version**: 1.0.0
**Base URL**: `/api`
**Last Updated**: 2026-03-06

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [API Response Format](#api-response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Authentication](#authentication-endpoints)
  - [Users & Households](#users--households)
  - [Dashboard](#dashboard)
  - [Announcements](#announcements)
  - [Events](#events)
  - [Service Requests](#service-requests)
  - [Reservations](#reservations)
  - [Payments](#payments)
  - [Documents](#documents)
  - [Polls](#polls)
  - [Notifications](#notifications)
  - [Pass Management](#pass-management)
  - [Admin](#admin)
- [Data Models](#data-models)
- [Rate Limiting](#rate-limiting)

---

## Overview

The Laguna Hills HOA API is a RESTful API built with Cloudflare Workers and Hono framework. All endpoints return JSON responses unless otherwise specified.

### Base URL

```
/api
```

All endpoints are prefixed with `/api`.

### Authentication

Most endpoints require authentication using JWT bearer tokens:

```http
Authorization: Bearer <your-jwt-token>
```

Include the token in the `Authorization` header for authenticated requests.

---

## Authentication

### Getting a Token

#### POST /api/auth/login

Authenticate with email and password.

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**: `200 OK`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "resident",
    "name": "John Doe"
  }
}
```

**Errors**:
- `400` - Invalid input (validation failed)
- `401` - Invalid credentials

---

#### POST /api/auth/register

Register a new user account.

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "resident",
  "phone": "+63XXX-XXX-XXXX"
}
```

**Response**: `201 Created`

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "resident",
    "phone": "+63XXX-XXX-XXXX"
  }
}
```

**Roles**: `admin`, `resident`, `staff`, `guest`

**Errors**:
- `400` - Invalid input or email already exists
- `403` - Registration not allowed (if whitelist is enforced)

---

#### GET /api/auth/google/url

Get Google OAuth authorization URL.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| redirect_uri | string | No | Override redirect URI |

**Response**: `200 OK`

```json
{
  "url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=..."
}
```

---

#### GET /api/auth/google/callback

OAuth callback endpoint (redirected from Google).

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| code | string | Yes | OAuth authorization code |
| state | string | Yes | CSRF protection state |
| redirect_uri | string | No | Override redirect URI |

**Response**: `200 OK` (with token) or `302` redirect

---

#### GET /api/auth/me

Get current authenticated user information.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "resident",
  "name": "John Doe",
  "phone": "+63XXX-XXX-XXXX"
}
```

**Errors**:
- `401` - Not authenticated

---

### Pre-approved Emails (Admin Only)

#### POST /api/auth/whitelist

Add email to pre-approved whitelist.

**Authentication**: Required (admin only)

**Request Body**:

```json
{
  "email": "user@example.com",
  "role": "resident"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "resident",
  "created_at": "2026-03-06T10:00:00Z"
}
```

---

#### GET /api/auth/whitelist

Get all whitelisted emails.

**Authentication**: Required (admin only)

**Response**: `200 OK`

```json
{
  "emails": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "role": "resident",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### DELETE /api/auth/whitelist/:id

Remove email from whitelist.

**Authentication**: Required (admin only)

**Response**: `204 No Content`

---

## API Response Format

### Success Responses

Most successful responses return JSON:

```json
{
  "data": { ... }
}
```

Or return the resource directly:

```json
{
  "id": "uuid",
  "name": "Example"
}
```

### Error Responses

All errors follow this format:

```json
{
  "error": "Error message"
}
```

Or with validation details:

```json
{
  "error": "Invalid input",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email format"]
    }
  }
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | OK - Request succeeded |
| `201` | Created - Resource created successfully |
| `204` | No Content - Success, no response body |
| `400` | Bad Request - Invalid input or validation failed |
| `401` | Unauthorized - Missing or invalid token |
| `403` | Forbidden - Insufficient permissions |
| `404` | Not Found - Resource not found |
| `500` | Internal Server Error - Server error |

### Common Errors

| Error | Description |
|-------|-------------|
| `Invalid input` | Request validation failed |
| `Unauthorized` | Authentication required |
| `Forbidden` | Insufficient permissions |
| `Not found` | Resource does not exist |
| `Database error` | Database operation failed |

---

## Endpoints

### Authentication Endpoints

See [Authentication](#authentication) section above.

---

### Users & Households

#### GET /api/households

Get all households (with pagination).

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |

**Response**: `200 OK`

```json
{
  "households": [
    {
      "id": "uuid",
      "owner_user_id": "uuid",
      "address": "Block 1, Lot 1",
      "lot_number": "1",
      "block_number": "1",
      "status": "occupied",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

#### GET /api/households/:id

Get household by ID.

**Authentication**: Required

**Access**: Users can only view their own household (residents) or any household (admin/staff)

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "owner_user_id": "uuid",
  "address": "Block 1, Lot 1",
  "lot_number": "1",
  "block_number": "1",
  "status": "occupied",
  "owner": {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "residents": [
    {
      "id": "uuid",
      "name": "Jane Doe",
      "relationship": "spouse"
    }
  ],
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your household)
- `404` - Household not found

---

#### PUT /api/households/:id

Update household information.

**Authentication**: Required

**Access**: Household owner or admin

**Request Body**:

```json
{
  "address": "Block 1, Lot 1",
  "status": "occupied"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "address": "Block 1, Lot 1",
  "status": "occupied",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your household)
- `404` - Household not found

---

#### GET /api/households/my-lots

Get lots associated with current user.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "lots": [
    {
      "id": "uuid",
      "lot_number": "1",
      "block_number": "1",
      "address": "Block 1, Lot 1",
      "status": "owned",
      "type": "residential"
    }
  ]
}
```

---

#### GET /api/households/lots

Get all lots (public endpoint).

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| block | string | Filter by block number |
| lot | string | Filter by lot number |
| status | string | Filter by status |
| type | string | Filter by type |

**Response**: `200 OK`

```json
{
  "lots": [
    {
      "id": "uuid",
      "lot_number": "1",
      "block_number": "1",
      "status": "owned",
      "type": "residential",
      "label": "Block 1 Lot 1"
    }
  ]
}
```

---

#### GET /api/households/map/locations

Get all household locations for map rendering.

**Authentication**: Not required

**Response**: `200 OK`

```json
{
  "locations": [
    {
      "lot_id": "uuid",
      "household_id": "uuid",
      "address": "Block 1, Lot 1",
      "owner_name": "John Doe",
      "coordinates": [121.0, 14.5]
    }
  ]
}
```

---

### Dashboard

#### GET /api/dashboard/stats

Get dashboard statistics.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "households": {
    "total": 150,
    "occupied": 120,
    "vacant": 30
  },
  "payments": {
    "total_collected": 150000,
    "pending": 20000,
    "overdue": 5000
  },
  "serviceRequests": {
    "open": 5,
    "in_progress": 10,
    "completed": 50
  },
  "reservations": {
    "active": 8,
    "upcoming": 12
  }
}
```

---

#### GET /api/dashboard/my-stats/:householdId

Get statistics for specific household.

**Authentication**: Required

**Access**: Own household or admin/staff

**Response**: `200 OK`

```json
{
  "household_id": "uuid",
  "payments": {
    "balance": 1500,
    "last_payment": "2026-02-15",
    "status": "current"
  },
  "serviceRequests": {
    "open": 1,
    "completed": 5
  },
  "reservations": {
    "active": 0,
    "upcoming": 1
  }
}
```

---

### Announcements

#### GET /api/announcements

Get all announcements.

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page |
| active | boolean | true | Only active announcements |

**Response**: `200 OK`

```json
{
  "announcements": [
    {
      "id": "uuid",
      "title": "Annual Meeting",
      "content": "Join us for the annual HOA meeting...",
      "priority": "high",
      "active": true,
      "created_at": "2026-03-06T10:00:00Z",
      "created_by": {
        "id": "uuid",
        "name": "Admin User"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5
  }
}
```

---

#### GET /api/announcements/:id

Get announcement by ID.

**Authentication**: Not required

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "title": "Annual Meeting",
  "content": "Join us for the annual HOA meeting...",
  "priority": "high",
  "active": true,
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T10:00:00Z",
  "created_by": {
    "id": "uuid",
    "name": "Admin User"
  }
}
```

**Errors**:
- `404` - Announcement not found

---

#### POST /api/announcements

Create new announcement.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "title": "Annual Meeting",
  "content": "Join us for the annual HOA meeting...",
  "priority": "high"
}
```

**Priority values**: `low`, `medium`, `high`

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "title": "Annual Meeting",
  "content": "Join us for the annual HOA meeting...",
  "priority": "high",
  "active": true,
  "created_at": "2026-03-06T10:00:00Z",
  "created_by": {
    "id": "uuid",
    "name": "Admin User"
  }
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)

---

#### PUT /api/announcements/:id

Update announcement.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "priority": "high",
  "active": true
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "title": "Updated Title",
  "content": "Updated content...",
  "priority": "high",
  "active": true,
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Announcement not found

---

#### DELETE /api/announcements/:id

Delete announcement.

**Authentication**: Required (admin/staff)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Announcement not found

---

### Events

#### GET /api/events

Get all events.

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page |
| upcoming | boolean | true | Only upcoming events |

**Response**: `200 OK`

```json
{
  "events": [
    {
      "id": "uuid",
      "title": "Community BBQ",
      "description": "Annual community barbecue...",
      "start_date": "2026-04-15T16:00:00Z",
      "end_date": "2026-04-15T20:00:00Z",
      "location": "Clubhouse",
      "max_attendees": 50,
      "attendees_count": 25,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 20,
    "totalPages": 2
  }
}
```

---

#### GET /api/events/:id

Get event by ID.

**Authentication**: Not required

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "title": "Community BBQ",
  "description": "Annual community barbecue...",
  "start_date": "2026-04-15T16:00:00Z",
  "end_date": "2026-04-15T20:00:00Z",
  "location": "Clubhouse",
  "max_attendees": 50,
  "attendees_count": 25,
  "attendees": [
    {
      "user_id": "uuid",
      "name": "John Doe",
      "registered_at": "2026-03-06T10:00:00Z"
    }
  ],
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `404` - Event not found

---

#### POST /api/events

Create new event.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "title": "Community BBQ",
  "description": "Annual community barbecue...",
  "start_date": "2026-04-15T16:00:00Z",
  "end_date": "2026-04-15T20:00:00Z",
  "location": "Clubhouse",
  "max_attendees": 50
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "title": "Community BBQ",
  "description": "Annual community barbecue...",
  "start_date": "2026-04-15T16:00:00Z",
  "end_date": "2026-04-15T20:00:00Z",
  "location": "Clubhouse",
  "max_attendees": 50,
  "attendees_count": 0,
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)

---

#### PUT /api/events/:id

Update event.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "title": "Updated Title",
  "description": "Updated description...",
  "start_date": "2026-04-15T16:00:00Z",
  "end_date": "2026-04-15T20:00:00Z",
  "location": "Clubhouse",
  "max_attendees": 50
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "title": "Updated Title",
  "description": "Updated description...",
  "start_date": "2026-04-15T16:00:00Z",
  "end_date": "2026-04-15T20:00:00Z",
  "location": "Clubhouse",
  "max_attendees": 50,
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Event not found

---

#### DELETE /api/events/:id

Delete event.

**Authentication**: Required (admin/staff)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Event not found

---

### Service Requests

#### GET /api/service-requests

Get all service requests.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | All | Filter by status |
| household_id | string | All | Filter by household |

**Status values**: `open`, `in_progress`, `completed`, `cancelled`

**Response**: `200 OK`

```json
{
  "requests": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "category": "plumbing",
      "description": "Leaky faucet in kitchen",
      "status": "open",
      "priority": "medium",
      "created_by": {
        "id": "uuid",
        "name": "John Doe"
      },
      "assigned_to": null,
      "created_at": "2026-03-06T10:00:00Z",
      "updated_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

#### GET /api/service-requests/:id

Get service request by ID.

**Authentication**: Required

**Access**: Own requests or admin/staff

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "category": "plumbing",
  "description": "Leaky faucet in kitchen",
  "status": "open",
  "priority": "medium",
  "created_by": {
    "id": "uuid",
    "name": "John Doe"
  },
  "assigned_to": null,
  "notes": [],
  "created_at": "2026-03-06T10:00:00Z",
  "updated_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your request)
- `404` - Request not found

---

#### POST /api/service-requests

Create new service request.

**Authentication**: Required (residents)

**Request Body**:

```json
{
  "category": "plumbing",
  "description": "Leaky faucet in kitchen",
  "priority": "medium"
}
```

**Category values**: `plumbing`, `electrical`, `carpentry`, `landscaping`, `other`

**Priority values**: `low`, `medium`, `high`, `emergency`

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "category": "plumbing",
  "description": "Leaky faucet in kitchen",
  "status": "open",
  "priority": "medium",
  "created_by": {
    "id": "uuid",
    "name": "John Doe"
  },
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not resident)

---

#### PUT /api/service-requests/:id

Update service request.

**Authentication**: Required

**Request Body**:

```json
{
  "status": "in_progress",
  "priority": "high",
  "assigned_to": "staff-uuid"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "status": "in_progress",
  "priority": "high",
  "assigned_to": {
    "id": "staff-uuid",
    "name": "Staff User"
  },
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your request or not staff)
- `404` - Request not found

---

#### DELETE /api/service-requests/:id

Cancel/delete service request.

**Authentication**: Required

**Access**: Request creator or admin/staff

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not your request)
- `404` - Request not found

---

### Reservations

#### GET /api/reservations

Get all reservations.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| amenity_id | string | All | Filter by amenity |
| date_from | string | All | Filter from date (YYYY-MM-DD) |
| date_to | string | All | Filter to date (YYYY-MM-DD) |

**Response**: `200 OK`

```json
{
  "reservations": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "amenity_id": "uuid",
      "amenity_name": "Clubhouse",
      "start_time": "2026-04-15T10:00:00Z",
      "end_time": "2026-04-15T12:00:00Z",
      "status": "confirmed",
      "created_by": {
        "id": "uuid",
        "name": "John Doe"
      },
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 30,
    "totalPages": 2
  }
}
```

---

#### GET /api/reservations/availability

Check amenity availability.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| amenity_id | string | Yes | Amenity ID |
| date | string | Yes | Date (YYYY-MM-DD) |
| start_time | string | No | Start time (HH:MM) |
| end_time | string | No | End time (HH:MM) |

**Response**: `200 OK`

```json
{
  "amenity_id": "uuid",
  "amenity_name": "Clubhouse",
  "date": "2026-04-15",
  "available_slots": [
    {
      "start_time": "08:00",
      "end_time": "10:00",
      "available": true
    },
    {
      "start_time": "10:00",
      "end_time": "12:00",
      "available": false
    }
  ]
}
```

---

#### GET /api/reservations/my/:householdId

Get current user's reservations.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "reservations": [
    {
      "id": "uuid",
      "amenity_name": "Clubhouse",
      "start_time": "2026-04-15T10:00:00Z",
      "end_time": "2026-04-15T12:00:00Z",
      "status": "confirmed",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/reservations/:id

Get reservation by ID.

**Authentication**: Required

**Access**: Own reservation or admin/staff

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "amenity_id": "uuid",
  "amenity_name": "Clubhouse",
  "start_time": "2026-04-15T10:00:00Z",
  "end_time": "2026-04-15T12:00:00Z",
  "status": "confirmed",
  "created_by": {
    "id": "uuid",
    "name": "John Doe"
  },
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your reservation)
- `404` - Reservation not found

---

#### POST /api/reservations

Create new reservation.

**Authentication**: Required (residents)

**Request Body**:

```json
{
  "amenity_id": "uuid",
  "date": "2026-04-15",
  "start_time": "10:00",
  "end_time": "12:00"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "amenity_id": "uuid",
  "amenity_name": "Clubhouse",
  "start_time": "2026-04-15T10:00:00Z",
  "end_time": "2026-04-15T12:00:00Z",
  "status": "confirmed",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `400` - Time slot not available
- `403` - Forbidden (not resident)

---

#### PUT /api/reservations/:id

Update reservation.

**Authentication**: Required

**Request Body**:

```json
{
  "date": "2026-04-16",
  "start_time": "14:00",
  "end_time": "16:00"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "start_time": "2026-04-16T14:00:00Z",
  "end_time": "2026-04-16T16:00:00Z",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `400` - Time slot not available
- `403` - Forbidden (not your reservation)
- `404` - Reservation not found

---

#### DELETE /api/reservations/:id

Cancel reservation.

**Authentication**: Required

**Access**: Own reservation or admin/staff

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not your reservation)
- `404` - Reservation not found

---

### Payments

#### GET /api/payments

Get all payments (admin view).

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| household_id | string | All | Filter by household |
| status | string | All | Filter by status |
| payment_category | string | All | Filter by category |

**Response**: `200 OK`

```json
{
  "payments": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "amount": 1500.00,
      "currency": "PHP",
      "method": "bank_transfer",
      "status": "completed",
      "payment_category": "dues",
      "reference_number": "REF123",
      "period": "2026-03",
      "paid_at": "2026-03-01T10:00:00Z",
      "created_at": "2026-03-01T09:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### GET /api/payments/:id

Get payment by ID.

**Authentication**: Required

**Access**: Own payment or admin/staff

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "household_address": "Block 1, Lot 1",
  "amount": 1500.00,
  "currency": "PHP",
  "method": "bank_transfer",
  "status": "completed",
  "payment_category": "dues",
  "reference_number": "REF123",
  "period": "2026-03",
  "verification_status": "verified",
  "paid_at": "2026-03-01T10:00:00Z",
  "created_at": "2026-03-01T09:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your payment)
- `404` - Payment not found

---

#### GET /api/payments/my/:householdId

Get current user's payments.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 1500.00,
      "currency": "PHP",
      "method": "bank_transfer",
      "status": "completed",
      "payment_category": "dues",
      "period": "2026-03",
      "paid_at": "2026-03-01T10:00:00Z",
      "created_at": "2026-03-01T09:00:00Z"
    }
  ]
}
```

---

#### GET /api/payments/balance/:householdId

Get household payment balance.

**Authentication**: Required

**Access**: Own household or admin/staff

**Response**: `200 OK`

```json
{
  "household_id": "uuid",
  "total_due": 1500.00,
  "total_paid": 1500.00,
  "balance": 0.00,
  "status": "current",
  "overdue_amount": 0.00,
  "pending_payments": 0
}
```

---

#### POST /api/payments/initiate

Initiate payment with proof upload (resident).

**Authentication**: Required (residents)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| payment_type | string | Yes | `dues`, `vehicle_pass`, `employee_id` |
| amount | number | Yes | Payment amount |
| method | string | Yes | `bank_transfer`, `gcash`, `paymaya`, `cash` |
| reference_number | string | No | Transaction reference |
| proof | File | Yes | Proof file (JPG/PNG/PDF, max 5MB) |

**Response**: `201 Created`

```json
{
  "payment": {
    "id": "uuid",
    "household_id": "uuid",
    "amount": 1500.00,
    "method": "bank_transfer",
    "status": "pending",
    "payment_category": "dues",
    "verification_status": "pending"
  },
  "proof": {
    "id": "uuid",
    "file_url": "https://..."
  },
  "queue_id": "uuid"
}
```

**Errors**:
- `400` - File size exceeds 5MB or invalid type
- `403` - Forbidden (not resident)

---

#### PUT /api/payments/:paymentId/proof

Re-upload proof for rejected payment.

**Authentication**: Required

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| proof | File | Yes | New proof file |

**Response**: `200 OK`

```json
{
  "message": "Proof uploaded successfully",
  "file_url": "https://..."
}
```

**Errors**:
- `400` - File size exceeds 5MB or invalid type
- `403` - Forbidden (not your payment)
- `404` - Payment not found

---

#### GET /api/payments/my-pending/verifications

Get current user's pending verification requests.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "verifications": [
    {
      "id": "queue_id",
      "payment_id": "uuid",
      "payment_type": "dues",
      "amount": 1500.00,
      "status": "pending",
      "household_address": "Block 1, Lot 1",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### PUT /api/payments/:id/status

Update payment status (admin only).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "status": "completed"
}
```

**Status values**: `pending`, `completed`, `failed`

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "status": "completed",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Payment not found

---

### Documents

#### GET /api/documents

Get all documents.

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| category | string | All | Filter by category |

**Category values**: `rules`, `forms`, `minutes`, `policies`, `other`

**Response**: `200 OK`

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "HOA Bylaws",
      "description": "Official bylaws document",
      "category": "rules",
      "file_url": "https://r2.dev/...",
      "file_name": "bylaws.pdf",
      "file_size": 102400,
      "uploaded_by": {
        "id": "uuid",
        "name": "Admin User"
      },
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 35,
    "totalPages": 2
  }
}
```

---

#### GET /api/documents/:id

Get document by ID.

**Authentication**: Not required

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "title": "HOA Bylaws",
  "description": "Official bylaws document",
  "category": "rules",
  "file_url": "https://r2.dev/...",
  "file_name": "bylaws.pdf",
  "file_size": 102400,
  "uploaded_by": {
    "id": "uuid",
    "name": "Admin User"
  },
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `404` - Document not found

---

#### GET /api/documents/:id/download

Download document file.

**Authentication**: Not required

**Response**: `302` redirect to R2 file or `200 OK` with file content

---

#### POST /api/documents

Upload new document.

**Authentication**: Required (admin/staff)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Document title |
| description | string | No | Document description |
| category | string | Yes | Document category |
| file | File | Yes | Document file (PDF, max 10MB) |

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "title": "HOA Bylaws",
  "description": "Official bylaws document",
  "category": "rules",
  "file_url": "https://r2.dev/...",
  "file_name": "bylaws.pdf",
  "file_size": 102400,
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `400` - File size exceeds 10MB or invalid type
- `403` - Forbidden (not admin/staff)

---

#### DELETE /api/documents/:id

Delete document.

**Authentication**: Required (admin only)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Document not found

---

### Polls

#### GET /api/polls

Get all polls.

**Authentication**: Not required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 10 | Items per page |
| active | boolean | true | Only active polls |

**Response**: `200 OK`

```json
{
  "polls": [
    {
      "id": "uuid",
      "question": "Should we install a new playground?",
      "description": "Vote on the new playground proposal...",
      "active": true,
      "allow_multiple": false,
      "end_date": "2026-04-15T23:59:59Z",
      "created_by": {
        "id": "uuid",
        "name": "Admin User"
      },
      "options": [
        {
          "id": "uuid",
          "text": "Yes",
          "vote_count": 25
        },
        {
          "id": "uuid",
          "text": "No",
          "vote_count": 5
        }
      ],
      "total_votes": 30,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

#### GET /api/polls/:id

Get poll by ID.

**Authentication**: Not required

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "question": "Should we install a new playground?",
  "description": "Vote on the new playground proposal...",
  "active": true,
  "allow_multiple": false,
  "end_date": "2026-04-15T23:59:59Z",
  "created_by": {
    "id": "uuid",
    "name": "Admin User"
  },
  "options": [
    {
      "id": "uuid",
      "text": "Yes",
      "vote_count": 25
    },
    {
      "id": "uuid",
      "text": "No",
      "vote_count": 5
    }
  ],
  "total_votes": 30,
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `404` - Poll not found

---

#### GET /api/polls/:id/my-vote

Get current user's vote on poll.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "poll_id": "uuid",
  "user_id": "uuid",
  "votes": [
    {
      "option_id": "uuid",
      "option_text": "Yes",
      "voted_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

**Errors**:
- `404` - Poll not found or no vote cast

---

#### POST /api/polls

Create new poll.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "question": "Should we install a new playground?",
  "description": "Vote on the new playground proposal...",
  "allow_multiple": false,
  "end_date": "2026-04-15T23:59:59Z",
  "options": [
    { "text": "Yes" },
    { "text": "No" }
  ]
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "question": "Should we install a new playground?",
  "description": "Vote on the new playground proposal...",
  "active": true,
  "allow_multiple": false,
  "end_date": "2026-04-15T23:59:59Z",
  "created_at": "2026-03-06T10:00:00Z",
  "options": [
    {
      "id": "uuid",
      "text": "Yes",
      "vote_count": 0
    },
    {
      "id": "uuid",
      "text": "No",
      "vote_count": 0
    }
  ]
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)

---

#### POST /api/polls/:id/vote

Cast vote on poll.

**Authentication**: Required (residents)

**Request Body**:

```json
{
  "option_ids": ["uuid"]
}
```

For single-choice polls, provide one option ID. For multiple-choice, provide array.

**Response**: `201 Created`

```json
{
  "message": "Vote recorded successfully",
  "poll_id": "uuid",
  "votes": [
    {
      "option_id": "uuid",
      "option_text": "Yes",
      "voted_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

**Errors**:
- `400` - Poll expired or already voted
- `403` - Forbidden (not resident)
- `404` - Poll not found

---

#### POST /api/polls/:id/record-vote

Record vote in-person (admin/staff).

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "household_id": "uuid",
  "option_id": "uuid"
}
```

**Response**: `201 Created`

```json
{
  "message": "Vote recorded successfully",
  "poll_id": "uuid",
  "household_id": "uuid"
}
```

**Errors**:
- `400` - Poll expired
- `403` - Forbidden (not admin/staff)
- `404` - Poll not found

---

#### PUT /api/polls/:id

Update poll.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "question": "Updated question?",
  "description": "Updated description...",
  "active": true,
  "end_date": "2026-04-20T23:59:59Z"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "question": "Updated question?",
  "description": "Updated description...",
  "active": true,
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Poll not found

---

#### DELETE /api/polls/:id

Delete poll.

**Authentication**: Required (admin/staff)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Poll not found

---

### Notifications

#### GET /api/notifications

Get current user's notifications.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| unread_only | boolean | false | Only unread notifications |

**Response**: `200 OK`

```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "type": "announcement",
      "title": "New Announcement",
      "message": "A new announcement has been posted...",
      "read": false,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "totalPages": 2
  }
}
```

---

#### GET /api/notifications/:id

Get notification by ID.

**Authentication**: Required

**Access**: Own notifications only

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "announcement",
  "title": "New Announcement",
  "message": "A new announcement has been posted...",
  "read": false,
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your notification)
- `404` - Notification not found

---

#### POST /api/notifications

Create notification (admin/staff).

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "user_id": "uuid",
  "type": "announcement",
  "title": "New Announcement",
  "message": "A new announcement has been posted..."
}
```

**Type values**: `announcement`, `reminder`, `alert`, `demand_letter`, `late_notice`

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "type": "announcement",
  "title": "New Announcement",
  "message": "A new announcement has been posted...",
  "read": false,
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)

---

#### PUT /api/notifications/:id/read

Mark notification as read.

**Authentication**: Required

**Access**: Own notifications only

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "read": true,
  "read_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your notification)
- `404` - Notification not found

---

#### PUT /api/notifications/read-all

Mark all notifications as read for current user.

**Authentication**: Required

**Response**: `200 OK`

```json
{
  "message": "All notifications marked as read",
  "count": 10
}
```

---

#### DELETE /api/notifications/:id

Delete notification.

**Authentication**: Required

**Access**: Own notifications only

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not your notification)
- `404` - Notification not found

---

#### POST /api/notifications/admin/send

Send bulk notifications to users (admin).

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "type": "announcement",
  "title": "Important Announcement",
  "message": "This affects all residents...",
  "target_role": "resident",
  "user_ids": ["uuid1", "uuid2"]
}
```

**Target options**: Provide `target_role` OR `user_ids` (not both)

**Response**: `201 Created`

```json
{
  "message": "Bulk notifications sent",
  "count": 25,
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid1",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### GET /api/notifications/admin/all

Get all notifications (admin view).

**Authentication**: Required (admin)

**Response**: `200 OK`

```json
{
  "notifications": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "user_name": "John Doe",
      "type": "announcement",
      "title": "New Announcement",
      "message": "A new announcement has been posted...",
      "read": false,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

### Pass Management

#### GET /api/pass-management/employees

Get all employee passes.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | All | Filter by status |

**Response**: `200 OK`

```json
{
  "employees": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "employee_name": "Juan Dela Cruz",
      "position": "Driver",
      "employer": "John Doe",
      "status": "active",
      "photo_url": "https://r2.dev/...",
      "payment_status": "paid",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

---

#### POST /api/pass-management/employees

Create new employee pass.

**Authentication**: Required (residents)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| employee_name | string | Yes | Employee full name |
| position | string | Yes | Job position |
| photo | File | Yes | Employee photo (JPG/PNG, max 2MB) |

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "employee_name": "Juan Dela Cruz",
  "position": "Driver",
  "status": "pending_payment",
  "photo_url": "https://r2.dev/...",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `400` - File size exceeds 2MB or invalid type
- `403` - Forbidden (not resident)

---

#### GET /api/pass-management/employees/:id

Get employee pass by ID.

**Authentication**: Required

**Access**: Own employee or admin/staff

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "household_address": "Block 1, Lot 1",
  "employee_name": "Juan Dela Cruz",
  "position": "Driver",
  "employer": "John Doe",
  "status": "active",
  "photo_url": "https://r2.dev/...",
  "payment_status": "paid",
  "rfid_code": "RF123456",
  "sticker_number": "ST789",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your employee)
- `404` - Employee pass not found

---

#### PUT /api/pass-management/employees/:id

Update employee pass.

**Authentication**: Required

**Request Body**:

```json
{
  "employee_name": "Updated Name",
  "position": "Updated Position"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "employee_name": "Updated Name",
  "position": "Updated Position",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your employee)
- `404` - Employee pass not found

---

#### DELETE /api/pass-management/employees/:id

Delete employee pass.

**Authentication**: Required

**Access**: Own employee or admin/staff

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not your employee)
- `404` - Employee pass not found

---

#### GET /api/pass-management/vehicles

Get all vehicle passes.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | All | Filter by status |

**Response**: `200 OK`

```json
{
  "vehicles": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "plate_number": "ABC 123",
      "make": "Toyota",
      "model": "Vios",
      "color": "White",
      "status": "active",
      "payment_status": "paid",
      "rfid_code": "RF123456",
      "sticker_number": "ST789",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 80,
    "totalPages": 4
  }
}
```

---

#### POST /api/pass-management/vehicles

Create new vehicle pass.

**Authentication**: Required (residents)

**Request Body**:

```json
{
  "plate_number": "ABC 123",
  "make": "Toyota",
  "model": "Vios",
  "color": "White"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "plate_number": "ABC 123",
  "make": "Toyota",
  "model": "Vios",
  "color": "White",
  "status": "pending_payment",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not resident)

---

#### GET /api/pass-management/vehicles/:id

Get vehicle pass by ID.

**Authentication**: Required

**Access**: Own vehicle or admin/staff

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "household_address": "Block 1, Lot 1",
  "plate_number": "ABC 123",
  "make": "Toyota",
  "model": "Vios",
  "color": "White",
  "status": "active",
  "payment_status": "paid",
  "rfid_code": "RF123456",
  "sticker_number": "ST789",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your vehicle)
- `404` - Vehicle pass not found

---

#### PUT /api/pass-management/vehicles/:id

Update vehicle pass.

**Authentication**: Required

**Request Body**:

```json
{
  "plate_number": "XYZ 789",
  "make": "Honda",
  "model": "Civic",
  "color": "Red"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "plate_number": "XYZ 789",
  "make": "Honda",
  "model": "Civic",
  "color": "Red",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not your vehicle)
- `404` - Vehicle pass not found

---

#### DELETE /api/pass-management/vehicles/:id

Delete vehicle pass.

**Authentication**: Required

**Access**: Own vehicle or admin/staff

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not your vehicle)
- `404` - Vehicle pass not found

---

### Admin

Admin endpoints provide comprehensive management capabilities for HOA operations.

#### GET /api/admin/users

Get all users.

**Authentication**: Required (admin)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| role | string | All | Filter by role |
| search | string | All | Search by name/email |

**Response**: `200 OK`

```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "resident",
      "phone": "+63XXX-XXX-XXXX",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### POST /api/admin/users

Create new user.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "resident",
  "phone": "+63XXX-XXX-XXXX"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "resident",
  "phone": "+63XXX-XXX-XXXX",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### PUT /api/admin/users/:id

Update user.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "name": "Updated Name",
  "role": "staff",
  "phone": "+63XXX-XXX-XXXX"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "name": "Updated Name",
  "role": "staff",
  "phone": "+63XXX-XXX-XXXX",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - User not found

---

#### DELETE /api/admin/users/:id

Delete user.

**Authentication**: Required (admin)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin)
- `404` - User not found

---

#### GET /api/admin/households

Get all households with full details.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page |
| status | string | All | Filter by status |

**Response**: `200 OK`

```json
{
  "households": [
    {
      "id": "uuid",
      "owner_user_id": "uuid",
      "owner_name": "John Doe",
      "address": "Block 1, Lot 1",
      "lot_number": "1",
      "block_number": "1",
      "status": "occupied",
      "residents_count": 3,
      "created_at": "2026-03-06T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

#### POST /api/admin/households

Create new household.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "owner_user_id": "uuid",
  "address": "Block 1, Lot 1",
  "lot_number": "1",
  "block_number": "1",
  "status": "occupied"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "owner_user_id": "uuid",
  "address": "Block 1, Lot 1",
  "lot_number": "1",
  "block_number": "1",
  "status": "occupied",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### PUT /api/admin/households/:id

Update household.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "address": "Block 1, Lot 1",
  "status": "occupied",
  "owner_user_id": "uuid"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "address": "Block 1, Lot 1",
  "status": "occupied",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Household not found

---

#### DELETE /api/admin/households/:id

Delete household.

**Authentication**: Required (admin)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Household not found

---

#### POST /api/admin/households/import

Import households from CSV/JSON.

**Authentication**: Required (admin)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | CSV or JSON file |

**Response**: `201 Created`

```json
{
  "message": "Households imported successfully",
  "imported": 50,
  "failed": 2,
  "errors": [
    {
      "row": 15,
      "error": "Invalid lot number"
    }
  ]
}
```

**Errors**:
- `400` - Invalid file format
- `403` - Forbidden (not admin)

---

#### POST /api/admin/households/merge

Merge two households.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "primary_household_id": "uuid",
  "secondary_household_id": "uuid"
}
```

**Response**: `200 OK`

```json
{
  "message": "Households merged successfully",
  "primary_household_id": "uuid",
  "merged_residents": 3,
  "merged_lots": 2
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Household not found

---

#### POST /api/admin/households/unmerge

Unmerge households.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "primary_household_id": "uuid",
  "lot_id": "uuid"
}
```

**Response**: `200 OK`

```json
{
  "message": "Household unmerged successfully",
  "new_household_id": "uuid"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Household not found

---

#### GET /api/admin/stats

Get system statistics.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "users": {
    "total": 150,
    "by_role": {
      "admin": 2,
      "staff": 5,
      "resident": 140,
      "guest": 3
    }
  },
  "households": {
    "total": 120,
    "occupied": 100,
    "vacant": 20
  },
  "payments": {
    "total_collected": 150000,
    "pending": 20000,
    "overdue": 5000
  },
  "service_requests": {
    "open": 5,
    "in_progress": 10,
    "completed": 50
  },
  "reservations": {
    "active": 8,
    "upcoming": 12
  }
}
```

---

#### GET /api/admin/lots/ownership

Get lot ownership list.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| block | string | Filter by block |

**Response**: `200 OK`

```json
{
  "lots": [
    {
      "lot_id": "uuid",
      "lot_number": "1",
      "block_number": "1",
      "status": "owned",
      "type": "residential",
      "owner_name": "John Doe",
      "owner_email": "john@example.com",
      "address": "Block 1, Lot 1"
    }
  ]
}
```

---

#### PUT /api/admin/lots/:lotId/owner

Update lot owner.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "owner_user_id": "uuid"
}
```

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "owner_user_id": "uuid",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/status

Update lot status.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "status": "owned"
}
```

**Status values**: `owned`, `rented`, `vacant`, `reserved`

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "status": "owned",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/type

Update lot type.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "type": "residential"
}
```

**Type values**: `residential`, `commercial`, `community`, `utility`, `open_space`

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "type": "residential",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/size

Update lot size.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "size_sqm": 150
}
```

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "size_sqm": 150,
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/label

Update lot label.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "label": "Block 1 Lot 1"
}
```

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "label": "Block 1 Lot 1",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/description

Update lot description.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "description": "Corner lot with garden"
}
```

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "description": "Corner lot with garden",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/:lotId/polygon

Update lot polygon coordinates.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "polygon": [[121.0, 14.5], [121.1, 14.5], [121.1, 14.6], [121.0, 14.6]]
}
```

**Response**: `200 OK`

```json
{
  "lot_id": "uuid",
  "polygon": [[121.0, 14.5], [121.1, 14.5], [121.1, 14.6], [121.0, 14.6]],
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Lot not found

---

#### PUT /api/admin/lots/batch/owner

Batch update lot owners.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "updates": [
    {
      "lot_id": "uuid",
      "owner_user_id": "uuid"
    }
  ]
}
```

**Response**: `200 OK`

```json
{
  "message": "Batch update completed",
  "updated": 10,
  "failed": 0
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### POST /api/admin/lots/import-polygons

Import lot polygons from GeoJSON.

**Authentication**: Required (admin)

**Request**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | GeoJSON file |

**Response**: `201 Created`

```json
{
  "message": "Polygons imported successfully",
  "imported": 150,
  "failed": 5
}
```

**Errors**:
- `400` - Invalid GeoJSON format
- `403` - Forbidden (not admin)

---

#### POST /api/admin/sync-lots

Synchronize lots with households.

**Authentication**: Required (admin)

**Response**: `200 OK`

```json
{
  "message": "Lots synchronized successfully",
  "synced": 120
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### GET /api/admin/dues-rates

Get all dues rates.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "rates": [
    {
      "id": "uuid",
      "name": "Standard Residential",
      "amount": 1500.00,
      "lot_type": "residential",
      "effective_date": "2026-01-01",
      "active": true
    }
  ]
}
```

---

#### POST /api/admin/dues-rates

Create new dues rate.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "name": "Standard Residential",
  "amount": 1500.00,
  "lot_type": "residential",
  "effective_date": "2026-01-01"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "name": "Standard Residential",
  "amount": 1500.00,
  "lot_type": "residential",
  "effective_date": "2026-01-01",
  "active": true
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### PUT /api/admin/dues-rates/:id

Update dues rate.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "name": "Updated Rate",
  "amount": 1600.00,
  "active": true
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "name": "Updated Rate",
  "amount": 1600.00,
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Rate not found

---

#### DELETE /api/admin/dues-rates/:id

Delete dues rate.

**Authentication**: Required (admin)

**Response**: `204 No Content`

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Rate not found

---

#### GET /api/admin/dues-rates/active

Get active dues rate for lot type.

**Authentication**: Required

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| lot_type | string | Yes | Lot type |

**Response**: `200 OK`

```json
{
  "rate": {
    "id": "uuid",
    "name": "Standard Residential",
    "amount": 1500.00,
    "lot_type": "residential",
    "effective_date": "2026-01-01"
  }
}
```

**Errors**:
- `404` - No active rate found

---

#### POST /api/admin/payment-demands/create

Create payment demand letters.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "target_households": ["uuid1", "uuid2"],
  "demand_type": "overdue",
  "amount": 1500.00,
  "due_date": "2026-04-15"
}
```

**Response**: `201 Created`

```json
{
  "message": "Payment demands created",
  "created": 25,
  "demands": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "demand_type": "overdue",
      "amount": 1500.00,
      "due_date": "2026-04-15"
    }
  ]
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### GET /api/admin/payment-demands

Get all payment demands.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | All | Filter by status |

**Response**: `200 OK`

```json
{
  "demands": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "demand_type": "overdue",
      "amount": 1500.00,
      "due_date": "2026-04-15",
      "status": "pending",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### POST /api/admin/payments/in-person

Record in-person payment.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "household_id": "uuid",
  "amount": 1500.00,
  "method": "cash",
  "period": "2026-03",
  "payment_category": "dues",
  "reference_number": "REC123"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "amount": 1500.00,
  "method": "cash",
  "status": "completed",
  "payment_category": "dues",
  "reference_number": "REC123",
  "period": "2026-03",
  "paid_at": "2026-03-06T10:00:00Z",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)

---

#### GET /api/admin/payments/verify

Get payment verification queue.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| status | string | pending | Filter by status |

**Status values**: `pending`, `approved`, `rejected`

**Response**: `200 OK`

```json
{
  "queue": [
    {
      "id": "queue_id",
      "payment_id": "uuid",
      "user_id": "uuid",
      "payment_type": "vehicle_pass",
      "amount": 500.00,
      "reference_number": "REF123",
      "status": "pending",
      "file_url": "https://...",
      "household_address": "Block 5, Lot 10",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### PUT /api/admin/payments/:paymentId/verify

Approve or reject payment verification.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "action": "approve",
  "rejection_reason": "string (required if action=reject)"
}
```

**Action values**: `approve`, `reject`

**Response**: `200 OK`

```json
{
  "message": "Payment approved successfully"
}
```

**Side Effects**:
- Updates `payments.verification_status` to `verified`
- Updates `payment_verification_queue.status`
- Creates notification for resident
- For `vehicle_pass`: Updates `vehicle_registrations.payment_status`
- For `employee_id`: Updates `household_employees.payment_status`

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Payment not found

---

#### GET /api/admin/payments/settings

Get payment settings.

**Authentication**: Required (admin)

**Response**: `200 OK`

```json
{
  "bank_details": {
    "bank_name": "BPI",
    "account_name": "Laguna Hills HOA",
    "account_number": "1234-5678-90"
  },
  "gcash_details": {
    "name": "Laguna Hills HOA",
    "number": "0917-XXX-XXXX"
  },
  "late_fee_config": {
    "rate_percent": 1.0,
    "grace_period_days": 30,
    "max_months": 12
  }
}
```

---

#### PUT /api/admin/payments/settings

Update payment settings.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "bank_details": {
    "bank_name": "BPI",
    "account_name": "Laguna Hills HOA",
    "account_number": "1234-5678-90"
  },
  "gcash_details": {
    "name": "Laguna Hills HOA",
    "number": "0917-XXX-XXXX"
  },
  "late_fee_config": {
    "rate_percent": 1.0,
    "grace_period_days": 30,
    "max_months": 12
  }
}
```

**Response**: `200 OK`

```json
{
  "message": "Settings updated successfully"
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

#### GET /api/admin/payments/export

Export payments with filters.

**Authentication**: Required (admin/staff)

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| start_date | string | YYYY-MM-DD |
| end_date | string | YYYY-MM-DD |
| payment_type | string | `dues`, `vehicle_pass`, `employee_id` |
| status | string | `pending`, `completed`, `failed` |
| method | string | `bank_transfer`, `gcash`, `paymaya`, `cash` |

**Response**: `200 OK`

```json
{
  "payments": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "amount": 1500.00,
      "currency": "PHP",
      "method": "bank_transfer",
      "status": "completed",
      "payment_category": "dues",
      "period": "2026-03",
      "paid_at": "2026-03-01T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/admin/settings

Get all system settings.

**Authentication**: Required (admin)

**Response**: `200 OK`

```json
{
  "settings": [
    {
      "key": "hoa_name",
      "value": "Laguna Hills HOA"
    },
    {
      "key": "contact_email",
      "value": "admin@lagunahills.com"
    }
  ]
}
```

---

#### PUT /api/admin/settings/:key

Update system setting.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "value": "New Value"
}
```

**Response**: `200 OK`

```json
{
  "key": "hoa_name",
  "value": "New Value",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Setting not found

---

#### GET /api/admin/pass-management/stats

Get pass management statistics.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "employees": {
    "total": 45,
    "active": 40,
    "expired": 5
  },
  "vehicles": {
    "total": 80,
    "active": 75,
    "expired": 5
  },
  "revenue": {
    "month": 15000,
    "year": 180000
  }
}
```

---

#### GET /api/admin/pass-management/employees

Get all employee passes (admin view).

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "employees": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "employee_name": "Juan Dela Cruz",
      "position": "Driver",
      "employer": "John Doe",
      "status": "active",
      "payment_status": "paid",
      "rfid_code": "RF123456",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/admin/pass-management/employees/:id

Get employee pass details (admin view).

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "household_address": "Block 1, Lot 1",
  "employee_name": "Juan Dela Cruz",
  "position": "Driver",
  "employer": "John Doe",
  "status": "active",
  "payment_status": "paid",
  "rfid_code": "RF123456",
  "sticker_number": "ST789",
  "photo_url": "https://r2.dev/...",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `404` - Employee pass not found

---

#### GET /api/admin/pass-management/employees/:id/print

Generate printable pass for employee.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

Returns HTML formatted for printing.

---

#### PUT /api/admin/pass-management/employees/:id/status

Update employee pass status.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "status": "active",
  "payment_status": "paid"
}
```

**Status values**: `pending_payment`, `active`, `expired`, `cancelled`

**Payment status values**: `unpaid`, `paid`, `overdue`

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "status": "active",
  "payment_status": "paid",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Employee pass not found

---

#### GET /api/admin/pass-management/vehicles

Get all vehicle passes (admin view).

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "vehicles": [
    {
      "id": "uuid",
      "household_id": "uuid",
      "household_address": "Block 1, Lot 1",
      "plate_number": "ABC 123",
      "make": "Toyota",
      "model": "Vios",
      "color": "White",
      "status": "active",
      "payment_status": "paid",
      "rfid_code": "RF123456",
      "sticker_number": "ST789",
      "created_at": "2026-03-06T10:00:00Z"
    }
  ]
}
```

---

#### GET /api/admin/pass-management/vehicles/:id

Get vehicle pass details (admin view).

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "household_id": "uuid",
  "household_address": "Block 1, Lot 1",
  "plate_number": "ABC 123",
  "make": "Toyota",
  "model": "Vios",
  "color": "White",
  "status": "active",
  "payment_status": "paid",
  "rfid_code": "RF123456",
  "sticker_code": "ST789",
  "created_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `404` - Vehicle pass not found

---

#### PUT /api/admin/pass-management/vehicles/:id/status

Update vehicle pass status.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "status": "active",
  "payment_status": "paid"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "status": "active",
  "payment_status": "paid",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Vehicle pass not found

---

#### PUT /api/admin/pass-management/vehicles/:id/assign-rfid

Assign RFID code to vehicle.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "rfid_code": "RF123456"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "rfid_code": "RF123456",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Vehicle pass not found

---

#### PUT /api/admin/pass-management/vehicles/:id/assign-sticker

Assign sticker number to vehicle.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "sticker_number": "ST789"
}
```

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "sticker_number": "ST789",
  "updated_at": "2026-03-06T11:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin)
- `404` - Vehicle pass not found

---

#### POST /api/admin/pass-management/vehicles/:id/record-payment

Record payment for vehicle pass.

**Authentication**: Required (admin/staff)

**Request Body**:

```json
{
  "amount": 500.00,
  "method": "cash",
  "reference_number": "REF123"
}
```

**Response**: `201 Created`

```json
{
  "id": "uuid",
  "vehicle_id": "uuid",
  "amount": 500.00,
  "method": "cash",
  "reference_number": "REF123",
  "paid_at": "2026-03-06T10:00:00Z"
}
```

**Errors**:
- `403` - Forbidden (not admin/staff)
- `404` - Vehicle pass not found

---

#### GET /api/admin/pass-management/fees

Get pass management fee schedule.

**Authentication**: Required (admin/staff)

**Response**: `200 OK`

```json
{
  "fees": {
    "employee_pass": {
      "amount": 500.00,
      "validity_months": 12
    },
    "vehicle_pass": {
      "amount": 500.00,
      "validity_months": 12
    }
  }
}
```

---

#### PUT /api/admin/pass-management/fees

Update pass management fees.

**Authentication**: Required (admin)

**Request Body**:

```json
{
  "employee_pass": {
    "amount": 600.00,
    "validity_months": 12
  },
  "vehicle_pass": {
    "amount": 600.00,
    "validity_months": 12
  }
}
```

**Response**: `200 OK`

```json
{
  "message": "Fees updated successfully",
  "fees": {
    "employee_pass": {
      "amount": 600.00,
      "validity_months": 12
    },
    "vehicle_pass": {
      "amount": 600.00,
      "validity_months": 12
    }
  }
}
```

**Errors**:
- `403` - Forbidden (not admin)

---

## Data Models

### User

```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'staff' | 'resident' | 'guest';
  phone?: string;
  created_at: string;
  updated_at?: string;
}
```

### Household

```typescript
interface Household {
  id: string;
  owner_user_id: string;
  address: string;
  lot_number: string;
  block_number: string;
  status: 'occupied' | 'vacant' | 'rented';
  created_at: string;
  updated_at?: string;
}
```

### Lot

```typescript
interface Lot {
  id: string;
  lot_number: string;
  block_number: string;
  status: 'owned' | 'rented' | 'vacant' | 'reserved';
  type: 'residential' | 'commercial' | 'community' | 'utility' | 'open_space';
  size_sqm?: number;
  label?: string;
  description?: string;
  owner_user_id?: string;
  polygon?: number[][];
  created_at: string;
  updated_at?: string;
}
```

### Payment

```typescript
interface Payment {
  id: string;
  household_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  reference_number?: string;
  period: string;
  payment_category?: PaymentCategory;
  verification_status?: PaymentVerificationStatus;
  proof_uploaded_at?: string;
  late_fee_amount?: number;
  late_fee_months?: number;
  received_by?: string;
  created_at: string;
  paid_at?: string;
}
```

### ServiceRequest

```typescript
interface ServiceRequest {
  id: string;
  household_id: string;
  category: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'emergency';
  created_by: string;
  assigned_to?: string;
  created_at: string;
  updated_at?: string;
}
```

### Reservation

```typescript
interface Reservation {
  id: string;
  household_id: string;
  amenity_id: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  created_by: string;
  created_at: string;
  updated_at?: string;
}
```

### Announcement

```typescript
interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at?: string;
}
```

### Event

```typescript
interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  location?: string;
  max_attendees?: number;
  attendees_count?: number;
  created_by: string;
  created_at: string;
  updated_at?: string;
}
```

### Poll

```typescript
interface Poll {
  id: string;
  question: string;
  description?: string;
  active: boolean;
  allow_multiple: boolean;
  end_date?: string;
  created_by: string;
  options: PollOption[];
  total_votes: number;
  created_at: string;
  updated_at?: string;
}

interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  vote_count: number;
}
```

### Document

```typescript
interface Document {
  id: string;
  title: string;
  description?: string;
  category: string;
  file_url: string;
  file_name: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}
```

### EmployeePass

```typescript
interface EmployeePass {
  id: string;
  household_id: string;
  employee_name: string;
  position: string;
  status: string;
  payment_status: string;
  photo_url?: string;
  rfid_code?: string;
  sticker_number?: string;
  created_at: string;
  updated_at?: string;
}
```

### VehiclePass

```typescript
interface VehiclePass {
  id: string;
  household_id: string;
  plate_number: string;
  make: string;
  model: string;
  color: string;
  status: string;
  payment_status: string;
  rfid_code?: string;
  sticker_number?: string;
  created_at: string;
  updated_at?: string;
}
```

---

## Rate Limiting

**Note**: Rate limiting is not currently implemented but is planned for future security enhancements. See SECURITY_AUDIT_REPORT.md for details.

---

## Support

For technical questions or issues:
- Review ARCHITECTURE.md for system design details
- Check SECURITY_AUDIT_REPORT.md for security considerations
- Refer to payment-specific docs: docs/payment-api-reference.md
- Contact the development team
