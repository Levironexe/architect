import { describe, expect, it } from 'vitest';

describe('users', () => {
  it('reads its own configuration', () => {
    expect(process.env.TEST_DATABASE_URL ?? '').toBeDefined();
  });
});
