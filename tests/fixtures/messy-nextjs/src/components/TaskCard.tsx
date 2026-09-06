'use client';

import { formatTitle } from '../app/page-helpers';

export function TaskCard({ title }: { title: string }) {
  function handleError() {
    alert('Something went wrong');
  }
  return <button onClick={handleError}>{formatTitle(title)}</button>;
}
