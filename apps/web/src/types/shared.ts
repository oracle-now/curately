// Inlined from packages/shared — maintained here for Railway compatibility
// (Railway builds each service in isolation; workspace packages are not available)

export type SourceType = 'instagram' | 'tumblr' | 'hashtag';

export type QueueItemStatus =
  | 'queued'
  | 'caption_ready'
  | 'scheduled'
  | 'posting'
  | 'posted'
  | 'failed';

export type PostJobStatus = 'pending' | 'running' | 'success' | 'failed';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface InstagramAccount {
  id: string;
  user_id: string;
  ig_user_id: string;
  token_expires_at: string;
}

export interface Source {
  id: string;
  user_id: string;
  type: SourceType;
  value: string;
  rss_url: string;
  active: boolean;
  last_synced_at: string | null;
  is_stale: boolean;
  created_at: string;
}

export interface PostCandidate {
  id: string;
  user_id: string;
  source_id: string;
  external_id: string;
  media_urls: string[];
  original_caption: string | null;
  taken_at: string | null;
  created_at: string;
}

export interface CaptionStyleConfig {
  tone: string;
  length: 'short' | 'medium' | 'long';
  use_emoji: boolean;
  hashtag_count: number;
  hashtag_strategy: string;
  custom_instructions?: string;
}

export interface CaptionProfile {
  id: string;
  user_id: string;
  name: string;
  style_config: CaptionStyleConfig;
  created_at: string;
}

export interface QueueItem {
  id: string;
  user_id: string;
  post_candidate_id: string;
  caption_profile_id: string | null;
  status: QueueItemStatus;
  caption_text: string | null;
  hashtags: string[] | null;
  scheduled_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  post_candidate?: PostCandidate;
}

export interface PostJob {
  id: string;
  queue_item_id: string;
  ig_account_id: string;
  scheduled_at: string;
  last_attempt_at: string | null;
  attempt_count: number;
  status: PostJobStatus;
  ig_media_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}
