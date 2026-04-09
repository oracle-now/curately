# Curately

> ADHD-friendly Instagram curation and scheduling cockpit.

Ingest posts from Instagram, Tumblr, and other sources → visually pick what you love → AI-generates captions in your voice → publishes to your Instagram on a smart schedule.

---

## Product Vision

- **Inspiration feed**: RSS-powered scrollable feed from chosen IG accounts, hashtags, Tumblr blogs.
- **Queue**: curated posts ready to be captioned, scheduled, and posted.
- **AI Captions**: style-matched captions + hashtags generated per your voice profile.
- **Publishing**: official Meta Graph API integration for scheduling and posting.

---

## Monorepo Structure

```
curately/
├── apps/
│   ├── web/          # Next.js 14 frontend (React + TypeScript)
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

---

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start local services (Postgres + Redis)
docker-compose up -d

# Run DB migrations
npm run db:migrate

# Start dev servers
npm run dev
```

---

## Roadmap

### v0.1 — Foundation
- [ ] Monorepo setup (Next.js + Fastify + Prisma)
- [ ] Auth (signup/login, sessions)
- [ ] DB schema (users, sources, post_candidates, queue_items)

### v0.2 — Ingestion
- [ ] RSS.app integration
- [ ] IngestionService (poll feeds → post_candidates)
- [ ] Feed staleness detection
- [ ] Inspiration feed UI

### v0.3 — Queue + AI Captions
- [ ] Queue UI
- [ ] QueueService (state machine)
- [ ] CaptionService (OpenAI + style profiles)
- [ ] Caption review/edit UI

### v0.4 — Publishing
- [ ] Meta OAuth (connect IG account)
- [ ] PublishingService (container create + publish)
- [ ] RateLimitService (200 calls/hr tracking)
- [ ] Manual fallback if publish fails

### v0.5 — ADHD UX Polish
- [ ] Feed staleness warnings
- [ ] One-click "Post next slot"
- [ ] Scheduling windows config
- [ ] Mobile-responsive layout

### v1.0 — Public Launch Ready
- [ ] Multi-user support
- [ ] Billing (Stripe)
- [ ] Onboarding flow
- [ ] Analytics (posts/week, consistency)
