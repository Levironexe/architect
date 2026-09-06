'use client';

import { useState } from 'react';

export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  return [value, () => setValue((current) => !current)] as const;
}
