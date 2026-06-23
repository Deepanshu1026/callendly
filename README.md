# Callendly - Open Scheduling Platform

A modern, open-source scheduling platform built for professionals and teams.

## Features (Phase 1 MVP)

- User signup & login (password + Google OAuth)
- Profile management with timezone and custom username
- Public booking pages with custom links
- Event types (15 min, 30 min, 60 min, custom)
- Availability rules with working days/hours
- Calendar integration (Google Calendar, Outlook)
- Booking system with double-booking prevention
- Dashboard with upcoming/past meetings
- Cancel and reschedule meetings
- Email notifications (confirmation, cancellation, reschedule)

## Tech Stack

- **Backend:** Node.js, Express, Socket.io, JWT, Prisma, PostgreSQL
- **Frontend:** Next.js 14, Tailwind CSS, TypeScript
- **Queue:** Redis (for future BullMQ use)
- **Email:** Resend
- **Calendar APIs:** Google Calendar API, Microsoft Graph API

## Quick Start

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL & Redis)

### 1. Start Database & Redis

```bash
docker-compose up -d
```

### 2. Setup Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Backend will run on `http://localhost:5000`

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will run on `http://localhost:3000`

### Demo Account

- **Email:** `demo@callendly.app`
- **Password:** `password123`

## API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Profile
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/users/:username/public`

### Calendars
- `GET /api/calendars`
- `POST /api/calendars`
- `DELETE /api/calendars/:id`

### Event Types
- `GET /api/event-types`
- `POST /api/event-types`
- `PUT /api/event-types/:id`
- `DELETE /api/event-types/:id`
- `GET /api/event-types/:username/:slug/public`

### Availability
- `GET /api/availability`
- `POST /api/availability`
- `GET /api/availability/:username/:slug/slots`

### Bookings
- `GET /api/bookings`
- `POST /api/bookings/:username/:slug`
- `PUT /api/bookings/:id/cancel`
- `PUT /api/bookings/:id/reschedule`

## Roadmap

- **Phase 2:** Group meetings, video integrations (Meet, Zoom, Teams), advanced buffers, team workspaces, custom forms, routing, reminders, website embeds, analytics, webhooks, Zapier, Slack
- **Phase 3:** Payments (Stripe, Razorpay, PayPal, UPI), CRM, AI features, automation workflows, multi-workspace, SSO, audit logs

## License

MIT
