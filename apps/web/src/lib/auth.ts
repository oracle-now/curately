'use client';

export function saveToken(token: string) {
  localStorage.setItem('curately_token', token);
}

export function clearToken() {
  localStorage.removeItem('curately_token');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('curately_token');
}

export function isLoggedIn(): boolean {
  return !!getToken();
}
