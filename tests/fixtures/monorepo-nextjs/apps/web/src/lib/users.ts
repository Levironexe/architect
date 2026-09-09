import { db } from './db';

export function listLocalUsers() {
  return db.user.findMany();
}
