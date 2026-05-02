import Anthropic from '@anthropic-ai/sdk';

import type { LLMProvider } from './provider.js';

export class ClaudeProvider implements LLMProvider {
  public readonly name = 'Claude';
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async analyze(prompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim();
  }
}
