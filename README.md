# Tellect Campus — Waitlist Landing Page

Waitlist capture page for **Tellect Campus**, the LMS being built for the
Federal University of Technology, Akure (FUTA).

## Stack

| Piece | Tech |
|-------|------|
| Frontend | Static HTML/CSS/JS (no build step) |
| Backend | Node.js + Express |
| Database | PostgreSQL (Render managed) |

## Project structure

```
.
├── backend/
│   ├── package.json      # backend deps + start script
│   └── server.js         # Express API + static file server
├── index.html            # landing page (served by the backend)
├── package.json          # root manifest (used when Root Directory = repo root)
├── package-lock.json
├── color_coding.png
└── tellect_logo.jpeg
```

## Render deployment

This service can be deployed two ways — **both are tested**.

### Option A — Root Directory: `backend`

| Setting | Value |
|---------|-------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `node server.js` |

### Option B — Root Directory: *(empty)*

| Setting | Value |
|---------|-------|
| Root Directory | *(leave empty)* |
| Build Command | `npm install` |
| Start Command | `node backend/server.js` |

### Environment variables

| Key | Value | Required |
|-----|-------|----------|
| `DATABASE_URL` | `postgresql://user:pass@host:port/db` | Yes (Postgres persistence) |
| `PORT` | `3000` | No (Render assigns it) |

> The backend auto-creates the `waitlist_emails` table on boot, so no manual
> migration step is required. If Postgres is unreachable it logs a warning and
> falls back to in-memory storage (data is lost on redeploy).

## API

### `POST /api/waitlist`

```json
{ "email": "student@futa.edu.ng" }
```

| Status | Meaning |
|--------|---------|
| `201` | Added to the waitlist |
| `400` | Invalid email |
| `409` | Already on the waitlist |
| `500` | Could not save |

### `GET /api/waitlist`

Returns every captured email (admin use).

```json
{
  "count": 2,
  "usingPostgres": true,
  "emails": ["a@futa.edu.ng", "b@futa.edu.ng"],
  "records": [{ "email": "a@futa.edu.ng", "created_at": "..." }]
}
```

### `GET /api/health`

```json
{ "status": "ok", "usingPostgres": true }
```

### `DELETE /api/waitlist`

Clears the waitlist.

## Database schema

```sql
CREATE TABLE IF NOT EXISTS waitlist_emails (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

Query it directly:

```bash
psql "$DATABASE_URL" -c "SELECT * FROM waitlist_emails ORDER BY created_at DESC;"
```

## Local development

```bash
npm install
npm start           # http://localhost:3000
```

Or with the backend directory as the working root:

```bash
cd backend && npm install && npm start
```

## Design

Colours come from the Tellect brand palette, matching the main tellect website:

| Token | Hex | Use |
|-------|-----|-----|
| `--color-tellect-accent` | `#b8f21c` | CTAs, links, highlights |
| `--color-tellect-dark` | `#004b24` | Dark sections, text |
| `--color-tellect-green` | `#008001` | Secondary green |
| `--color-tellect-teal` | `#00a86b` | Teal-green accent |
| `--color-tellect-bright` | `#70e000` | Bright green accent |
| `--color-tellect-light` | `#6cfa67` | Light green accent |
| `--color-tellect-offwhite` | `#f5f5f5` | Section backgrounds |
| `--color-tellect-gray` | `#333333` | Body text |

Typography: **Poppins** for headings and UI, **Instrument Serif** for editorial accents.
