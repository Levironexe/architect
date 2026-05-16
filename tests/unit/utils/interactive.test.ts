import { describe, expect, it } from 'vitest';

import { isInteractiveTerminal } from '../../../src/utils/interactive';

describe('isInteractiveTerminal', () => {
  it('returns true when stdin and stdout are TTY streams', () => {
    expect(isInteractiveTerminal({
      stdin: { isTTY: true } as NodeJS.ReadStream,
      stdout: { isTTY: true } as NodeJS.WriteStream
    })).toBe(true);
  });

  it('returns false when either stream is not interactive', () => {
    expect(isInteractiveTerminal({
      stdin: { isTTY: false } as NodeJS.ReadStream,
      stdout: { isTTY: true } as NodeJS.WriteStream
    })).toBe(false);
    expect(isInteractiveTerminal({
      stdin: { isTTY: true } as NodeJS.ReadStream,
      stdout: { isTTY: false } as NodeJS.WriteStream
    })).toBe(false);
  });
});
