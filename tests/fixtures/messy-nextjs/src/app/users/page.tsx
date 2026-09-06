'use client';

import { useEffect, useState } from 'react';

export default function UsersPage() {
  const [users, setUsers] = useState<unknown[]>([]);
  useEffect(() => {
    fetch('/api/users').then((response) => response.json()).then(setUsers);
  }, []);
  return <div>{users.length}</div>;
}
