/**
 * packages/memory/src/palace.ts
 *
 * Curately Memory Palace
 * ---------------------
 * A structured memory layer for Curately, inspired by the MemPalace palace
 * architecture (github.com/milla-jovovich/mempalace).
 *
 * Core idea: instead of starting from zero every AI session, Curately
 * remembers caption styles, source preferences, curation patterns, and
 * scheduling decisions -- and surfaces them when generating captions or
 * scoring post candidates.
 *
 * Architecture (maps directly to MemPalace concepts):
 *
 *   WING   = Instagram account (one per connected account)
 *   ROOM   = memory domain within a wing:
 *              - room_caption_style  : tone, hooks, emoji use, CTA patterns
 *              - room_source_prefs   : which sources produce high-quality picks
 *              - room_curation_prefs : what the user tends to approve / skip
 *              - room_schedule_prefs : best times, cadence, frequency
 *              - room_decisions      : explicit choices the user has made
 *   DRAWER = verbatim memory record (stored in Postgres via Prisma)
 *   CLOSET = summary index pointing to drawers (future: vector embeddings)
 *
 * Everything is stored in Postgres for now (no extra infra dependency).
 * When Curately grows a semantic search need, swap the closet layer to
 * pgvector or an external embedding store -- drawers stay verbatim in PG.
 */

import { prisma } from '@curately/db/src/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ROOMS = [
  'room_caption_style',
  'room_source_prefs',
  'room_curation_prefs',
  'room_schedule_prefs',
  'room_decisions',
] as const

export type Room = typeof ROOMS[number]

export interface MemoryRecord {
  id: string
  wingId: string   // instagramAccountId
  room: Room
  content: string  // verbatim text -- never summarised, always exact
  tags: string[]   // e.g. ['caption', 'hook', 'emoji']
  createdAt: Date
}

export interface MemoryQuery {
  wingId: string
  room?: Room
  tags?: string[]
  limit?: number
}

// ---------------------------------------------------------------------------
// Palace write -- add a drawer (verbatim memory record)
// ---------------------------------------------------------------------------

export async function addDrawer(
  wingId: string,
  room: Room,
  content: string,
  tags: string[] = [],
): Promise<MemoryRecord> {
  // Deduplicate: skip if exact same content already exists for this wing+room
  const existing = await prisma.memoryDrawer.findFirst({
    where: { wingId, room, content },
  })
  if (existing) return existing as unknown as MemoryRecord

  return prisma.memoryDrawer.create({
    data: { wingId, room, content, tags },
  }) as unknown as MemoryRecord
}

// ---------------------------------------------------------------------------
// Palace read -- retrieve drawers (simple keyword/tag search for now;
// replace closet layer with pgvector when semantic search is needed)
// ---------------------------------------------------------------------------

export async function searchDrawers(query: MemoryQuery): Promise<MemoryRecord[]> {
  const { wingId, room, tags, limit = 20 } = query

  return prisma.memoryDrawer.findMany({
    where: {
      wingId,
      ...(room ? { room } : {}),
      ...(tags?.length ? { tags: { hasSome: tags } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  }) as unknown as MemoryRecord[]
}

// ---------------------------------------------------------------------------
// Wake-up context (L0 + L1 equivalent)
// Loads critical facts for a wing into a compact string for AI prompt injection.
// Keep this under ~200 tokens -- it fires on every caption generation request.
// ---------------------------------------------------------------------------

export async function wakeUp(wingId: string): Promise<string> {
  const decisions = await searchDrawers({ wingId, room: 'room_decisions', limit: 5 })
  const captionStyle = await searchDrawers({ wingId, room: 'room_caption_style', limit: 3 })
  const sourcePref = await searchDrawers({ wingId, room: 'room_source_prefs', limit: 3 })

  const lines: string[] = [
    `## Curately Memory -- wing: ${wingId}`,
    '',
    '### Caption style',
    ...captionStyle.map(d => `- ${d.content}`),
    '',
    '### Source preferences',
    ...sourcePref.map(d => `- ${d.content}`),
    '',
    '### Recent decisions',
    ...decisions.map(d => `- ${d.content}`),
  ]

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Convenience: record a user decision (most common write path)
// ---------------------------------------------------------------------------

export async function recordDecision(
  wingId: string,
  decision: string,
  tags: string[] = [],
): Promise<MemoryRecord> {
  return addDrawer(wingId, 'room_decisions', decision, tags)
}
