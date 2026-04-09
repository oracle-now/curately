# Data Model

## Tables

### users
```sql
id             UUID PRIMARY KEY DEFAULT gen_random_uuid()
email          TEXT UNIQUE NOT NULL
password_hash  TEXT NOT NULL
created_at     TIMESTAMPTZ DEFAULT now()
updated_at     TIMESTAMPTZ DEFAULT now()
```

### instagram_accounts
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id           UUID REFERENCES users(id) ON DELETE CASCADE
ig_user_id        TEXT UNIQUE NOT NULL
access_token      TEXT NOT NULL
token_expires_at  TIMESTAMPTZ NOT NULL
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

### sources
```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id     UUID REFERENCES users(id) ON DELETE CASCADE
type        TEXT NOT NULL  -- 'instagram' | 'tumblr' | 'hashtag'
value       TEXT NOT NULL  -- e.g. '@handle', '#tag', 'blog-name'
rss_url     TEXT NOT NULL  -- RSS.app feed URL
active      BOOLEAN DEFAULT true
last_synced_at  TIMESTAMPTZ
is_stale    BOOLEAN DEFAULT false
created_at  TIMESTAMPTZ DEFAULT now()
```

### post_candidates
```sql
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id          UUID REFERENCES users(id) ON DELETE CASCADE
source_id        UUID REFERENCES sources(id) ON DELETE CASCADE
external_id      TEXT NOT NULL  -- guid/link from RSS item
media_urls       JSONB NOT NULL  -- array of image/video URLs
original_caption TEXT
taken_at         TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT now()
UNIQUE (user_id, source_id, external_id)
```

### caption_profiles
```sql
id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id       UUID REFERENCES users(id) ON DELETE CASCADE
name          TEXT NOT NULL
style_config  JSONB NOT NULL
-- style_config shape:
-- { tone: string, length: 'short'|'medium'|'long',
--   use_emoji: boolean, hashtag_count: number,
--   hashtag_strategy: string, custom_instructions: string }
created_at    TIMESTAMPTZ DEFAULT now()
```

### queue_items
```sql
id                   UUID PRIMARY KEY DEFAULT gen_random_uuid()
user_id              UUID REFERENCES users(id) ON DELETE CASCADE
post_candidate_id    UUID REFERENCES post_candidates(id) ON DELETE CASCADE
caption_profile_id   UUID REFERENCES caption_profiles(id)
status               TEXT NOT NULL DEFAULT 'queued'
-- 'queued' | 'caption_ready' | 'scheduled' | 'posting' | 'posted' | 'failed'
caption_text         TEXT
hashtags             JSONB  -- string[]
scheduled_at         TIMESTAMPTZ
error_message        TEXT
created_at           TIMESTAMPTZ DEFAULT now()
updated_at           TIMESTAMPTZ DEFAULT now()
```

### post_jobs
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
queue_item_id     UUID REFERENCES queue_items(id) ON DELETE CASCADE
ig_account_id     UUID REFERENCES instagram_accounts(id)
scheduled_at      TIMESTAMPTZ NOT NULL
last_attempt_at   TIMESTAMPTZ
attempt_count     INT DEFAULT 0
status            TEXT NOT NULL DEFAULT 'pending'
-- 'pending' | 'running' | 'success' | 'failed'
ig_media_id       TEXT  -- returned by Meta API on success
created_at        TIMESTAMPTZ DEFAULT now()
updated_at        TIMESTAMPTZ DEFAULT now()
```

### api_rate_limits
```sql
id                UUID PRIMARY KEY DEFAULT gen_random_uuid()
ig_account_id     UUID REFERENCES instagram_accounts(id)
call_count        INT DEFAULT 0
window_start      TIMESTAMPTZ NOT NULL
created_at        TIMESTAMPTZ DEFAULT now()
-- reset window_start + call_count every hour
```
