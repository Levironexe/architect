'use client';

export function PublicBanner() {
  return <div>{process.env.NEXT_PUBLIC_APP_NAME}</div>;
}
