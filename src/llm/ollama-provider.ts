import type { LLMProvider } from './provider.js';

interface OllamaResponse {
  response?: string;
  message?: {
    content?: string;
  };
}

export class OllamaProvider implements LLMProvider {
  public readonly name = 'Ollama';
  private readonly baseUrl: string;

  constructor(private readonly model: string, baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async analyze(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}`);
    }

    const body = (await response.json()) as OllamaResponse;
    return (body.response ?? body.message?.content ?? '').trim();
  }
}
