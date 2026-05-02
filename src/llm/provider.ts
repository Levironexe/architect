export type LLMProviderName = 'claude' | 'openai' | 'ollama' | 'none';
export type LLMProviderConfigSource = 'environment' | 'config' | 'explicit' | 'fallback';

export interface LLMProviderConfig {
  provider: LLMProviderName;
  model?: string;
  source: LLMProviderConfigSource;
  isAvailable: boolean;
  warnings: string[];
}

export interface LLMProvider {
  name: string;
  analyze(prompt: string): Promise<string>;
}

export interface ProviderResolution {
  config: LLMProviderConfig;
  provider: LLMProvider | null;
}
