'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import QueueCard from '@/components/QueueCard';

const TABS = [
  { label: 'All',         value: undefined },
  { label: 'Queued',      value: 'queued' },
  { label: 'Ready',       value: 'caption_ready' },
  { label: 'Scheduled',   value: 'scheduled' },
  { label: 'Posted',      value: 'posted' },
  { label: 'Failed',      value: 'failed' },
] as const;

export default function QueuePage() {
  const [tab, setTab] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (status?: string, nextCursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.queue.list({ status, cursor: nextCursor });
      setItems((prev) => nextCursor ? [...prev, ...res.items] : res.items);
      setCursor(res.nextCursor);
      setHasMore(!!res.nextCursor);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(true);
    load(tab);
  }, [tab, load]);

  function handleItemUpdate(updated: any) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleItemRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Queue</h1>
        <p className="mt-1 text-sm text-neutral-400">Manage captions and schedule posts</p>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex gap-1 border-b border-neutral-800 pb-px">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.value)}
            className={`rounded-t-md px-3 py-1.5 text-sm transition-colors ${
              tab === t.value
                ? 'border-b-2 border-brand-500 text-brand-300 font-medium'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {items.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-neutral-700 py-16 text-center">
          <p className="text-neutral-500">Nothing here. Add posts from the Inspiration feed.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <QueueCard
            key={item.id}
            item={item}
            onUpdate={handleItemUpdate}
            onRemove={handleItemRemove}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => load(tab, cursor ?? undefined)}
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
