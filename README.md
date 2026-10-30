# FoodBridge — Rescue Food. Share Hope.

A food donation and redistribution platform connecting **Restaurants → NGOs → Volunteers**. Restaurants donate surplus food, NGOs accept suitable donations, volunteers collect and deliver the food with QR-verified pickup, and NGOs confirm receipt — all tracked through a controlled status workflow.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Architecture](#architecture)
5. [Folder Structure](#folder-structure)
6. [Database Models](#database-models)
7. [API Documentation](#api-documentation)
8. [Installation](#installation)
9. [Environment Variables](#environment-variables)
10. [Database Setup](#database-setup)
11. [Running the Project](#running-the-project)
12. [Seeding Data](#seeding-data)
13. [Core Workflow](#core-workflow)
14. [User Roles](#user-roles)
15. [Authentication](#authentication)
16. [QR Verification System](#qr-verification-system)
17. [Notification System](#notification-system)
18. [Security](#security)
19. [Responsive Design](#responsive-design)
20. [Future Scope](#future-scope)

---

## Project Overview

FoodBridge is a B.Tech CSE final-year project that tackles food waste and hunger by creating a simple, trackable pipeline:

1. A **Restaurant** creates a food donation with full details (quantity, expiry, pickup window, safety confirmation).
2. An **NGO** discovers and accepts available donations from the dashboard.
3. A **Volunteer** picks up the delivery task, arrives at the restaurant, and scans a **single-use QR code** to verify pickup.
4. The volunteer delivers the food to the NGO.
5. The **NGO confirms receipt**, completing the donation.

Every step is server-controlled — the frontend cannot set arbitrary statuses. Statistics and notifications are computed from real database data.

---

## Features

### Authentication
- User registration for three roles: Restaurant, NGO, Volunteer
- Login with email and password
- Persistent sessions (stays logged in on refresh)
- Role-based route protection (users can't access other roles' pages)
- Admin account created via seed data (not through public registration)

### Restaurant Module
- **Dashboard** — Real statistics: total donations, active, completed, meals donated, food rescued
- **Create Donation** — Full form with 20+ fields including food safety confirmation
- **My Donations** — All donations created by the restaurant
- **Active Donations** — Donations currently in progress
- **History** — Completed and cancelled donations
- **Impact** — Environmental and social impact metrics
- **Profile** — Editable restaurant profile with operating hours
- **Notifications** — In-app alerts for donation events

### NGO Module
- **Dashboard** — Real statistics: available, accepted, active deliveries, completed, meals received, people served
- **Discover Donations** — Browse available donations with search, category, food type, and status filters
- **Accepted Donations** — Donations the NGO has accepted
- **Deliveries** — Track incoming deliveries and confirm receipt
- **Capacity** — Manage organization capacity (meal capacity, storage, refrigeration, accepted food types)
- **Impact** — Community impact metrics
- **Profile** — Editable NGO profile with registration details

### Volunteer Module
- **Dashboard** — Real statistics: available tasks, active delivery, completed, meals delivered, total deliveries
- **Available Tasks** — Browse and accept delivery tasks
- **Active Delivery** — Step-by-step delivery flow with QR scanner:
  1. Arrived at Restaurant
  2. Scan QR Code (camera-based, with manual fallback)
  3. Start Delivery
  4. Arrived at NGO
  5. Wait for NGO confirmation
- **History** — Completed and cancelled deliveries
- **Impact** — Personal contribution metrics
- **Profile** — Editable volunteer profile with vehicle and availability info

### Admin Module
- **Dashboard** — Platform-wide statistics: total users by role, donations, deliveries, food rescued, meals distributed
- **User Management** — View, search, filter users by role; verify, reject, suspend, reactivate accounts
- **Verification Queue** — Users pending verification
- **Donations** — All platform donations with full details
- **Deliveries** — All platform deliveries with status tracking

### Cross-Module Features
- **Notification System** — In-app notifications for all role-relevant events
- **Impact Pages** — Real statistics computed from database for each role
- **Responsive Design** — Works on desktop, tablet, and mobile

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 with TypeScript |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 7 |
| Icons | Lucide React |
| QR Generation | qrcode.react |
| QR Scanning | html5-qrcode |
| Backend | Supabase (PostgreSQL + Auth + Edge Functions) |
| Database | PostgreSQL with Row-Level Security (RLS) |
| Authentication | Supabase Auth (JWT-based, bcrypt password hashing) |
| Status Control | PostgreSQL SECURITY DEFINER functions |

---

## Architecture

```
┌─────────────────────────────┐
│     Frontend (React/TS)     │
│  ┌───────────────────────┐  │
│  │  Pages (role-based)   │  │
│  │  Components (reusable)│  │
│  │  Context (Auth/Toast) │  │
│  │  Services (API layer) │  │
│  └──────────┬────────────┘  │
└─────────────┼───────────────┘
              │
              ▼
┌─────────────────────────────┐
│      Supabase Backend       │
│  ┌───────────────────────┐  │
│  │  Auth (JWT sessions)  │  │
│  │  PostgreSQL Database  │  │
│  │  ├── profiles         │  │
│  │  ├── donations        │  │
│  │  ├── deliveries       │  │
│  │  └── notifications    │  │
│  │  RLS Policies         │  │
│  │  SECURITY DEFINER     │  │
│  │  Functions:           │  │
│  │  ├── register_profile │  │
│  │  ├── transition_donation│
│  │  ├── admin_set_user_status│
│  │  ├── is_admin         │  │
│  │  └── notify           │  │
│  │  Edge Functions:      │  │
│  │  ├── seed (demo data) │  │
│  │  └── api (REST proxy) │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**Status transitions** are handled by the `transition_donation()` PostgreSQL function (SECURITY DEFINER), which:
- Validates the actor's role and account status
- Checks the current donation status prerequisite
- Generates QR tokens on NGO acceptance
- Creates delivery tasks
- Writes notifications to all relevant parties
- Updates timestamps on the delivery record
- All operations execute atomically

The frontend calls this via RPC and cannot bypass the server logic.

---

## Folder Structure

```
foodbridge/
├── public/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── ConfirmModal.tsx     # Confirmation dialog
│   │   ├── DashboardCard.tsx    # Statistic card for dashboards
│   │   ├── DonationCard.tsx     # Donation display card
│   │   ├── EmptyState.tsx       # Empty list placeholder
│   │   ├── ErrorState.tsx       # Error display with retry
│   │   ├── LoadingSpinner.tsx   # Loading indicator
│   │   ├── NotificationBell.tsx # Header notification icon
│   │   └── StatusBadge.tsx      # Color-coded status badge
│   ├── context/
│   │   ├── AuthContext.tsx      # Auth state, login/register/logout
│   │   └── ToastContext.tsx     # Toast notification system
│   ├── layouts/
│   │   └── DashboardLayout.tsx  # Sidebar + header layout wrapper
│   ├── lib/
│   │   └── supabase.ts          # Supabase client initialization
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── AdminDeliveries.tsx
│   │   │   ├── AdminDonations.tsx
│   │   │   ├── AdminUsers.tsx
│   │   │   └── AdminVerification.tsx
│   │   ├── ngo/
│   │   │   ├── NgoAccepted.tsx
│   │   │   ├── NgoCapacity.tsx
│   │   │   ├── NgoDashboard.tsx
│   │   │   ├── NgoDeliveries.tsx
│   │   │   └── NgoDiscover.tsx
│   │   ├── restaurant/
│   │   │   ├── RestaurantDashboard.tsx
│   │   │   └── RestaurantDonations.tsx
│   │   ├── volunteer/
│   │   │   ├── VolunteerActiveDelivery.tsx   # QR scanning + step flow
│   │   │   ├── VolunteerDashboard.tsx
│   │   │   ├── VolunteerHistory.tsx
│   │   │   └── VolunteerTasks.tsx
│   │   ├── AuthPages.tsx        # Login + Register pages
│   │   ├── CreateDonationPage.tsx
│   │   ├── DonationDetailPage.tsx
│   │   ├── ImpactPage.tsx
│   │   ├── LandingPage.tsx
│   │   ├── NotificationsPage.tsx
│   │   └── ProfilePage.tsx
│   ├── services/
│   │   └── api.ts               # All API calls (auth, donations, deliveries, notifications, admin)
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── utils/
│   │   └── helpers.ts           # Formatting, status badges, classNames
│   ├── App.tsx                  # Router + route protection
│   ├── main.tsx                 # Entry point
│   └── index.css                # Tailwind directives + global styles
├── supabase/
│   ├── migrations/
│   │   ├── 20260816072607_foodbridge_schema.sql           # Core schema
│   │   ├── 20260816073009_add_register_profile.sql        # Registration function
│   │   ├── 20260816075215_fix_profiles_rls_recursion.sql  # RLS fix
│   │   └── 20260818175950_foodbridge_complete_schema.sql  # Combined schema
│   └── functions/
│       ├── api/index.ts         # REST API edge function
│       └── seed/index.ts        # Seed data edge function
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

---

## Database Models

### profiles
One row per authenticated user. Links to `auth.users` via foreign key.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | References auth.users(id) |
| email | text | User email |
| role | enum | restaurant, ngo, volunteer, admin |
| status | enum | pending, verified, rejected, suspended |
| name | text | Display name |
| phone | text | Contact phone |
| address | text | Street address |
| owner_name | text | (Restaurant) Owner name |
| operating_hours | text | (Restaurant) Operating hours |
| organization_name | text | (NGO) Organization name |
| registration_number | text | (NGO) Registration number |
| contact_person | text | (NGO) Contact person |
| service_area | text | (NGO) Service area |
| meal_capacity | integer | (NGO) Meal capacity |
| storage_capacity | text | (NGO) Storage capacity |
| refrigeration_available | boolean | (NGO) Has refrigeration |
| accepted_food_types | text[] | (NGO) Accepted food types |
| vehicle_type | text | (Volunteer) Vehicle type |
| availability | text | (Volunteer) Availability info |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### donations
Food donation created by a restaurant, accepted by an NGO, delivered by a volunteer.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Donation ID |
| restaurant_id | uuid (FK) | Restaurant who created it |
| ngo_id | uuid (FK) | NGO who accepted it |
| volunteer_id | uuid (FK) | Volunteer delivering it |
| food_name | text | Name of the food |
| category | text | Cooked Meals, Bakery, Fruits, etc. |
| food_type | text | Vegetarian, Non-Vegetarian, Vegan |
| description | text | Detailed description |
| quantity | numeric | Amount of food |
| unit | text | servings, pieces, boxes, etc. |
| estimated_servings | integer | Estimated number of people fed |
| preparation_time | timestamptz | When food was prepared |
| expiry_time | timestamptz | When food expires |
| packaging | text | Packaging type |
| allergens | text | Allergen info |
| storage_requirements | text | Storage instructions |
| food_condition | text | Fresh, etc. |
| image | text | Image URL (optional) |
| pickup_address | text | Restaurant pickup address |
| pickup_date | date | Pickup date |
| pickup_start_time | text | Pickup window start |
| pickup_deadline | text | Pickup window end |
| contact_person | text | Restaurant contact |
| contact_number | text | Restaurant phone |
| pickup_instructions | text | Special instructions |
| safety_confirmed | boolean | Food safety acknowledgment |
| qr_token | uuid | Single-use QR verification token |
| qr_used | boolean | Whether QR was used |
| status | enum | See donation status flow below |
| received_quantity | numeric | Actual quantity received by NGO |
| receipt_notes | text | NGO receipt notes |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

**Donation Status Flow:**
```
created → waiting_for_ngo → ngo_accepted → volunteer_assigned →
volunteer_arrived → food_picked_up → in_transit → delivered → completed
```
Additional statuses: `cancelled`, `expired`

### deliveries
One delivery task per accepted donation.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Delivery ID |
| donation_id | uuid (FK) | Associated donation |
| restaurant_id | uuid (FK) | Pickup location owner |
| ngo_id | uuid (FK) | Drop location owner |
| volunteer_id | uuid (FK) | Assigned volunteer |
| pickup_address | text | Restaurant address |
| drop_address | text | NGO address |
| quantity | numeric | Food quantity |
| status | enum | assigned, accepted, arrived_restaurant, food_picked_up, in_transit, arrived_ngo, completed, cancelled |
| arrived_at_restaurant | timestamptz | Timestamp |
| picked_up_at | timestamptz | Timestamp |
| started_at | timestamptz | Timestamp |
| arrived_at_ngo | timestamptz | Timestamp |
| completed_at | timestamptz | Timestamp |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

### notifications
In-app notifications per user.

| Field | Type | Description |
|-------|------|-------------|
| id | uuid (PK) | Notification ID |
| user_id | uuid (FK) | Recipient user |
| title | text | Notification title |
| message | text | Notification body |
| type | enum | info, success, warning, error |
| is_read | boolean | Read status |
| created_at | timestamptz | Creation timestamp |

---

## API Documentation

The frontend communicates with Supabase directly via the JS client.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `supabase.auth.signUp()` | Create auth user |
| POST | `supabase.auth.signInWithPassword()` | Login |
| POST | `supabase.auth.signOut()` | Logout |
| GET | `supabase.auth.getUser()` | Get current user |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| RPC | `register_profile(p_role, p_data)` | Create profile after signUp |
| SELECT | `profiles` | Fetch own profile |
| UPDATE | `profiles` | Update own profile |

### Donations
| Method | Endpoint | Description |
|--------|----------|-------------|
| INSERT | `donations` | Create donation (restaurant only) |
| SELECT | `donations` | List donations (role-scoped) |
| SELECT | `donations:id` | Get single donation |
| RPC | `transition_donation(p_donation_id, p_action, p_actor_id, p_extra)` | All status transitions |

**Transition Actions:**
| Action | Required Role | Prerequisite Status | Result |
|--------|--------------|---------------------|--------|
| accept_ngo | NGO | created, waiting_for_ngo | ngo_accepted + QR token + delivery task |
| assign_volunteer | Volunteer | ngo_accepted | volunteer_assigned |
| arrive_restaurant | Volunteer (assigned) | volunteer_assigned | volunteer_arrived |
| verify_pickup | Volunteer (assigned) | volunteer_arrived | food_picked_up (validates QR) |
| start_delivery | Volunteer (assigned) | food_picked_up | in_transit |
| arrive_ngo | Volunteer (assigned) | in_transit | delivered |
| confirm_receipt | NGO (assigned) | delivered | completed |
| cancel | Restaurant/Admin | not completed/cancelled/delivered | cancelled |

### Deliveries
| Method | Endpoint | Description |
|--------|----------|-------------|
| SELECT | `deliveries` | List deliveries (role-scoped) |
| SELECT | `deliveries:id` | Get single delivery |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| SELECT | `notifications` | List own notifications |
| UPDATE | `notifications:id` | Mark as read |
| UPDATE | `notifications` (filtered) | Mark all as read |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| SELECT | `profiles` | List all users (admin only) |
| RPC | `admin_set_user_status(p_target, p_status)` | Change user status |
| SELECT | `donations` | List all donations |
| SELECT | `deliveries` | List all deliveries |

---

## Installation

```bash
# Clone the project
cd foodbridge

# Install dependencies
npm install
```

---

## Environment Variables

The following variables are pre-configured in `.env`:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

See `.env.example` for the template.

---

## Database Setup

The database schema is managed through Supabase migrations. The migration files are in `supabase/migrations/`. The schema includes:

1. **Enums** — user_role, user_status, donation_status, delivery_status, notification_type
2. **Tables** — profiles, donations, deliveries, notifications (all with RLS enabled)
3. **Functions** — register_profile, transition_donation, admin_set_user_status, is_admin, notify
4. **Policies** — Row-Level Security policies for owner/participant-scoped access
5. **Triggers** — updated_at auto-update on all tables
6. **Indexes** — Performance indexes on status and foreign key columns

The schema is already applied to the connected Supabase instance.

---

## Running the Project

```bash
# Development server (starts automatically)
npm run dev

# Production build
npm run build

# Type checking
npm run typecheck

# Lint
npm run lint
```

The development server runs on `http://localhost:5173`.

---

## Seeding Data

Demo accounts are seeded via a Supabase Edge Function. To seed or re-seed:

```bash
curl -X POST "<SUPABASE_URL>/functions/v1/seed" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

This creates:
- 1 Admin account
- 3 Restaurant accounts
- 3 NGO accounts
- 3 Volunteer accounts
- Sample donations in waiting_for_ngo status

All accounts use the password: `foodbridge123`

| Role | Email |
|------|-------|
| Admin | admin@foodbridge.com |
| Restaurant | restaurant@foodbridge.com |
| Restaurant 2 | restaurant2@foodbridge.com |
| Restaurant 3 | restaurant3@foodbridge.com |
| NGO | ngo@foodbridge.com |
| NGO 2 | ngo2@foodbridge.com |
| NGO 3 | ngo3@foodbridge.com |
| Volunteer | volunteer@foodbridge.com |
| Volunteer 2 | volunteer2@foodbridge.com |
| Volunteer 3 | volunteer3@foodbridge.com |

---

## Core Workflow

```
┌─────────────┐     ┌─────────┐     ┌──────────┐     ┌─────────┐
│  Restaurant  │     │   NGO   │     │ Volunteer│     │   NGO   │
│  creates     │────▶│ accepts │────▶│ accepts  │────▶│ confirms│
│  donation    │     │ donation│     │  task    │     │ receipt │
└─────────────┘     └─────────┘     └──────────┘     └─────────┘
                         │                │
                    QR token          Scans QR
                    generated         at pickup
                         │                │
                         ▼                ▼
                    Delivery task    Pickup verified
                    created          (single-use QR)
                                              │
                                              ▼
                                        Delivery completed
                                        Statistics updated
                                        Notifications sent
```

### Step-by-Step

1. **Restaurant** registers, logs in, and creates a donation with full details
2. **NGO** logs in, discovers the donation, and clicks "Accept"
   - Backend validates: NGO role, verified status, donation available, not expired, not already accepted
   - QR token generated, delivery task created, restaurant notified
3. **Volunteer** logs in, sees the task, and clicks "Accept Task"
   - Volunteer assigned, restaurant and NGO notified
4. **Volunteer** clicks "Arrived at Restaurant"
   - Status updated, restaurant notified
5. **Volunteer** clicks "Scan QR Code" and scans the restaurant's QR
   - Backend verifies: correct volunteer, correct donation, valid token, token not used
   - Pickup confirmed, restaurant and NGO notified
6. **Volunteer** clicks "Start Delivery"
   - Status → in_transit, NGO notified
7. **Volunteer** clicks "Arrived at NGO"
   - Status → delivered, NGO and restaurant notified
8. **NGO** clicks "Confirm Receipt" with received quantity and notes
   - Status → completed, all parties notified, statistics updated

---

## User Roles

| Role | Permissions |
|------|------------|
| Restaurant | Create donations, view own donations, cancel own donations, update profile |
| NGO | Discover donations, accept donations, confirm receipt, manage capacity, update profile |
| Volunteer | View available tasks, accept tasks, perform delivery steps, scan QR, update profile |
| Admin | View all users, manage user status, view all donations and deliveries |

Users can only access their own role's pages. Route protection is enforced both in the frontend (React Router guards) and backend (RLS policies + SECURITY DEFINER functions).

---

## Authentication

- **Registration:** User selects a role (Restaurant, NGO, or Volunteer), fills in details, and submits. The frontend calls `supabase.auth.signUp()` to create the auth user, then calls the `register_profile()` RPC to create the profile row with the selected role. Admin registration is not available publicly.
- **Login:** Email and password authenticated via Supabase Auth. Profile is fetched and checked for suspended status.
- **Sessions:** JWT-based, persisted automatically by the Supabase client. Sessions survive page refreshes.
- **Logout:** Clears the session and redirects to the landing page.

---

## QR Verification System

- When an NGO accepts a donation, the `transition_donation()` function generates a unique UUID QR token
- The QR code is displayed on the donation detail page (visible to restaurant and NGO)
- The QR contains only the token — no personal information
- At pickup, the volunteer scans the QR using the device camera (html5-qrcode library)
- The token is sent to the backend via `transition_donation()` with action `verify_pickup`
- Backend validates: correct volunteer, correct donation, token matches, token not already used
- If valid, status changes to `food_picked_up` and the token is marked as used
- If the camera is unavailable, a manual token entry fallback is provided
- QR tokens are single-use — a used token cannot be reused

---

## Notification System

In-app notifications are created automatically by the `transition_donation()` function at each workflow step:

| Event | Notified Parties |
|-------|-----------------|
| NGO accepts donation | Restaurant, NGO |
| Volunteer assigned | Restaurant, NGO, Volunteer |
| Volunteer arrives at restaurant | Restaurant |
| Food picked up (QR verified) | Restaurant, NGO |
| Delivery in transit | NGO |
| Delivery arrives at NGO | NGO, Restaurant |
| Donation completed | Restaurant, Volunteer, NGO |
| Donation cancelled | NGO, Volunteer (if assigned) |

Users can view notifications, mark individual ones as read, or mark all as read.

---

## Security

- **Password Hashing:** bcrypt via Supabase Auth
- **JWT Authentication:** All requests require a valid JWT token
- **Row-Level Security (RLS):** Every table has RLS enabled with owner/participant-scoped policies
- **SECURITY DEFINER Functions:** All status transitions and privileged operations run as server-side functions that bypass RLS safely
- **Role Validation:** The `register_profile()` function only allows restaurant, ngo, volunteer roles — admin self-registration is blocked
- **Status Transition Control:** The frontend cannot set arbitrary statuses — all transitions go through `transition_donation()` which validates role, status prerequisites, and QR tokens
- **Admin Access:** Admin-only functions check `is_admin()` (SECURITY DEFINER) to prevent privilege escalation
- **Suspended Accounts:** Suspended users cannot perform any transition actions
- **No Direct Inserts:** Profile inserts are blocked by RLS — only `register_profile()` can create them

---

## Responsive Design

- **Desktop:** Full sidebar layout with all features visible
- **Tablet:** Collapsible sidebar, adjusted grid layouts
- **Mobile:** Hamburger menu sidebar, single-column layouts, touch-optimized buttons
- All dashboards, forms, tables, and modals are responsive
- QR scanner works with mobile device cameras

---

## Future Scope

- Food image upload via Supabase Storage
- Email and push notifications
- Expiry-based auto-cancellation (scheduled job)
- Analytics dashboard with charts
- Multi-language support
- Mobile app (React Native)
- Delivery route optimization
- Rating system for volunteers and restaurants
