import { db } from '../../lib/db';

export default async function LocalPage() {
  return <div>{(await db.user.findMany()).length}</div>;
}
