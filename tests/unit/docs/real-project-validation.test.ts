import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('real project validation log', () => {
  it('contains five representative sample entries with outcomes and follow-ups', () => {
    const filePath = path.resolve('..', 'docs', 'REAL_PROJECT_VALIDATION.md');
    const content = readFileSync(filePath, 'utf8');

    expect(content.match(/^### Sample /gm)).toHaveLength(5);
    expect(content.match(/- Category:/g)).toHaveLength(5);
    expect(content.match(/- Scan outcome:/g)).toHaveLength(5);
    expect(content.match(/- Plan outcome:/g)).toHaveLength(5);
    expect(content.match(/Follow-up:/g)).toHaveLength(5);
  });
});
