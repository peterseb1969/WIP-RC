# RC-Console

A React + TypeScript admin console for WIP (World In a Pie). Replaces the existing Vue 3 console with a modern stack, adds direct infrastructure inspection (PostgreSQL, MongoDB, NATS), referential integrity checks, and a natural language query interface powered by Claude.

## What the user sees

- **Dashboard** — service health cards (6 microservices), namespace stats, recent activity
- **Data pages** — Namespaces, Terminologies (with term management), Templates (field inspector), Documents (template selector + detail), Files, Registry (search + JSON viewer)
- **Infrastructure** — PostgreSQL table browser + SQL query pad, MongoDB collection browser + document inspector, NATS stream/consumer monitoring
- **Health** — Integrity checks (cross-service referential integrity), Activity (audit trail)
- **NL Query** — Chat interface for natural language data exploration via Claude API

## How to run

```bash
# Install dependencies (libs are local tarballs)
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env — at minimum, WIP_BASE_URL and WIP_API_KEY

# Start dev server (Express + Vite concurrently)
npm run dev

# Open in browser
open http://localhost:5173
```

The Express backend runs on port 3010. Vite proxies `/wip`, `/api`, `/health`, and `/auth` to it.

### Production

```bash
npm run build         # Vite build → dist/
npm start             # Express serves dist/ + API
```

Or with Docker:

```bash
docker build -t rc-console .
docker run -p 3010:3010 --env-file .env rc-console
```

## Environment variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `WIP_BASE_URL` | Yes | WIP Caddy gateway URL | `https://localhost:8443` |
| `WIP_API_KEY` | Yes | API key with admin access | `dev_master_key_for_testing` |
| `MONGO_URI` | No | MongoDB connection string (for infra views) | `mongodb://localhost:27017/` |
| `NATS_URL` | No | NATS server URL (for infra views) | `nats://localhost:4222` |
| `ANTHROPIC_API_KEY` | No | Claude API key (for NL Query) | `sk-ant-...` |
| `PORT` | No | Express server port (default 3010) | `3010` |
| `OIDC_ISSUER` | No | Dex OIDC issuer URL (enables auth) | `http://localhost:5556/dex` |
| `OIDC_CLIENT_ID` | No | OIDC client ID | `wip-apps` |
| `OIDC_CLIENT_SECRET` | No | OIDC client secret | `wip-apps-secret` |
| `SESSION_SECRET` | No | Express session secret | (random string) |
| `ALLOWED_GROUPS` | No | Comma-separated Dex groups for access control | `wip-admins` |

## WIP prerequisites

RC-Console inspects WIP itself — it does not require specific terminologies or templates. It works with whatever data model exists in the connected WIP instance.

## Tech stack

| Concern | Choice |
|---------|--------|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Data fetching | TanStack Query v5, @wip/react hooks |
| Routing | React Router v7 |
| Backend | Express 5, @wip/proxy |
| Infra connections | mongodb (npm), nats (npm) |
| NL Query | @anthropic-ai/sdk, Claude Sonnet |
| Markdown | react-markdown, remark-gfm |
| Testing | Vitest, Testing Library |

## Tests

```bash
npm test          # Run once
npm run test:watch  # Watch mode
```

35 tests across 2 suites: UI component tests and NL query tool validation.
