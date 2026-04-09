# API Contracts

All endpoints are prefixed with `/api/v1`.
All requests require `Authorization: Bearer <token>` unless marked public.

---

## Auth

### POST /auth/register (public)
Body: `{ email, password }`
Response: `{ token, user }`

### POST /auth/login (public)
Body: `{ email, password }`
Response: `{ token, user }`

---

## Instagram Account

### GET /instagram/connect
Redirects to Meta OAuth. Returns callback URL.

### GET /instagram/callback
Meta OAuth callback. Exchanges code for token, stores account.
Response: redirects to `/app/settings`

### GET /instagram/account
Response: `{ ig_user_id, token_expires_at, connected: boolean }`

---

## Sources

### GET /sources
Response: `Source[]`

### POST /sources
Body: `{ type: 'instagram'|'tumblr'|'hashtag', value: string, rss_url: string }`
Response: `Source`

### PATCH /sources/:id
Body: `{ active?: boolean }`
Response: `Source`

### DELETE /sources/:id
Response: `204`

---

## Post Candidates (Inspiration Feed)

### GET /candidates
Query: `?source_id=&limit=&cursor=`
Response: `{ items: PostCandidate[], nextCursor: string|null }`

---

## Queue

### GET /queue
Query: `?status=&limit=&cursor=`
Response: `{ items: QueueItem[], nextCursor: string|null }`

### POST /queue
Body: `{ post_candidate_id: string }`
Response: `QueueItem`

### POST /queue/:id/generate-caption
Body: `{ caption_profile_id?: string }`
Response: `QueueItem` (with caption_text + hashtags populated)

### PATCH /queue/:id
Body: `{ caption_text?, hashtags?, scheduled_at?, status? }`
Response: `QueueItem`

### POST /queue/:id/publish
Response: `PostJob`

### DELETE /queue/:id
Response: `204`

---

## Caption Profiles

### GET /caption-profiles
Response: `CaptionProfile[]`

### POST /caption-profiles
Body: `{ name, style_config }`
Response: `CaptionProfile`

### PATCH /caption-profiles/:id
Body: `{ name?, style_config? }`
Response: `CaptionProfile`

### DELETE /caption-profiles/:id
Response: `204`
