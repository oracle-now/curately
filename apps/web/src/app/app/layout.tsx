'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isLoggedIn, clearToken } from '@/lib/auth';

const navItems = [
  { href: '/app/inspiration', label: 'Inspiration', icon: '✦' },
  { href: '/app/queue',       label: 'Queue',       icon: '◈' },
  { href: '/app/settings',   label: 'Settings',    icon: '⚙' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn()) router.replace('/login');
  }, [router]);

  function handleSignOut() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-neutral-800 bg-neutral-950 px-3 py-6">
        <div className="mb-8 px-2">
          <span className="text-lg font-bold tracking-tight text-brand-400">Curately</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-brand-600/20 text-brand-300 font-medium'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={handleSignOut}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300 transition-colors"
        >
          <span>→</span> Sign out
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
