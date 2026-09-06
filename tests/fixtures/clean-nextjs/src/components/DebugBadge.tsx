'use client';

export function DebugBadge() {
  if (process.env.NODE_ENV === 'production') return null;
  return <span>dev</span>;
}
