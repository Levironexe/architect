import { describe, expect, it } from 'vitest';

import { matchesAnyGlob, matchesGlob } from '../../../src/rules/glob';

describe('matchesGlob', () => {
  it('matches an App Router page at the repo root and under a source root', () => {
    expect(matchesGlob('app/users/page.tsx', 'app/**/page.tsx')).toBe(true);
    expect(matchesGlob('src/app/users/page.tsx', 'app/**/page.tsx')).toBe(true);
    expect(matchesGlob('src/app/(dashboard)/team/page.tsx', 'app/**/page.tsx')).toBe(true);
  });

  it('matches a page directly under app/ with the non-recursive pattern', () => {
    expect(matchesGlob('src/app/page.tsx', 'app/page.tsx')).toBe(true);
    expect(matchesGlob('app/page.tsx', 'app/page.tsx')).toBe(true);
  });

  it('does not match files outside the pattern', () => {
    expect(matchesGlob('src/components/UsersTable.tsx', 'app/**/page.tsx')).toBe(false);
    expect(matchesGlob('src/app/users/route.ts', 'app/**/page.tsx')).toBe(false);
    expect(matchesGlob('src/lib/page.helpers.ts', 'app/**/page.tsx')).toBe(false);
  });

  it('does not let a partial segment match', () => {
    expect(matchesGlob('src/myapp/users/page.tsx', 'app/**/page.tsx')).toBe(false);
  });

  it('treats a single star as one segment', () => {
    expect(matchesGlob('src/app/page.tsx', 'app/*.tsx')).toBe(true);
    expect(matchesGlob('src/app/users/page.tsx', 'app/*.tsx')).toBe(false);
  });

  it('matches everything when no patterns are given', () => {
    expect(matchesAnyGlob('anything/at/all.ts', undefined)).toBe(true);
    expect(matchesAnyGlob('anything/at/all.ts', [])).toBe(true);
  });
});
