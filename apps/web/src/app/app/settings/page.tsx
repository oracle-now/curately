'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import CaptionProfileForm from '@/components/CaptionProfileForm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function SettingsPage() {
  const [igAccount, setIgAccount] = useState<any>(null);
  const [igLoading, setIgLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<any>(null);

  useEffect(() => {
    api.instagram.account().then(setIgAccount).finally(() => setIgLoading(false));
    api.captionProfiles.list().then(setProfiles);

    // Handle OAuth redirect params
    const params = new URLSearchParams(window.location.search);
    if (params.get('ig_connected')) {
      api.instagram.account().then(setIgAccount);
      window.history.replaceState({}, '', '/app/settings');
    }
  }, []);

  async function handleDeleteProfile(id: string) {
    await api.captionProfiles.remove(id);
    setProfiles((prev) => prev.filter((p) => p.id !== id));
  }

  function handleProfileSaved(profile: any) {
    setProfiles((prev) =>
      editingProfile
        ? prev.map((p) => (p.id === profile.id ? profile : p))
        : [...prev, profile]
    );
    setShowProfileForm(false);
    setEditingProfile(null);
  }

  return (
    <div className="px-6 py-8 max-w-2xl">
      <h1 className="mb-8 text-xl font-semibold">Settings</h1>

      {/* Instagram connection */}
      <section className="card mb-6">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300 uppercase tracking-wider">Instagram</h2>
        {igLoading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : igAccount?.connected ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-400">✓ Connected</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                @{igAccount.ig_user_id} · Expires{' '}
                {new Date(igAccount.token_expires_at).toLocaleDateString()}
              </p>
            </div>
            <a
              href={`${API_BASE}/api/v1/instagram/connect`}
              className="btn-secondary text-xs"
            >
              Reconnect
            </a>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-neutral-400">
              Connect your Instagram account to start publishing.
            </p>
            <a
              href={`${API_BASE}/api/v1/instagram/connect`}
              className="btn-primary"
            >
              Connect Instagram
            </a>
          </div>
        )}
      </section>

      {/* Caption profiles */}
      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Caption Profiles</h2>
          <button
            onClick={() => { setEditingProfile(null); setShowProfileForm(true); }}
            className="btn-secondary text-xs"
          >
            + New profile
          </button>
        </div>

        {profiles.length === 0 && !showProfileForm && (
          <p className="text-sm text-neutral-500">No profiles yet. Create one to customise your caption style.</p>
        )}

        <div className="space-y-3">
          {profiles.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between rounded-lg border border-neutral-800 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{profile.name}</p>
                <p className="text-xs text-neutral-500">
                  {profile.style_config?.tone} · {profile.style_config?.length} · {profile.style_config?.hashtag_count} hashtags
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditingProfile(profile); setShowProfileForm(true); }}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteProfile(profile.id)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {showProfileForm && (
          <div className="mt-4 border-t border-neutral-800 pt-4">
            <CaptionProfileForm
              initial={editingProfile}
              onSave={handleProfileSaved}
              onCancel={() => { setShowProfileForm(false); setEditingProfile(null); }}
            />
          </div>
        )}
      </section>
    </div>
  );
}
