'use client';

import { useEffect } from 'react';

export function PageViewBeacon({ userId }: { userId: string }) {
  useEffect(() => {
    const body = JSON.stringify({ userId });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track/view', body);
    } else {
      void fetch('/api/track/view', { method: 'POST', body, keepalive: true });
    }
  }, [userId]);

  return null;
}
