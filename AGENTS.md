# Callendly - Agent Instructions

## Project Structure

- `backend/` - Node.js/Express API (port 5050)
- `frontend/` - Next.js 14 App Router (port 3000)
- `docker-compose.yml` - PostgreSQL + Redis (production)

## Quick Start

```bash
# Backend (uses SQLite for development)
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

Backend runs on http://localhost:5050, Frontend on http://localhost:3000.

## Environment

Backend `.env`:
- `DATABASE_URL=file:./dev.db` (SQLite for dev)
- For PostgreSQL: `postgresql://postgres:postgres@localhost:5432/callendly`
- `PORT=5050`
- `JWT_SECRET=your-super-secret-key`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` for Google OAuth
- `RESEND_API_KEY` for email notifications
- `FRONTEND_URL=http://localhost:3000`

## Database

Uses SQLite for development (file: `backend/prisma/dev.db`).
For production, switch `prisma/schema.prisma` to `postgresql` and update `DATABASE_URL`.

After schema changes:
- `npx prisma migrate dev --name <name>`
- `npx prisma generate`

## Ports

- Backend API: 5050
- Frontend dev: 3000
- PostgreSQL: 5432 (when using Docker)
- Redis: 6379 (when using Docker)

## Demo Account

- Email: `demo@callendly.app`
- Password: `password123`

## Tech Stack

Backend: Node.js, Express, Socket.io, Prisma, SQLite/PostgreSQL, JWT, Passport (Google OAuth), Resend, node-cron.
Frontend: Next.js 14, TypeScript, Tailwind CSS, date-fns, axios, socket.io-client.

## API Routes

- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Google OAuth
- `GET/PUT /api/profile` - Profile management
- `GET /api/users/:username/public` - Public profile
- `GET/POST/DELETE /api/calendars` - Calendar connections
- `GET/POST/PUT/DELETE /api/event-types` - Event types CRUD
- `GET /api/event-types/:username/:slug/public` - Public event type
- `GET/POST /api/availability` - Availability rules
- `GET /api/availability/:username/:slug/slots?date=YYYY-MM-DD` - Available time slots
- `GET/POST /api/bookings` - Bookings
- `PUT /api/bookings/:id/cancel` - Cancel booking
- `PUT /api/bookings/:id/reschedule` - Reschedule booking
