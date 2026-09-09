import { listLocalUsers } from '../../lib/users';

export default async function HelperPage() {
  return <div>{(await listLocalUsers()).length}</div>;
}
