import { config } from './config';

export interface User {
  id: string;
  name: string;
}

export async function listUsers(): Promise<User[]> {
  const response = await fetch(`${config.databaseUrl}/users`);
  return response.json() as Promise<User[]>;
}
