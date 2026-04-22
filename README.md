# Incident Intelligence

A **demo-ready** full-stack app that combines a classic **incident / issue tracker** (list, detail, operational dashboard) with **retrieval-augmented assistance** for new issues.

**Incident Intelligence (RAG-style flow):** you describe a new or in-progress incident in plain language. The server **retrieves** the most relevant historical incidents from MongoDB (full-text search on title and description, with a **recent-fallback** when there is no strong text match), then **augments** a ChatGPT prompt with those records (including root cause and remediation when present). The model returns **actionable next steps**—triage, mitigation, communications, escalation—grounded in your org’s own history, not just generic advice.

## Project layout

```text
incident-intelligence/
  client/          # React (Vite) frontend
  server/          # Express + Mongoose API
  README.md
  .gitignore
```

**UI routes:** `/` incidents, `/dashboard` summary rollups, `/intelligence` the recommendation experience described above, `/incidents/:id` detail.

**Frontend naming:** the requested paths (for example `client/src/App.js`, `client/src/pages/IncidentListPage.js`) are present as small **re-export** modules. Files that contain **JSX** are implemented in matching `*.jsx` files so the Vite bundler can parse them; import from the `.js` name or the `.jsx` name as you prefer.

## Why MongoDB for this app

### Document model for incidents

Each **incident** is a natural document: a single record holds severity, status, owner, and **embedded** arrays for **timeline events** and **customer updates**. That matches how operations teams work: one incident page with an append-only narrative. You can `$push` new events and updates without JOIN-heavy schemas.

### Embedded vs referenced data

- **Embedded** (`timelineEvents`, `customerUpdates`): high-churn, incident-specific, always read with the incident. Good for one-document reads and ordered history.
- **Referenced** (`customerId`, `serviceIds`, `serviceIds[]`): shared, slowly changing data (**customers**, **service catalog**). Normalized in `customers` and `services` collections, linked by `ObjectId` for clean reporting and reuse.

This split is a standard MongoDB pattern: embed what’s owned by the parent document, reference what’s shared.

### Aggregations for dashboard reporting

The dashboard API uses **aggregation pipelines** (for example `$group` by severity, `$match` for open status, and `$lookup` to resolve customer names). This supports interview-style demos: explain stages in plain English, add `$facet` for multi-metric pages later.

### Indexes for operational queries

Defined in `server/models/Incident.js` and summarized here:

| Index | Purpose |
|--------|---------|
| `{ status, severity, openedAt }` | Default list: filter by state/urgency, sort by time |
| `{ customerId, status }` | Per-customer “what’s open?” views |
| `{ tags }` | Filter on incident tags (e.g. `api`, `auth`) |
| **Text** on `title` + `description` | `q=` search (uses `$text` when `?q=` is passed) |

**TODO in production:** review partial indexes, collation, and Atlas Performance Advisor after real traffic.

### Why MongoDB Atlas (future hooks)

