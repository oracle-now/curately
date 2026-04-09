'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

const STATUS_COLORS: Record<string, string> = {
  queued:        'text-neutral-400 bg-neutral-800',
  caption_ready: 'text-blue-300 bg-blue-900/40',
  scheduled:     'text-amber-300 bg-amber-900/40',
  posting:       'text-purple-300 bg-purple-900/40',
  posted:        'text-green-300 bg-green-900/40',
  failed:        'text-red-300 bg-red-900/40',
};

interface Props {
  item: any;
  onUpdate: (item: any) => void;
  onRemove: (id: string) => void;
}

export default function QueueCard({ item, onUpdate, onRemove }: Props) {
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(item.caption_text ?? '');

  const imageUrl = item.post_candidate?.media_urls?.[0];
  const statusColor = STATUS_COLORS[item.status] ?? STATUS_COLORS.queued;
  const canPublish = ['caption_ready', 'scheduled'].includes(item.status) && item.caption_text;
  const canGenerate = ['queued', 'caption_ready'].includes(item.status);

  async function handleGenerateCaption() {
    setGeneratingCaption(true);
    try {
      const updated = await api.queue.generateCaption(item.id);
      onUpdate(updated);
      setCaptionDraft(updated.caption_text ?? '');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGeneratingCaption(false);
    }
  }

  async function handleSaveCaption() {
    const updated = await api.queue.update(item.id, {
      caption_text: captionDraft,
      status: 'caption_ready',
    });
    onUpdate(updated);
    setEditingCaption(false);
  }

  async function handlePublish() {
    if (!confirm('Publish this post to Instagram now?')) return;
    setPublishing(true);
    try {
      await api.queue.publish(item.id);
      onUpdate({ ...item, status: 'scheduled' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function handleRemove() {
    if (!confirm('Remove this item from the queue?')) return;
    await api.queue.remove(item.id);
    onRemove(item.id);
  }

  return (
    <div className="card flex gap-4">
      {/* Thumbnail */}
      {imageUrl && (
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-800">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
            {item.status.replace('_', ' ')}
          </span>
          <button
            onClick={handleRemove}
            className="text-xs text-neutral-600 hover:text-red-400"
          >
            Remove
          </button>
        </div>

        {/* Caption */}
        {editingCaption ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="input min-h-[80px] resize-y text-xs"
              value={captionDraft}
              onChange={(e) => setCaptionDraft(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveCaption} className="btn-primary text-xs">Save</button>
              <button onClick={() => setEditingCaption(false)} className="btn-secondary text-xs">Cancel</button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => { setEditingCaption(true); setCaptionDraft(item.caption_text ?? ''); }}
            className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200 transition-colors min-h-[1.5rem]"
            title="Click to edit"
          >
            {item.caption_text ?? <span className="italic text-neutral-600">No caption yet</span>}
          </p>
        )}

        {/* Hashtags */}
        {item.hashtags?.length > 0 && (
          <p className="text-xs text-brand-400/70">
            {(item.hashtags as string[]).map((h) => `#${h}`).join(' ')}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {canGenerate && (
            <button
              onClick={handleGenerateCaption}
              disabled={generatingCaption}
              className="btn-secondary text-xs"
            >
              {generatingCaption ? 'Generating…' : item.caption_text ? 'Regenerate' : 'Generate caption'}
            </button>
          )}
          {canPublish && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="btn-primary text-xs"
            >
              {publishing ? 'Scheduling…' : 'Publish'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
