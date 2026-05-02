import type { LLMProvider } from '../../../src/llm/provider.js';

export class MockProvider implements LLMProvider {
  public readonly name: string;
  public readonly prompts: string[] = [];

  constructor(
    private readonly response: string | ((prompt: string) => string | Promise<string>),
    name = 'mock'
  ) {
    this.name = name;
  }

  async analyze(prompt: string): Promise<string> {
    this.prompts.push(prompt);
    return typeof this.response === 'function' ? this.response(prompt) : this.response;
  }
}
