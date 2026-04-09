const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('curately_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem('curately_token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error ?? 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string } }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ token: string; user: { id: string; email: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
  },

  instagram: {
    account: () => request<{ connected: boolean; ig_user_id: string | null; token_expires_at: string | null }>('/instagram/account'),
  },

  sources: {
    list: () => request<any[]>('/sources'),
    create: (data: { type: string; value: string; rss_url: string }) =>
      request('/sources', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { active?: boolean }) =>
      request(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/sources/${id}`, { method: 'DELETE' }),
  },

  candidates: {
    list: (params?: { source_id?: string; cursor?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.source_id) q.set('source_id', params.source_id);
      if (params?.cursor) q.set('cursor', params.cursor);
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ items: any[]; nextCursor: string | null }>(`/candidates?${q}`);
    },
  },

  queue: {
    list: (params?: { status?: string; cursor?: string }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.cursor) q.set('cursor', params.cursor);
      return request<{ items: any[]; nextCursor: string | null }>(`/queue?${q}`);
    },
    add: (post_candidate_id: string) =>
      request('/queue', { method: 'POST', body: JSON.stringify({ post_candidate_id }) }),
    generateCaption: (id: string, caption_profile_id?: string) =>
      request(`/queue/${id}/generate-caption`, {
        method: 'POST',
        body: JSON.stringify({ caption_profile_id }),
      }),
    update: (id: string, data: object) =>
      request(`/queue/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    publish: (id: string) =>
      request(`/queue/${id}/publish`, { method: 'POST' }),
    remove: (id: string) => request(`/queue/${id}`, { method: 'DELETE' }),
  },

  captionProfiles: {
    list: () => request<any[]>('/caption-profiles'),
    create: (data: object) =>
      request('/caption-profiles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: object) =>
      request(`/caption-profiles/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request(`/caption-profiles/${id}`, { method: 'DELETE' }),
  },
};
