# Wedding Platform Backend

A production-ready, strict Hono + Turso backend for the Wedding SaaS.

## Stack
- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js
- **Database**: Turso (SQLite) with Drizzle ORM
- **Language**: TypeScript

## Directory Structure
- `api.ts`: Main entry point
- `db/`: Database schema and client
- `routes/`: Modular route handlers (`auth`, `admin`, `dashboard`, `invite`)
- `middleware/`: Auth and Role middleware
- `core/`: Shared logic (auth utils, config, email)
- `seed/`: Database seeding script

## Commands
- `npm install`: Install dependencies
- `npm run dev`: Start local development server
- `npm run deploy`: Deploy to Cloudflare Workers
- `npm run seed`: Seed the database with initial data

## API Endpoints
- `POST /auth/magic-link`: Request login
- `POST /auth/verify`: Verify login
- `GET /invite/:slug`: Public invitation view
- `POST /invite/:slug/rsvp`: Submit RSVP
- `GET /dashboard/*`: Protected User routes
- `GET /admin/*`: Protected Admin routes
