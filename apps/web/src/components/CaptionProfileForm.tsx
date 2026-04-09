'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  initial?: any;
  onSave: (profile: any) => void;
  onCancel: () => void;
}

const DEFAULTS = {
  tone: 'warm and authentic',
  length: 'medium' as const,
  use_emoji: true,
  hashtag_count: 10,
  hashtag_strategy: 'niche-focused',
  custom_instructions: '',
};

export default function CaptionProfileForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [config, setConfig] = useState({ ...DEFAULTS, ...initial?.style_config });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: any) {
    setConfig((prev: any) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { name, style_config: config };
      const result = initial
        ? await api.captionProfiles.update(initial.id, payload)
        : await api.captionProfiles.create(payload);
      onSave(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400">Profile name</label>
        <input className="input text-sm" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Tone</label>
          <input className="input text-sm" value={config.tone} onChange={(e) => set('tone', e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Length</label>
          <select className="input text-sm" value={config.length} onChange={(e) => set('length', e.target.value)}>
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Hashtag count</label>
          <input type="number" min={0} max={30} className="input text-sm" value={config.hashtag_count}
            onChange={(e) => set('hashtag_count', Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Hashtag strategy</label>
          <input className="input text-sm" value={config.hashtag_strategy}
            onChange={(e) => set('hashtag_strategy', e.target.value)} required />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="use_emoji" checked={config.use_emoji}
          onChange={(e) => set('use_emoji', e.target.checked)} className="rounded" />
        <label htmlFor="use_emoji" className="text-sm text-neutral-300">Use emoji in captions</label>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-400">Custom instructions <span className="text-neutral-600">(optional)</span></label>
        <textarea className="input min-h-[60px] resize-y text-sm" value={config.custom_instructions}
          onChange={(e) => set('custom_instructions', e.target.value)}
          placeholder="e.g. Always mention the brand name. Avoid exclamation marks." />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving…' : initial ? 'Update profile' : 'Create profile'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
      </div>
    </form>
  );
}
