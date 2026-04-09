'use client';
import Image from 'next/image';

interface Props {
  candidate: {
    id: string;
    media_urls: string[];
    original_caption: string | null;
    taken_at: string | null;
    source?: { type: string; value: string; isStale: boolean };
  };
  queued: boolean;
  onQueue: () => void;
}

export default function CandidateCard({ candidate, queued, onQueue }: Props) {
  const imageUrl = candidate.media_urls[0];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      {/* Image */}
      <div className="relative aspect-square w-full bg-neutral-800">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={candidate.original_caption ?? 'Post image'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-600 text-xs">No image</div>
        )}
        {/* Source badge */}
        {candidate.source && (
          <div className="absolute top-2 left-2">
            <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
              candidate.source.isStale
                ? 'bg-amber-900/80 text-amber-300'
                : 'bg-neutral-900/80 text-neutral-400'
            }`}>
              {candidate.source.isStale ? '⚠ stale' : candidate.source.value}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2">
        {candidate.original_caption && (
          <p className="mb-2 line-clamp-2 text-xs text-neutral-400">
            {candidate.original_caption}
          </p>
        )}
        <button
          onClick={onQueue}
          disabled={queued}
          className={`w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
            queued
              ? 'bg-brand-600/20 text-brand-400 cursor-default'
              : 'bg-brand-600 text-white hover:bg-brand-500'
          }`}
        >
          {queued ? '✓ In queue' : '+ Add to queue'}
        </button>
      </div>
    </div>
  );
}