- **Atlas Search** — Better full-text, fuzzy match, and faceted UIs on incident text than basic `$text` alone.
- **Vector Search** — semantic “similar incidents” over postmortems and long narrative text (the app currently uses MongoDB **$text** retrieval for similarity; see [Incident Intelligence (RAG-style)](#incident-intelligence-rag-style) in the API section).
- **Change Streams** — Real-time list/detail updates in the browser without polling.

## Prerequisites

- **Node.js** 18+
- A **MongoDB Atlas** cluster (or local MongoDB) and a connection string

## Environment variables

### Server (`server/.env`)

Copy from `server/.env.example`:

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Full MongoDB connection string (required) |
| `PORT` | API port (default **`5050`** — on macOS, **5000** is often used by AirPlay Receiver / Control Center) |
| `CLIENT_URL` | CORS origin for the React app (default `http://localhost:5173`) |
| `OPENAI_API_KEY` | **Required** for the recommendation API (`POST /api/intelligence/recommend`); the incident list, detail, and dashboard work without it (see [OpenAI](https://platform.openai.com/api-keys)) |
| `OPENAI_MODEL` | Optional model id (default **`gpt-4o-mini`**) |

### Client (optional, `client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | API origin (e.g. `http://localhost:5050`). Leave **unset** in dev to use the Vite **proxy** to the API. |

## Setup

From the `incident-intelligence` directory:

```bash
npm run install:all
```

Or install each package:

```bash
cd server && npm install
cd ../client && npm install
```

Create `server/.env` (see [Environment variables](#environment-variables)) with your `MONGODB_URI`.

## Seed the database

```bash
npm run seed
```

By default this now seeds **hundreds** of incidents: **3 customers**, **4 services**, plus realistic incident records suitable for search/RAG experiments.

Generate a specific amount:

```bash
npm run seed -- --count=500
```

The seed always includes the original 8 handcrafted incidents and adds synthetic incidents until it reaches your target count.

**Warning:** The seed is destructive for those collections. Use a dedicated dev/demo database in Atlas.

## Run the app

**Terminal 1 — API**

```bash
cd server
npm run dev
```

**Terminal 2 — client**

```bash
cd client
npm run dev
```

Or from the monorepo root (after `npm install` in the root for `concurrently`):

```bash
npm run dev
```

- UI: [http://localhost:5173](http://localhost:5173)  
- API: [http://localhost:5050/health](http://localhost:5050/health)

## API overview

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness / health |
| `GET` | `/api/incidents` | List with filters, pagination, sort (query: `severity`, `status`, `customerId`, `tag`, `q`, `dateFrom`, `dateTo`, `page`, `limit`, `order`) |
| `GET` | `/api/incidents/:id` | Detail by MongoDB `_id` |
| `POST` | `/api/incidents` | Create |
| `PATCH` | `/api/incidents/:id` | Update |
| `POST` | `/api/incidents/:id/timeline` | Append timeline event (`$push`) |
| `POST` | `/api/incidents/:id/customer-update` | Append customer update (`$push`) |
| `GET` | `/api/dashboard/summary` | Counts and rollups |
| `GET` | `/api/dashboard/by-severity` | Open incidents by severity |
| `GET` | `/api/dashboard/open-by-customer` | Open counts with customer names (`$lookup`) |
| `POST` | `/api/intelligence/recommend` | **Intelligence:** body `{ "description": "..." }` — returns `similarIncidents`, `matchKind` (`text` \| `recent`), `recommendation` (markdown-friendly text), `model` (requires `OPENAI_API_KEY`) |

### Incident Intelligence (RAG-style)

1. **Retrieve:** MongoDB `$text` search on the user’s description (up to 8 incidents, strongest match first). If nothing matches, the API uses a small set of **most recent** incidents as context so the model still has organizational examples.
2. **Augment:** The controller builds a prompt with the new description plus structured snippets from each similar incident (title, severity, description, root cause, remediation, customer).
3. **Generate:** OpenAI Chat Completions returns recommended next actions. The client shows **Context: similar incidents** (with links to detail) and **Recommended next actions** (rendered as Markdown).

## Next steps / future enhancements

- Pagination controls and deep links for list filters.  
- Authn/authz and audit trail for who changed an incident.  
- Postmortem workflow: templates, sign-off, **linked** action items.  
- **Vector embeddings** and Atlas Vector Search for semantic similarity (beyond keyword `$text`).  
- Atlas Search for richer full-text and faceted UIs.  
- **Change streams** to push incident updates to the React UI in real time.

---

## Suggested build & test order

1. Create Atlas cluster and `server/.env` with `MONGODB_URI`.  
2. Add `OPENAI_API_KEY` (and optionally `OPENAI_MODEL`) for the intelligence API.  
3. `npm run install:all` from `incident-intelligence`.  
4. `npm run seed` to load sample data.  
5. Start `server` (`npm run dev` in `server`); open `GET /health` and `GET /api/incidents`.  
6. Start `client`; verify list → detail → dashboard → **Incident Intelligence** (describe a scenario and confirm similar incidents + recommendations).  
7. Try `GET /api/incidents?q=login` to exercise the text index (after seed, indexes are created on app connect). Optionally `POST /api/intelligence/recommend` with a JSON body to test the API directly.

## Stretch features

- **Atlas Search** — rich search and facets on title, description, and tags.  
- **Semantic similar incidents** — vector embeddings and Atlas Vector Search to complement today’s keyword retrieval.  
- **Change streams** — live table and detail updates.  
- **Postmortem workflow** — structured fields, approvers, export.  
- **Authentication** — JWT or OIDC, tenant scoping, field-level access.
