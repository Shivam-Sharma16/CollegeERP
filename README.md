# College ERP — Multi-Tenant Campus Management System

An enterprise-grade, multi-tenant College ERP platform built on a Node.js microservices architecture, MongoDB distributed databases, Redis caching, and a React (Vite) single-page application.

---

## Architecture Overview

```
                      Browser Clients
                             │
       ┌─────────────────────┴─────────────────────┐
       ▼                                           ▼
Root Management Domain                     Tenant Subdomains
(e.g. http://localhost:5173/superadmin)    (e.g. http://apex-tech.localhost:5173)
       │                                           │
       └─────────────────────┬─────────────────────┘
                             ▼
                    API Gateway (:4000)
             [TenantResolver & CORS Policy]
                             │
     ┌───────────────┬───────┴───────┬───────────────┐
     ▼               ▼               ▼               ▼
Auth Service    User Service    Academic Service  Notice Service
   (:4001)         (:4002)          (:4003)          (:4007)
     ▼               ▼               ▼               ▼
 [MongoDB]       [MongoDB]       [MongoDB]       [MongoDB]
```

### Key Multi-Tenancy Principles
1. **Subdomain-Based Tenant Routing**: Each tenant (college/university) has an isolated subdomain (e.g. `apex-tech.localhost`, `beacon-eng.localhost`, or production `apex-tech.collegeerp.com`).
2. **Gateway-Level Tenant Resolution**: The API Gateway reads the `Host` (or `x-forwarded-host`) header, extracts the subdomain, looks up the tenant in MongoDB (cached in Redis with 5-min TTL), and injects verified `x-tenant-id` and `x-tenant-subdomain` headers into all downstream microservice proxies.
3. **Database Scoping**: Every domain model (users, departments, courses, subjects, sections, notices, fee structures, marks, attendance records) is strictly scoped by `institutionId`.
4. **Root Platform SuperAdmin**: Accessing the root domain without a subdomain (e.g. `http://localhost:5173/superadmin`) routes to the platform-wide SuperAdmin cockpit (`institutionId: null`), where operators can provision, monitor, and suspend institutions.

---

## Local Development Setup

### 1. Prerequisites
- **Node.js**: v18 or higher (v20+ recommended)
- **npm**: v9 or higher
- **MongoDB**: Local instance (`mongodb://localhost:27017`) or MongoDB Atlas cluster URI
- **Redis** (Optional): Local instance (`redis://127.0.0.1:6379`) for gateway cache

### 2. Installation
Clone the repository and install dependencies across all workspaces:
```bash
git clone https://github.com/Shivam-Sharma16/CollegeERP.git
cd CollegeERP
npm install
```

### 3. Environment Configuration
Ensure `.env` files are configured in each service. At a minimum, set `MONGO_URI` and `JWT_ACCESS_SECRET` in `services/user-service/.env`, `services/auth-service/.env`, and `services/gateway/.env`.

---

## Multi-Tenant Seeding (Phase 73)

Run the automated multi-tenant seeder to instantiate **2 distinct test institutions** with overlapping data specifically designed to test tenant boundaries:

```bash
npm run seed:multi-tenant
```

### What Gets Provisioned:
- **Root SuperAdmin**: Global platform operator (`institutionId: null`).
- **Institution 1 (Apex Institute of Technology)**: `subdomain: apex-tech`, Code: `AIT`.
- **Institution 2 (Beacon College of Engineering)**: `subdomain: beacon-eng`, Code: `BCE`.
- **Full Role Accounts per Tenant**: Admin, HOD, Faculty, and Student accounts.
- **Overlapping Data for Boundary Testing**:
  - **Identical Departments**: Both institutions have a department named `Computer Science & Engineering` (Code: `CSE`) and `Mechanical Engineering` (Code: `ME`).
  - **Identical Course Codes**: Both institutions offer subject `CS101` (*Data Structures & Algorithms*) and `CS102` (*Database Management Systems*).
  - **Distinct Campus Notices**: Each campus has an announcement with overlapping tags to verify notice scoping.
  - **Contrasting Tuition Fees**: Year 2 CSE tuition is set to **$55,000** for Apex vs **$48,000** for Beacon.

---

## Local Subdomain Workflow (`*.localhost`)

### How `*.localhost` Works
Modern web browsers (Chrome, Edge, Firefox, Brave) natively resolve any subdomain of `.localhost` (e.g. `apex-tech.localhost`, `beacon-eng.localhost`) to the loopback address `127.0.0.1` per [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761). **No `/etc/hosts` modifications or DNS proxies are required.**

The Vite development server and API Gateway automatically handle `x-forwarded-host` routing for all `*.localhost` requests.

### Access URLs & Test Credentials Matrix

All test accounts share the default password: **`Password123!`**

