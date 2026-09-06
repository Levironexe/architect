'use client';

export function SecretBanner() {
  const dbUrl = process.env.DATABASE_URL;
  return <div>{dbUrl ? 'connected' : 'offline'}</div>;
}
