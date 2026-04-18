# AGENTS.md — curately

> Auto-loaded by Codex, Cursor, Claude, and most AI coding agents.
> Read this entire file before touching any code.

---

## What This Repo Is

ADHD-friendly Instagram curation and scheduling cockpit.

- Ingest posts from RSS-powered sources (Instagram accounts, hashtags, Tumblr blogs)
- User picks posts they love from a scrollable inspiration feed
- AI generates captions in the user's voice profile
- Publishes to Instagram via the official Meta Graph API on a smart schedule

**Status:** Early build — v0.1 (Foundation) in progress. Most services are not yet wired together.

---

## Monorepo Structure

```
curately/
├── apps/
│   ├── web/          # Next.js 14 frontend (React + TypeScript + Tailwind)
│   └── api/          # Node.js + Fastify backend (TypeScript)
├── packages/
│   ├── shared/       # Shared TypeScript types and utilities
│   └── db/           # Prisma schema + migrations
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   └── api-contracts.md
└── docker-compose.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + React + TypeScript + Tailwind CSS |
| Backend | Node.js + Fastify + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue/Workers | BullMQ + Redis |
| AI Captions | OpenAI API (GPT-4o) |
| Ingestion | RSS.app (Developer plan) |
| Publishing | Meta Instagram Graph API |
| Auth | NextAuth.js / JWT |
| Deploy | Railway (docker-compose) |

---

## Critical Architecture Rules

### 1. Never bypass the queue for publishing
All Instagram publish operations MUST go through BullMQ. Never call the Meta Graph API
directly from a request handler. The queue enforces:
- Rate limit tracking (200 calls/hr per the Meta API limit)
- Retry logic on transient failures
- Ordered scheduling windows

### 2. Prisma is the only way to touch the DB
Never write raw SQL. All DB access goes through `packages/db`. If you need a query
Prisma can't express cleanly, add a raw query inside the db package — not scattered
in app code.

### 3. Shared types live in `packages/shared`
If a type is used by both `apps/web` and `apps/api`, it belongs in `packages/shared`.
Do not duplicate type definitions across apps.

### 4. Meta Graph API rate limits are hard walls
- 200 calls/hour per Instagram account
- Container create + publish = 2 calls per post
- RateLimitService (v0.4) must track remaining calls before any publish attempt
- If limit is close, queue the job for next window — never fire and hope

### 5. NextAuth session ≠ Meta OAuth token
The user's NextAuth session (login) is separate from their connected Instagram account
OAuth token. Both must be valid for publishing. Check both before any publish operation.

### 6. BullMQ job failures must be logged, not silently swallowed
Every failed job must write to the job's `failedReason`. The dashboard needs this to
surface errors to the user. Never catch and discard errors in worker handlers.

---

## Data Model Mental Map

```
User
 └── VoiceProfile (style preferences for AI captions)
 └── Source[] (RSS feeds / IG accounts to ingest from)
 └── PostCandidate[] (ingested posts, waiting to be curated)
 └── QueueItem[] (curated posts, moving through caption → schedule → publish)
 └── InstagramAccount (Meta OAuth token, rate limit state)
```

PostCandidate state: `ingested` → `curated` → `captioned` → `scheduled` → `published` | `failed`

QueueItem is the state machine owner — PostCandidate just holds the raw content.

---

## Service Boundaries

| Service | Owns | Does NOT own |
|---|---|---|
| IngestionService | Polling RSS, creating PostCandidates | Curating, captioning |
| QueueService | QueueItem state transitions | Caption generation, publishing |
| CaptionService | OpenAI calls, voice profile | Scheduling, queue state |
| PublishingService | Meta Graph API calls | Rate limit decisions |
| RateLimitService | Tracking + enforcing 200/hr | Actual API calls |

If you're adding a feature, identify which service owns it before writing any code.
Do not add cross-service logic in request handlers.

---

## ADHD UX Constraints (Non-Negotiable)

This product is built for ADHD users. Every UI decision must prioritize:

- **One primary action per screen.** No decision paralysis.
- **Progressive disclosure.** Never show more than the user needs right now.
- **Zero dead ends.** Every empty state has a warm message + a single action.
- **Instant feedback.** Every async action (caption gen, publish) shows a loading state
  within 100ms of user interaction.
- **Forgiving flows.** Destructive actions (delete post, disconnect IG) require
  confirmation. Everything else should be undoable or soft-deletable.

---

## Deferred Tech Debt (Do Not Implement Yet)

- Multi-user support (v1.0 milestone)
- Stripe billing (v1.0 milestone)
- Analytics dashboard (v1.0 milestone)
- Onboarding flow (v1.0 milestone)

If you find yourself building any of these before the v0.4 milestone is complete, stop.

---

## Pre-Ship Checklist

Before committing any change, verify:

- [ ] Does it touch the Meta API? → Rate limit guard in place
- [ ] Does it write to DB? → Goes through Prisma, migration included if schema changed
- [ ] Does it publish a post? → Routed through BullMQ, not direct
- [ ] Does it add a new type? → In `packages/shared` if cross-app, not duplicated
- [ ] Does it add a new UI screen? → One primary action per screen, empty state designed
- [ ] Does it touch auth? → NextAuth session AND Meta OAuth both checked if needed
- [ ] Worker error? → failedReason written, not silently caught
- [ ] Run `npm run build` from root — no TypeScript errors before pushing