| Portal / Campus | URL | Role | Email | Password |
| :--- | :--- | :--- | :--- | :--- |
| **Root SuperAdmin** | `http://localhost:5173/superadmin` | **SUPERADMIN** | `superadmin@collegeerp.com` | `Password123!` |
| **Apex Institute** | `http://apex-tech.localhost:5173/login` | **ADMIN** | `admin@apex.edu` | `Password123!` |
| Apex Institute | `http://apex-tech.localhost:5173/login` | **HOD** | `hod.cs@apex.edu` | `Password123!` |
| Apex Institute | `http://apex-tech.localhost:5173/login` | **FACULTY** | `faculty.cs@apex.edu` | `Password123!` |
| Apex Institute | `http://apex-tech.localhost:5173/login` | **STUDENT** | `student.cs@apex.edu` | `Password123!` |
| **Beacon College** | `http://beacon-eng.localhost:5173/login` | **ADMIN** | `admin@beacon.edu` | `Password123!` |
| Beacon College | `http://beacon-eng.localhost:5173/login` | **HOD** | `hod.cs@beacon.edu` | `Password123!` |
| Beacon College | `http://beacon-eng.localhost:5173/login` | **FACULTY** | `faculty.cs@beacon.edu` | `Password123!` |
| Beacon College | `http://beacon-eng.localhost:5173/login` | **STUDENT** | `student.cs@beacon.edu` | `Password123!` |

---

## Cross-Tenant Isolation Manual Testing Guide

To manually verify that tenant isolation is strictly enforced across the system, perform the following verification workflow:

### Step 1: Open Two Browser Tabs
- **Tab A**: `http://apex-tech.localhost:5173/login`
- **Tab B**: `http://beacon-eng.localhost:5173/login`

### Step 2: Test Authentication Isolation (Cross-Tenant Login Rejection)
1. In **Tab A** (`apex-tech`), try logging in with `admin@beacon.edu` / `Password123!`.
   - **Expected Result**: **401 Unauthorized (`Invalid credentials`)**. Beacon credentials are not recognized on the Apex tenant portal.
2. In **Tab B** (`beacon-eng`), log in with `admin@beacon.edu` / `Password123!`.
   - **Expected Result**: **Login succeeds**. The Beacon whitelabeled header and theme appear.

### Step 3: Test Data Boundary Scoping (Overlapping Data Verification)
1. In **Tab A**, log in as `student.cs@apex.edu`.
2. In **Tab B**, log in as `student.cs@beacon.edu`.
3. Check **Notices**:
   - Tab A displays `"Mid-Term Examination Schedule - Apex Campus"`.
   - Tab B displays `"Mid-Term Examination Schedule - Beacon Campus"`.
   - Neither student can see the other campus's notice.
4. Check **Fees Policy**:
   - Tab A displays **$55,000** for Year 2 CSE tuition.
   - Tab B displays **$48,000** for Year 2 CSE tuition.
5. Check **Subjects**:
   - Both students see code `CS101`, but their faculty instructor and attendance records belong exclusively to their respective institutions.

### Step 4: Test Root SuperAdmin Global Cockpit
1. Open a new tab at `http://localhost:5173/superadmin`.
2. Log in with `superadmin@collegeerp.com` / `Password123!`.
3. **Verify Dashboard Metrics**:
   - Stat cards show platform-wide cumulative metrics (Total Institutions: 2+, Total Students, Total Admins).
   - Institution cards for both *Apex Institute of Technology* and *Beacon College of Engineering* appear in the grid with clickable direct portal links (`/inst/<subdomain>/login`).
   - Toggle an institution status (e.g. suspend Beacon).
   - Attempting to access `http://beacon-eng.localhost:5173/login` immediately returns a suspension warning, while Apex remains active and unaffected.

---

## How to Provision a New Local Test Institution

### Method A: Via the SuperAdmin UI
1. Navigate to `http://localhost:5173/superadmin`.
2. Click **"+ Create Institution"** in the top right.
3. Fill in:
   - **Institution Name**: e.g. `Horizon State University`
   - **Campus Code**: automatically generated (e.g. `HSU`)
   - **Subdomain URL**: auto-derives `horizon-state-university` (validated in real-time with debounced availability indicator)
   - **Admin Name & Email**: e.g. `admin@horizon.edu`
   - **Initial Password**: generated temporary key
   - **Branding** *(Optional)*: pick primary and secondary theme colors.
4. Click **"Launch Institution"**.
5. Immediately visit `http://horizon-state-university.localhost:5173/login` in your browser.

### Method B: Via the Multi-Tenant Seeder
To permanently add an institution to the seed data, add an entry to `institutionsDef` and `tenantUsersDef` in `infra/scripts/seed-multi-tenant.js` and re-run:
```bash
npm run seed:multi-tenant
```

---

## Scripts & CLI Commands

| Command | Description |
| :--- | :--- |
| `npm run dev:all` | Starts all 10 microservices and Vite frontend concurrently |
| `npm run dev:backend` | Starts all 10 microservices and API Gateway concurrently |
| `npm run dev:web` | Starts the Vite web application on port 5173 |
| `npm run dev:gateway` | Starts the API Gateway on port 4000 |
| `npm run seed:multi-tenant` | Seeds 2 test institutions with overlapping data & test users |
| `npm run migrate:tenancy` | Backfills `institutionId` across all microservices |
| `npm test` | Runs unit test suites across all workspaces |
| `npm run build` | Compiles production bundles across workspaces |