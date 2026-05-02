import OpenAI from 'openai';

import type { LLMProvider } from './provider.js';

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'OpenAI';
  private readonly client: OpenAI;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async analyze(prompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });

    return response.choices[0]?.message.content?.trim() ?? '';
  }
}
