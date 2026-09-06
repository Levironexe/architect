'use server';

import { listUsers } from '../lib/users';

export async function refreshUsers() {
  const users = await listUsers();
  return { ok: true as const, users };
}
