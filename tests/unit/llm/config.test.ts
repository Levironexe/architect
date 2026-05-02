import { describe, expect, it } from 'vitest';

import { resolveLLMProvider, sanitizeProviderWarning } from '../../../src/llm/config';

describe('resolveLLMProvider', () => {
  it('returns metrics-only fallback when no provider credentials are configured', () => {
    const resolution = resolveLLMProvider({ env: {} });

    expect(resolution.provider).toBeNull();
    expect(resolution.config.provider).toBe('none');
    expect(resolution.config.isAvailable).toBe(false);
    expect(resolution.config.warnings[0]).toContain('No AI provider configured');
  });

  it('returns unavailable requested provider without exposing secrets', () => {
    const resolution = resolveLLMProvider({ env: { ARCHITECT_LLM_PROVIDER: 'openai' } });

    expect(resolution.provider).toBeNull();
    expect(resolution.config.provider).toBe('openai');
    expect(resolution.config.warnings[0]).toContain('OPENAI_API_KEY');
  });

  it('redacts API-looking tokens from warnings', () => {
    const warning = sanitizeProviderWarning('api_key=sk-secret123 authorization: bearer anthropic-secret456');

    expect(warning).not.toContain('sk-secret123');
    expect(warning).not.toContain('anthropic-secret456');
    expect(warning).toContain('[redacted]');
  });
});
