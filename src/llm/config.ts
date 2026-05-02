import { ClaudeProvider } from './claude-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { OpenAIProvider } from './openai-provider.js';
import type { LLMProvider, LLMProviderName, ProviderResolution } from './provider.js';

export interface ResolveProviderOptions {
  env?: NodeJS.ProcessEnv;
  explicitProvider?: LLMProviderName;
  provider?: LLMProvider | null;
}

const DEFAULT_CLAUDE_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
const DEFAULT_OLLAMA_MODEL = 'llama3.1';

export function resolveLLMProvider(options: ResolveProviderOptions = {}): ProviderResolution {
  if (options.provider) {
    return {
      config: {
        provider: 'none',
        model: 'mock',
        source: 'explicit',
        isAvailable: true,
        warnings: []
      },
      provider: options.provider
    };
  }

  const env = options.env ?? process.env;
  const requestedProvider = options.explicitProvider ?? parseProviderName(env.ARCHITECT_LLM_PROVIDER);

  if (requestedProvider) {
    return resolveRequestedProvider(requestedProvider, env);
  }

  if (env.ANTHROPIC_API_KEY) {
    const model = env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL;
    return createAvailableResolution('claude', model, new ClaudeProvider(env.ANTHROPIC_API_KEY, model));
  }

  if (env.OPENAI_API_KEY) {
    const model = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
    return createAvailableResolution('openai', model, new OpenAIProvider(env.OPENAI_API_KEY, model));
  }

  return {
    config: {
      provider: 'none',
      source: 'fallback',
      isAvailable: false,
      warnings: ['No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or ARCHITECT_LLM_PROVIDER=ollama to enable concern classification.']
    },
    provider: null
  };
}

function resolveRequestedProvider(provider: LLMProviderName, env: NodeJS.ProcessEnv): ProviderResolution {
  if (provider === 'none') {
    return {
      config: {
        provider: 'none',
        source: 'explicit',
        isAvailable: false,
        warnings: ['AI concern classification disabled by provider configuration.']
      },
      provider: null
    };
  }

  if (provider === 'claude') {
    if (!env.ANTHROPIC_API_KEY) {
      return createUnavailableResolution('claude', 'ANTHROPIC_API_KEY is not configured.');
    }

    const model = env.ANTHROPIC_MODEL ?? DEFAULT_CLAUDE_MODEL;
    return createAvailableResolution('claude', model, new ClaudeProvider(env.ANTHROPIC_API_KEY, model));
  }

  if (provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      return createUnavailableResolution('openai', 'OPENAI_API_KEY is not configured.');
    }

    const model = env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
    return createAvailableResolution('openai', model, new OpenAIProvider(env.OPENAI_API_KEY, model));
  }

  const model = env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_MODEL;
  return createAvailableResolution('ollama', model, new OllamaProvider(model, env.OLLAMA_BASE_URL));
}

function createAvailableResolution(provider: LLMProviderName, model: string, llmProvider: LLMProvider): ProviderResolution {
  return {
    config: {
      provider,
      model,
      source: 'environment',
      isAvailable: true,
      warnings: []
    },
    provider: llmProvider
  };
}

function createUnavailableResolution(provider: LLMProviderName, warning: string): ProviderResolution {
  return {
    config: {
      provider,
      source: 'environment',
      isAvailable: false,
      warnings: [sanitizeProviderWarning(warning)]
    },
    provider: null
  };
}

export function sanitizeProviderWarning(warning: string): string {
  return warning
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/anthropic-[A-Za-z0-9_-]+/g, '[redacted]')
    .replace(/(api[_-]?key\s*[=:]\s*)\S+/gi, '$1[redacted]')
    .replace(/(authorization\s*[:=]\s*bearer\s+)\S+/gi, '$1[redacted]');
}

function parseProviderName(value: string | undefined): LLMProviderName | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.toLowerCase();
  return normalized === 'claude' || normalized === 'openai' || normalized === 'ollama' || normalized === 'none'
    ? normalized
    : undefined;
}
