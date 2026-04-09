'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import CandidateCard from '@/components/CandidateCard';

export default function InspirationPage() {
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState<Set<string>>(new Set());

  const load = useCallback(async (nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.candidates.list({ cursor: nextCursor, limit: 20 });
      setItems((prev) => nextCursor ? [...prev, ...res.items] : res.items);
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleQueue(candidateId: string) {
    try {
      await api.queue.add(candidateId);
      setQueued((prev) => new Set(prev).add(candidateId));
    } catch (err: any) {
      // 409 = already queued — still mark as queued in UI
      if (err.message?.includes('already in your queue')) {
        setQueued((prev) => new Set(prev).add(candidateId));
      }
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Inspiration</h1>
        <p className="mt-1 text-sm text-neutral-400">Posts from your sources, ready to curate</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-neutral-700 py-16 text-center">
          <p className="text-neutral-500">No posts yet. Add a source in Settings to get started.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <CandidateCard
            key={item.id}
            candidate={item}
            queued={queued.has(item.id)}
            onQueue={() => handleQueue(item.id)}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => load(cursor ?? undefined)}
            disabled={loading}
            className="btn-secondary"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
