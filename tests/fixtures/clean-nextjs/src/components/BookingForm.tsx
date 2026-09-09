'use client';

import { useEffect, useState } from 'react';

export function BookingForm({ slot }: { slot: string }) {
  const [state, setState] = useState<'idle' | 'sending'>('idle');

  useEffect(() => {
    document.title = `Book ${slot}`;
  }, [slot]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('sending');
    await fetch('/api/bookings', { method: 'POST', body: JSON.stringify({ slot }) });
    setState('idle');
  }

  async function cancel(id: string) {
    await fetch('/api/bookings', { method: 'PATCH', body: JSON.stringify({ id }) });
  }

  function refresh() {
    void fetch('/api/bookings/slots');
  }

  return (
    <form onSubmit={submit}>
      <button type="submit" disabled={state === 'sending'}>Book</button>
      <button type="button" onClick={() => cancel('1')}>Cancel</button>
      <button type="button" onClick={refresh}>Refresh</button>
    </form>
  );
}
