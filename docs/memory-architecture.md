# Curately Memory Architecture

> Reference: [MemPalace](https://github.com/milla-jovovich/mempalace) by milla-jovovich --
> the highest-scoring AI memory system ever benchmarked (96.6% LongMemEval R@5, local, free).
> Curately's memory layer adapts the palace architecture for Instagram curation.

## Why Memory Matters Here

Every time a user generates captions, curates posts, or adjusts scheduling,
they are implicitly training a style. Without memory, Curately starts from zero
every session. With memory, caption tone compounds, source quality signals
accumulate, and curation preferences sharpen the AI's scoring over time.

The goal: **170 tokens of loaded context at caption-generation time that make
the AI feel like it already knows the account.**

---

## Palace Architecture (mapped to Curately)

MemPalace uses: Wing -> Room -> Closet -> Drawer
Curately uses:  Wing -> Room ->          Drawer  (closet = future vector layer)

```
WING  = Instagram account (instagramAccountId)
          |
          +-- ROOM: room_caption_style    (tone, hooks, emoji use, CTA patterns)
          +-- ROOM: room_source_prefs     (which sources produce high-quality picks)
          +-- ROOM: room_curation_prefs   (what the user tends to approve / skip)
          +-- ROOM: room_schedule_prefs   (best times, cadence, frequency)
          +-- ROOM: room_decisions        (explicit choices the user has locked in)
                      |
                      +-- DRAWER (verbatim memory record in Postgres)
                      +-- DRAWER
                      +-- DRAWER ...
```

### Concepts

| MemPalace term | Curately mapping | Implementation |
|---|---|---|
| Wing | Instagram account | `instagramAccountId` string |
| Room | Memory domain | `room` enum column in `memory_drawers` |
| Drawer | Verbatim memory record | `MemoryDrawer` row in Postgres |
| Closet | Search index / summary | Future: pgvector embeddings |
| Hall | Memory type corridor | Encoded in room name prefix |
| Wake-up (L0+L1) | Caption generation context | `wakeUp(wingId)` in `palace.ts` |

---

## Storage

All drawers live in **Postgres** via the `MemoryDrawer` Prisma model (`memory_drawers` table).
No extra infrastructure dependency -- Postgres is already the system of record.

```sql
memory_drawers
  id         UUID PRIMARY KEY
  wing_id    TEXT NOT NULL          -- instagramAccountId
  room       TEXT NOT NULL          -- room_caption_style | ...
  content    TEXT NOT NULL          -- verbatim, never summarised
  tags       TEXT[] DEFAULT '{}'    -- for lightweight filtering
  created_at TIMESTAMP DEFAULT NOW()

INDEX (wing_id, room)  -- fast palace queries
INDEX (wing_id)        -- fast wing-level wake-up
```

### Why not ChromaDB (like MemPalace)?

MemPalace uses ChromaDB for semantic vector search because it runs locally
without any cloud dependency. Curately already has Postgres as a cloud
dependency on Railway, so the incremental cost of adding a vector store is
higher. We start with verbatim Postgres storage and tag-based retrieval --
which is sufficient for structured memory rooms -- and add pgvector or an
external embedding store only when semantic closet-level search is needed.

**The MemPalace raw-mode result (96.6% recall) comes from verbatim storage +
semantic search. Our MVP uses verbatim storage + structured room retrieval,
which is sufficient for caption style and preference memory.**

---

## Memory Stack (L0 + L1 at caption generation time)

| Layer | What | Size target | When |
|---|---|---|---|
| L0 | Account identity (wing name, IG handle) | ~20 tokens | Always |
| L1 | Critical facts (style, prefs, decisions) | ~150 tokens | Always |
| L2 | Room recall (recent session decisions) | On demand | When topic comes up |

`wakeUp(wingId)` in `palace.ts` loads L0 + L1. It fires on every caption
generation request and injects the result into the system prompt before the
AI writes. Keep the output under 200 tokens.

---

## Write Paths

### 1. Caption generation feedback
After a user edits or approves a generated caption, record what changed:
```ts
await addDrawer(igAccountId, 'room_caption_style',
  'User shortened the hook to one sentence and removed all emoji', ['hook', 'length'])
```

### 2. Source approval patterns
When a user approves N posts in a row from a source:
```ts
await addDrawer(igAccountId, 'room_source_prefs',
  'Source @naturephotography consistently produces high-approval picks', ['source'])
```

### 3. Explicit decisions
When a user makes a deliberate configuration choice:
```ts
await recordDecision(igAccountId,
  'User set posting cadence to 3x/week, Tuesday/Thursday/Saturday at 9am PST',
  ['schedule', 'cadence'])
```

---

## Deduplication

`addDrawer` checks for exact content matches before inserting.
This prevents the same memory being written on every request.
Future: semantic dedup using embeddings (detect near-duplicate memories).

---

## Future: Closet Layer (Semantic Search)

When the memory volume grows large enough that tag-based retrieval misses
relevant records, add a closet layer:

1. Add `pgvector` extension to Postgres
2. Add `embedding vector(1536)` column to `memory_drawers`
3. Generate embeddings on write using OpenAI `text-embedding-3-small` or a
   local model
4. Switch `searchDrawers` to cosine similarity search
5. Keep verbatim content in the drawer -- embeddings are the closet index only

This mirrors exactly how MemPalace uses ChromaDB: the embedding is the closet
(a fast findable index), the verbatim text is the drawer (what gets returned
and injected into the prompt).

---

## Files

| File | What |
|---|---|
| `packages/memory/src/palace.ts` | Core memory API: `addDrawer`, `searchDrawers`, `wakeUp`, `recordDecision` |
| `packages/db/schema.prisma` | `MemoryDrawer` model + indexes |
| `docs/memory-architecture.md` | This file |

---

## Reference

- MemPalace: https://github.com/milla-jovovich/mempalace
- MemPalace palace architecture: wings, rooms, closets, drawers
- LongMemEval benchmark: 96.6% R@5 in raw verbatim mode, zero API calls
- Key insight: store everything verbatim, retrieve with structure -- never
  summarise or extract, because that is where recall is lost
