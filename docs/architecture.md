# Architecture

## Overview

Curately is a three-layer system:

1. **Frontend** (`apps/web`) — Next.js app: UI for inspiration, queue, settings.
2. **Backend** (`apps/api`) — Fastify API + BullMQ workers: business logic, integrations.
3. **Data** (`packages/db`) — PostgreSQL via Prisma: source of truth for all state.

External integrations stay at the edges and are abstracted behind service interfaces so providers can be swapped without touching product logic.

---

## Services

### AuthService
- User signup, login, session management.
- Issues JWTs; validates tokens on every API request.

### InstagramAuthService
- Meta OAuth 2.0 flow (redirect → callback → token exchange).
- Stores short-lived tokens, upgrades to long-lived tokens.
- Handles token refresh before expiry.
- Stores: `ig_user_id`, `access_token`, `token_expires_at`.

### SourceService
- CRUD for user-defined sources (IG handles, hashtags, Tumblr blogs).
- Each source holds its `rss_url` (RSS.app feed URL).

### IngestionService
- Polls each active source's `rss_url` on a schedule (every 15–30 min).
- Normalizes RSS items → `PostCandidate` records.
- Upserts by `(user_id, source_id, external_id)` — no duplicate posts.
- Detects feed staleness (>2h without update → flag source as stale).
- Provider-agnostic: swap RSS.app for another feed provider by changing the URL, not the logic.

### QueueService
- State machine for QueueItems:
  `queued → caption_ready → scheduled → posting → posted | failed`
- Enforces per-user posting rules (max posts/day, time windows).
- Creates PostJob records for the worker to execute.

### CaptionService
- Calls OpenAI GPT-4o with:
  - Original caption as context.
  - User's CaptionProfile (tone, length, emoji rules, hashtag strategy).
- Returns: caption text + hashtags.
- Stores caption draft on the QueueItem.

### PublishingService
- Wraps Meta Graph API Content Publishing endpoints.
- Two-step publish:
  1. Create media container (`POST /{ig-user-id}/media`).
  2. Publish container (`POST /{ig-user-id}/media_publish`).
- Polls container status before publishing.
- Marks PostJob as `success` or `failed`.
- Surfaces manual fallback if publish fails.

### RateLimitService
- Tracks all Meta API calls per IG account per hour.
- Hard ceiling: 200 calls/hour per account.
- Blocks publishing if within 10% of ceiling.
- Applies exponential backoff + jitter on all IG API errors.

---

## Worker Architecture

- **BullMQ** (Redis-backed) handles background jobs:
  - `ingestion-queue`: poll RSS feeds for each source.
  - `caption-queue`: generate AI captions for queued items.
  - `publish-queue`: execute scheduled PostJobs.
- Workers run as separate processes; can be scaled horizontally.
- All jobs have retry logic with exponential backoff.

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| RSS.app for ingestion | Instagram Basic Display API deprecated Dec 2024; official API cannot read arbitrary public posts |
| Backup ingestion provider | RSS.app can be unreliable; IngestionService is abstracted so Apify/SociaVault can be swapped in |
| BullMQ for jobs | Redis-backed, supports retries, delays, priorities; avoids cron-only limitations |
| Per-account rate limit tracking | Meta cut API rate limits to 200 calls/hr; must track all calls, not just posts |
| Manual fallback on publish fail | Meta Graph API docs are unreliable; always give user a manual escape hatch |
| All state in Postgres | Never depend on external provider state; RSS.app, Meta API are read/write only |
